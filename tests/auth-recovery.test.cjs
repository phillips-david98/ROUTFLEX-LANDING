'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createSimulator, createFlow } = require('../auth-recovery-demo.js');

function fixture(wait = async () => {}) {
  let clock = 1000;
  const adapter = createSimulator({ now: () => clock, wait });
  const updates = [], flow = createFlow(adapter, state => updates.push(state));
  return { adapter, flow, updates, advance(ms) { clock += ms; } };
}

test('only the explicit HTTP loopback DEV entry enables recovery, never URL flags or storage', () => {
  const config = fs.readFileSync(path.join(__dirname, '../auth-config.js'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '../auth-recovery.js'), 'utf8');
  for (const [href, enabled] of [
    ['http://localhost:5500/', true], ['http://127.0.0.1:5500/', true],
    ['https://landing.example.test/?recoveryDemo=1&demo=1', false],
    ['https://localhost:5500/', false], ['http://localhost:5501/', false],
  ]) {
    const window = { location: { href } };
    Object.defineProperty(window, 'localStorage', { get() { throw Error('Storage must not enable recovery'); } });
    vm.runInNewContext(config, { window, URL });
    assert.equal(window.RoutflexAuthConfig.recoveryDemoEnabled, false);
    assert.equal(window.RoutflexAuthConfig.recoveryEnabled, enabled);
    if (!enabled) vm.runInNewContext(ui, { window, URL });
  }
  for (const href of ['https://landing.example.test/', 'file:///C:/ROUTflex-landing/index.html']) {
    assert.doesNotThrow(() => vm.runInNewContext(ui, {
      window: { location: { href }, RoutflexAuthConfig: { recoveryDemoEnabled: true } }, URL,
    }));
  }
});

test('all simulated steps require their predecessor and completion clears only the local challenge', async () => {
  const f = fixture();
  assert.equal(await f.flow.verify(f.adapter.demoCode), false);
  assert.equal(await f.flow.save('fictitious', 'fictitious'), false);
  f.flow.open();
  assert.equal(await f.flow.send('  review@example.test  '), true);
  assert.equal(f.flow.state.step, 'otp');
  assert.equal(f.flow.state.email, 'review@example.test');
  assert.match(f.flow.state.notice, /Nenhum e-mail real/);
  assert.equal(await f.flow.verify(f.adapter.demoCode), true);
  assert.equal(f.flow.state.step, 'password');
  assert.equal(await f.flow.save('fictitious', 'fictitious'), true);
  assert.equal(f.flow.state.step, 'complete');
  assert.match(f.flow.state.notice, /senha real não foi alterada/);
  assert.equal(f.adapter.remaining(), 0);
  f.flow.close();
  assert.equal(f.flow.state.email, '');
  assert.equal(f.flow.state.step, 'login');
  assert.ok(f.updates.some(state => state.busy));
});

test('invalid email, incomplete and wrong OTP, and mismatching passwords cannot advance', async () => {
  const f = fixture();
  f.flow.open();
  for (const email of ['not-an-email', 'a@@b.test', 'a b@example.test']) {
    assert.equal(await f.flow.send(email), false); assert.equal(f.flow.state.step, 'email');
  }
  await f.flow.send('review@example.test');
  for (const code of ['1', 'abcdef', '000000']) {
    assert.equal(await f.flow.verify(code), false); assert.equal(f.flow.state.step, 'otp'); assert.ok(f.flow.state.error);
  }
  await f.flow.verify(f.adapter.demoCode);
  for (const [first, second] of [['', ''], ['fictitious', 'different']]) {
    assert.equal(await f.flow.save(first, second), false); assert.equal(f.flow.state.step, 'password');
  }
  f.flow.clearError(); assert.equal(f.flow.state.error, ''); assert.equal(f.flow.state.step, 'password');
});

test('resend cooldown uses elapsed time, expiry is enforced, and resending renews the challenge', async () => {
  const f = fixture(); f.flow.open(); await f.flow.send('review@example.test');
  assert.equal(await f.flow.resend(), false); assert.equal(f.adapter.remaining(), 30);
  f.advance(30000);
  assert.equal(f.adapter.remaining(), 0); assert.equal(await f.flow.resend(), true);
  f.advance(120000);
  assert.equal(await f.flow.verify(f.adapter.demoCode), false); assert.match(f.flow.state.error, /expirado/);
  assert.equal(await f.flow.resend(), true); assert.equal(await f.flow.verify(f.adapter.demoCode), true);
  f.advance(120000);
  assert.equal(await f.flow.save('fictitious', 'fictitious'), false);
  assert.equal(f.flow.state.step, 'otp');
});

test('DEV expiry control permits immediate resend without waiting for the cooldown', async () => {
  const f = fixture(); f.flow.open(); await f.flow.send('review@example.test'); f.flow.expire();
  assert.equal(f.adapter.remaining(), 0); assert.equal(await f.flow.verify(f.adapter.demoCode), false);
  assert.equal(await f.flow.resend(), true); assert.equal(await f.flow.verify(f.adapter.demoCode), true);
});

test('backtracking revokes verification and never retains passwords in flow state or adapter parameters', async () => {
  const f = fixture(); f.flow.open(); await f.flow.send('review@example.test'); await f.flow.verify(f.adapter.demoCode);
  f.flow.back(); assert.equal(f.flow.state.step, 'otp');
  await assert.rejects(f.adapter.complete(), error => error.code === 'UNVERIFIED');
  await f.flow.verify(f.adapter.demoCode);
  let argumentsSeen;
  const complete = f.adapter.complete;
  f.adapter.complete = (...args) => { argumentsSeen = args.length; return complete(); };
  await f.flow.save('fictitious', 'fictitious');
  assert.equal(argumentsSeen, 0);
  assert.ok(!Object.keys(f.flow.state).some(key => /password|code|confirmation/i.test(key)));
});

test('cancelling pending work discards late completion and reopening requires a fresh challenge', async () => {
  let release;
  const f = fixture(() => new Promise(resolve => { release = resolve; }));
  f.flow.open(); const send = f.flow.send('review@example.test');
  assert.equal(await f.flow.send('other@example.test'), false);
  f.flow.close(); release(); await send;
  assert.equal(f.flow.state.step, 'login'); assert.equal(f.adapter.remaining(), 0);
  f.flow.open(); const next = f.flow.send('review@example.test'); release(); await next;
  const verify = f.flow.verify(f.adapter.demoCode); f.flow.back(); release(); await verify;
  assert.equal(f.flow.state.step, 'email'); assert.equal(f.flow.state.busy, false); assert.equal(f.adapter.remaining(), 0);
});

test('unexpected simulator failures are visible and propagated, never success-shaped', async () => {
  const f = fixture();
  f.adapter.send = async () => { throw Error('Synthetic failure'); };
  f.flow.open();
  await assert.rejects(f.flow.send('review@example.test'), /Synthetic failure/);
  assert.equal(f.flow.state.step, 'email'); assert.equal(f.flow.state.busy, false);
  assert.match(f.flow.state.error, /Falha inesperada/);
});
