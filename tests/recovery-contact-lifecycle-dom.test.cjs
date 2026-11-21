'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const domPath = process.env.ROUTFLEX_TEST_JSDOM;
const root = path.resolve(__dirname, '..');
const U = '11111111-1111-4111-8111-111111111111', S = '22222222-2222-4222-8222-222222222222';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await delay(5); } throw Error('DOM did not settle'); }
async function fixture(page, { configuredRecipient = false } = {}) {
  const { JSDOM, VirtualConsole } = require(domPath), errors = [], calls = [], intervals = [];
  const virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, page), 'utf8'), { url: `http://localhost:5500/${page}`, runScripts: 'outside-only', virtualConsole });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  w.setInterval = callback => { intervals.push(callback); return intervals.length; }; w.clearInterval = () => {};
  w.document.getElementById('authTransition').dataset.phase = 'valid';
  let expiry, revoked = false, requestFlight;
  const response = (status, payload) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), text: async () => JSON.stringify(payload) });
  w.fetch = async (url, options) => {
    const pathname = new URL(url).pathname; calls.push({ pathname, options });
    if (pathname === '/core/me') return revoked ? response(401, {}) : response(200, { user: { id: U, status: 'ACTIVE' }, authenticationSessionId: S, ...(expiry ? { authenticationSessionExpiresAt: expiry } : {}) });
    if (pathname === '/core/auth/refresh') return response(401, {});
    if (pathname === '/core/me/recovery-contact') return response(200, { verified: false, ...(configuredRecipient ? { configuredRecipient: true } : {}) });
    if (pathname === '/core/me/recovery-contact/request') return requestFlight ? requestFlight(options) : response(200, { accepted: true, challengeId: 'a'.repeat(43) });
    if (pathname === '/core/me/recovery-contact/verify') return response(200, { verified: true });
    throw Error('Unexpected fixture path');
  };
  w.eval(fs.readFileSync(path.join(root, 'core-client.js'), 'utf8'));
  w.RoutflexCore.setToken('synthetic-access');
  w.eval(fs.readFileSync(path.join(root, 'recovery-contact.js'), 'utf8'));
  const dialog = w.document.querySelector('.recovery-contact-dialog'), form = dialog.querySelector('form'), submit = form.querySelector('[type=submit]');
  return { w, dom, dialog, form, submit, calls, errors, intervals, response,
    setExpiry: value => { expiry = value; }, revoke: () => { revoked = true; },
    setConfiguredRecipient: value => { configuredRecipient = value; },
    delayRequest: fn => { requestFlight = fn; },
    async open() { w.document.querySelector('[data-recovery-contact]').click(); await until(() => dialog.open && !submit.disabled); },
    fill() { form.elements.email.value = 'synthetic@example.test'; form.elements.password.value = 'synthetic-current-password'; form.elements.code.value = '123456'; },
    send() { form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); },
    cleared() { assert.equal(dialog.open, false); for (const name of ['email', 'password', 'code']) assert.equal(form.elements[name].value, ''); assert.equal(submit.disabled, true); },
  };
}
for (const page of ['workspace.html', 'control-center/index.html']) {
  test(`${page}: recovery privacy lifecycle with real scripts and synthetic transport`, { skip: !domPath }, async t => {
    for (const action of ['invalidate', 'replace', 'context']) await t.test(`${action} clears all fields synchronously and prevents a later submit`, async () => {
      const f = await fixture(page); try {
        await f.open(); f.fill(); const before = f.calls.length;
        if (action === 'invalidate') f.w.RoutflexCore.clearSession();
        else if (action === 'replace') f.w.RoutflexCore.setToken('synthetic-replacement');
        else f.w.document.dispatchEvent(new f.w.CustomEvent('routflex:protected-context-cleared'));
        f.cleared(); f.send(); await delay(10); assert.equal(f.calls.length, before); assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('known server session deadline clears the open form without waiting for polling', async () => {
      const f = await fixture(page); try {
        f.setExpiry(new Date(Date.now() + 200).toISOString()); await f.open(); f.fill(); const before = f.calls.length;
        await until(() => !f.dialog.open); f.cleared(); assert.equal(f.calls.length, before); assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('revocation detected by the sensitive-form poll clears filled fields', async () => {
      const f = await fixture(page); try {
        await f.open(); f.fill(); f.revoke(); await f.intervals.at(-1)(); f.cleared();
        assert.equal(f.calls.some(call => call.options.method === 'POST' && call.pathname.includes('/recovery-contact/')), false);
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('context loss aborts a pending request and ignores a transport that resolves late', async () => {
      const f = await fixture(page); try {
        let resolve, pendingSignal;
        f.delayRequest(options => { pendingSignal = options.signal; return new Promise(done => { resolve = done; }); });
        await f.open(); f.fill(); f.send(); await until(() => Boolean(resolve));
        assert.equal(f.form.elements.password.value, ''); assert.equal(f.form.elements.email.value, '');
        f.w.document.dispatchEvent(new f.w.CustomEvent('routflex:protected-context-cleared'));
        f.cleared(); assert.equal(pendingSignal.aborted, true);
        resolve({ ok: true, status: 200, text: async () => JSON.stringify({ accepted: true, challengeId: 'b'.repeat(43) }) });
        await delay(20); f.cleared(); assert.equal(f.dialog.querySelector('[data-status]').textContent, ''); assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('remote revocation is polled while a mutation is pending and aborts its transport', async () => {
      const f = await fixture(page); try {
        let resolve, pendingSignal;
        f.delayRequest(options => { pendingSignal = options.signal; return new Promise(done => { resolve = done; }); });
        await f.open(); f.fill(); f.send(); await until(() => Boolean(resolve));
        f.revoke(); await f.intervals.at(-1)();
        f.cleared(); assert.equal(pendingSignal.aborted, true);
        resolve({ ok: true, status: 200, text: async () => JSON.stringify({ accepted: true, challengeId: 'c'.repeat(43) }) });
        await delay(20); f.cleared();
        assert.equal(f.calls.filter(call => call.pathname.endsWith('/recovery-contact/request')).length, 1);
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('OTP input is cleared as soon as verification is submitted', async () => {
      const f = await fixture(page); try {
        await f.open(); f.fill(); f.send(); await until(() => !f.dialog.querySelector('[data-code]').hidden);
        f.form.elements.code.value = '123456'; f.send(); await until(() => f.calls.some(call => call.pathname.endsWith('/verify')));
        assert.equal(f.form.elements.code.value, ''); await until(() => f.submit.hidden); assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('normal mode continues to require and submit the manually entered address', async () => {
      const f = await fixture(page); try {
        await f.open();
        assert.equal(f.form.elements.email.disabled, false); assert.equal(f.form.elements.email.required, true);
        assert.equal(f.form.elements.email.closest('label').hidden, false);
        f.fill(); f.send(); await until(() => !f.dialog.querySelector('[data-code]').hidden);
        const request = f.calls.find(call => call.pathname.endsWith('/recovery-contact/request'));
        assert.deepEqual(JSON.parse(request.options.body), { email: 'synthetic@example.test', currentPassword: 'synthetic-current-password' });
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('restricted mode omits the address, uses the approved contact notice and still verifies through the real client', async () => {
      const f = await fixture(page, { configuredRecipient: true }); try {
        await f.open();
        assert.equal(f.form.elements.email.disabled, true); assert.equal(f.form.elements.email.required, false);
        assert.equal(f.form.elements.email.closest('label').hidden, true);
        assert.equal(f.w.document.activeElement, f.form.elements.password);
        assert.match(f.dialog.querySelector('[data-description]').textContent, /contato aprovado/);
        assert.match(f.dialog.querySelector('[data-description]').textContent, /Mantenha esta página visível/);
        // Even an injected field value cannot select a destination in this mode.
        f.fill(); f.send(); await until(() => !f.dialog.querySelector('[data-code]').hidden);
        const request = f.calls.find(call => call.pathname.endsWith('/recovery-contact/request'));
        assert.deepEqual(JSON.parse(request.options.body), { currentPassword: 'synthetic-current-password' });
        assert.equal(f.form.elements.email.value, ''); assert.equal(f.form.elements.password.value, '');
        f.form.elements.code.value = '123456'; f.send(); await until(() => f.submit.hidden);
        assert.equal(f.form.elements.code.value, '');
        assert.equal(f.calls.filter(call => call.pathname.endsWith('/recovery-contact/request')).length, 1);
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('restricted mode never keeps email field restrictions after reopening normal mode', async () => {
      const f = await fixture(page, { configuredRecipient: true }); try {
        await f.open(); f.dialog.querySelector('[data-close]').click(); f.cleared();
        f.setConfiguredRecipient(false); await f.open();
        assert.equal(f.form.elements.email.disabled, false); assert.equal(f.form.elements.email.required, true);
        assert.equal(f.form.elements.email.closest('label').hidden, false);
        assert.equal(f.dialog.querySelector('[data-description]').textContent.includes('contato aprovado'), false);
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('restricted mode prevents double submission while its single request is pending', async () => {
      const f = await fixture(page, { configuredRecipient: true }); try {
        let resolve;
        f.delayRequest(() => new Promise(done => { resolve = done; }));
        await f.open(); f.fill(); f.send(); f.send(); await until(() => Boolean(resolve));
        f.send(); await delay(10);
        assert.equal(f.calls.filter(call => call.pathname.endsWith('/recovery-contact/request')).length, 1);
        resolve(f.response(202, { accepted: true, challengeId: 'r'.repeat(43) }));
        await until(() => !f.dialog.querySelector('[data-code]').hidden); assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    for (const failure of ['network', 'server', 'invalid-receipt']) await t.test(`restricted ${failure} outcome blocks a new send in the same dialog`, async () => {
      const f = await fixture(page, { configuredRecipient: true }); try {
        f.delayRequest(() => {
          if (failure === 'network') throw Error('synthetic-offline');
          return f.response(failure === 'server' ? 503 : 202, { accepted: true, challengeId: 'invalid' });
        });
        await f.open(); f.fill(); f.send();
        await until(() => f.dialog.querySelector('[data-status]').textContent.includes('Novos envios estão bloqueados'));
        assert.equal(f.submit.disabled, true); assert.equal(f.form.elements.password.value, ''); assert.equal(f.form.elements.email.value, '');
        const count = f.calls.length;
        f.fill(); f.send(); await delay(10); assert.equal(f.calls.length, count);
        // The guard is independent of the DOM button's disabled property.
        f.submit.disabled = false; f.send(); await delay(10); assert.equal(f.calls.length, count);
        assert.equal(f.calls.filter(call => call.pathname.endsWith('/recovery-contact/request')).length, 1);
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('a restricted password rejection uses 403 without refresh, logout or automatic retry', async () => {
      const f = await fixture(page, { configuredRecipient: true }); try {
        f.delayRequest(() => f.response(403, { error: { code: 'FORBIDDEN' } }));
        await f.open(); f.fill(); f.send();
        await until(() => !f.submit.disabled && f.dialog.querySelector('[data-status]').textContent.includes('Não foi possível concluir'));
        assert.equal(f.dialog.open, true); assert.equal(f.w.RoutflexCore.getToken(), 'synthetic-access');
        assert.equal(f.calls.some(call => call.pathname.startsWith('/core/auth/')), false);
        assert.equal(f.calls.filter(call => call.pathname.endsWith('/recovery-contact/request')).length, 1);
        assert.equal(f.form.elements.password.value, '');
        f.delayRequest(() => f.response(202, { accepted: true, challengeId: 's'.repeat(43) }));
        f.form.elements.password.value = 'synthetic-corrected-password'; f.send();
        await until(() => !f.dialog.querySelector('[data-code]').hidden);
        assert.equal(f.calls.filter(call => call.pathname.endsWith('/recovery-contact/request')).length, 2);
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    for (const event of ['hidden', 'pagehide', 'close']) await t.test(`restricted OTP stage ${event} still destroys fields and challenge context`, async () => {
      const f = await fixture(page, { configuredRecipient: true }); try {
        await f.open(); f.fill(); f.send(); await until(() => !f.dialog.querySelector('[data-code]').hidden);
        f.form.elements.code.value = '123456'; const count = f.calls.length;
        if (event === 'hidden') {
          Object.defineProperty(f.w.document, 'visibilityState', { configurable: true, value: 'hidden' });
          f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));
        } else if (event === 'pagehide') f.w.dispatchEvent(new f.w.Event('pagehide'));
        else f.dialog.querySelector('[data-close]').click();
        f.cleared(); f.send(); await delay(10); assert.equal(f.calls.length, count);
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
    await t.test('restricted hidden pending request is aborted and late completion cannot restore its challenge', async () => {
      const f = await fixture(page, { configuredRecipient: true }); try {
        let resolve, signal;
        f.delayRequest(options => { signal = options.signal; return new Promise(done => { resolve = done; }); });
        await f.open(); f.fill(); f.send(); await until(() => Boolean(resolve));
        Object.defineProperty(f.w.document, 'visibilityState', { configurable: true, value: 'hidden' });
        f.w.document.dispatchEvent(new f.w.Event('visibilitychange')); f.cleared(); assert.equal(signal.aborted, true);
        resolve(f.response(202, { accepted: true, challengeId: 't'.repeat(43) }));
        await delay(20); f.cleared();
        assert.equal(f.dialog.querySelector('[data-status]').textContent, '');
        assert.equal(f.calls.filter(call => call.pathname.endsWith('/recovery-contact/request')).length, 1);
        assert.deepEqual(f.errors, []);
      } finally { f.dom.window.close(); }
    });
  });
}
