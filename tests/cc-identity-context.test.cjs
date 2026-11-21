'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// The whole real IIFE runs with an in-memory DOM/API. The test-only observation
// binding is inserted into the VM string, never exported by the product file.
const source = fs.readFileSync(path.join(__dirname, '../control-center/cc-live.js'), 'utf8');
const observed = source.replace('  (async function boot() {', `
  window.__cc = { state, unlock, relock, loadCatalog, loadTenants, loadTenantDetail,
    loadDetailAudit, loadLicenses, loadAudit, navigateTo, openCompany,
    openModal, closeModal, openInviteModal, openOwnerModal, submitOwner,
    openEditTenantModal, submitEditTenant, submitCreateTenant, executeActivateTenant, logout, handleLogin };
  (async function boot() {`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
const tenant = id => ({ id, displayName: `Fixture ${id}`, slug: id, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' });
const owner = id => ({ id, email: `${id}@example.test`, fullName: `Fixture ${id}`, platformRole: 'PLATFORM_OWNER' });

function fixture(overrides = {}) {
  const events = new Map(), nodes = new Map(), timers = new Map(), frames = [], calls = [];
  let timerId = 0, unauthenticated;
  class Node {
    constructor(id = '') {
      this.id = id; this.dataset = {}; this.hidden = false; this.disabled = false;
      this.value = ''; this.textContent = ''; this.children = []; this.parent = null;
      this.connected = true; this.selectors = new Map(); this.attributes = new Map();
      const classes = new Set();
      this.classList = { add: (...values) => values.forEach(v => classes.add(v)), remove: (...values) => values.forEach(v => classes.delete(v)), toggle: (v, on) => { if (on ?? !classes.has(v)) classes.add(v); else classes.delete(v); }, contains: v => classes.has(v) };
    }
    get isConnected() { return this.connected && (!this.parent || this.parent.isConnected); }
    set innerHTML(value) { this.html = value; this.children.forEach(n => { n.connected = false; }); this.children = []; this.selectors.clear(); }
    get innerHTML() { return this.html || ''; }
    appendChild(node) { node.parent = this; node.connected = true; this.children.push(node); return node; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector(selector) { return this.selectors.get(selector) || (selector === 'span' || selector === 'h1' ? new Node() : null); }
    querySelectorAll() { return []; }
    addEventListener(name, handler) { events.set(`${this.id}:${name}`, handler); }
    focus() {}
    closest(selector) {
      if (selector === '[data-action]' && this.dataset.action) return this;
      if (selector === '[data-view]' && this.dataset.view) return this;
      if (selector === '[data-company-tab]' && this.dataset.companyTab) return this;
      if (selector === '[data-form]' && this.dataset.form) return this;
      return this.parent?.closest(selector) || null;
    }
  }
  const node = id => { if (!nodes.has(id)) nodes.set(id, new Node(id)); return nodes.get(id); };
  node('modal').appendChild(node('modal-body')); node('modal').appendChild(node('modal-footer'));
  node('modal-layer').hidden = true;
  const document = { getElementById: node, querySelector: node, querySelectorAll: () => [],
    dispatchEvent: event => { events.get(event.type)?.(event); return true; },
    addEventListener: (name, handler) => events.set(name, handler), body: new Node('body'), activeElement: null };
  const defaults = {
    me: async () => ({ user: owner('owner-A'), authenticationSessionId: 'session-A' }),
    catalog: async () => ({ modules: [] }), adminListTenants: async () => [tenant('A'), tenant('B')],
    adminGetTenant: async id => tenant(id), adminListEntitlements: async id => [{ moduleKey: 'planning', state: 'ACTIVE', fixtureTenant: id }],
    adminTenantMemberships: async () => [], adminTenantInvitations: async () => [], adminTenantRoles: async () => [], adminListAudit: async () => [],
    adminUpdateTenant: async () => ({}), adminActivateTenant: async () => ({}),
    adminCreateTenant: async () => tenant('created'),
    adminDesignateOwner: async () => ({ status: 'ALREADY_OWNER' }), login: async () => ({ accessToken: 'synthetic-new' }),
  };
  const handlers = { ...defaults, ...overrides };
  const api = new Proxy({}, { get: (_, name) => (...args) => { calls.push({ name, args }); assert.equal(typeof handlers[name], 'function', `explicit synthetic handler ${String(name)}`); return handlers[name](...args); } });
  const Core = { api, LABELS: { tenantStatus: {}, entitlementState: {}, invitationStatus: {}, seatType: {}, platformRole: {} }, MODULE_META: {},
    friendlyError: error => error.code || 'SYNTHETIC_ERROR', apiBase: () => 'http://synthetic.invalid/core',
    onUnauthenticated: fn => { unauthenticated = fn; }, getToken: () => 'synthetic-initial',
    setToken: () => unauthenticated(), clearSession() {}, logout: async () => {}, invitationUrl: value => `https://synthetic.invalid/${value}` };
  const window = { RoutflexCore: Core, location: { replace: destination => calls.push({ name: 'navigate', destination }) }, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id), scrollTo() {} };
  const navigator = { clipboard: { writeText: async () => {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../auth-transition.js'),'utf8'),{window,document});
  vm.runInNewContext(observed, { window, document, requestAnimationFrame: fn => frames.push(fn),
    CustomEvent: class { constructor(type) { this.type = type; } },
    console: { warn() {} }, navigator,
    FormData: class { constructor(form) { this.form = form; } get(name) { return this.form.elements[name].value; } entries() { return Object.entries(this.form.elements).map(([key, input]) => [key, input.value]); } },
    fetch: () => { throw new Error('NETWORK_FORBIDDEN'); } });
  function button(action = 'execute-activate-tenant') {
    const result = new Node(); result.dataset.action = action; node('modal-footer').appendChild(result); return result;
  }
  function form(kind, tenantId, values) {
    const result = new Node(); result.dataset = { form: kind, tenantId };
    result.elements = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));
    result.reportValidity = () => true;
    node('modal-body').appendChild(result); node('modal-body').selectors.set(`[data-form="${kind}"]`, result); return result;
  }
  return { cc: window.__cc, Core, handlers, calls, nodes, node, button, form, events, frames, timers, navigator,
    invalidate: () => unauthenticated(), tickTimers: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); }, ready: flush };
}

test('licenses ignore late A success after selection B, with B positive control', async () => {
  const f = fixture(); await f.ready(); const old = deferred();
  f.handlers.adminListEntitlements = id => id === 'A' ? old.promise : Promise.resolve([{ fixtureTenant: 'B' }]);
  const pending = f.cc.loadLicenses('A'); await f.cc.loadLicenses('B'); old.resolve([{ fixtureTenant: 'A' }]); await pending;
  assert.equal(f.cc.state.licenseTenantId, 'B'); assert.equal(f.cc.state.licenseData[0].fixtureTenant, 'B');
});

test('A1 -> B -> A2 rejects old same-tenant license response', async () => {
  const f = fixture(); await f.ready(); const old = deferred(); let first = true;
  f.handlers.adminListEntitlements = id => { if (first) { first = false; return old.promise; } return Promise.resolve([{ fixtureTenant: id, revision: 2 }]); };
  const pending = f.cc.loadLicenses('A'); await f.cc.loadLicenses('B'); await f.cc.loadLicenses('A');
  old.resolve([{ fixtureTenant: 'A', revision: 1 }]); await pending;
  assert.equal(f.cc.state.licenseTenantId, 'A'); assert.equal(f.cc.state.licenseData[0].revision, 2);
});

test('late error and finally cannot replace the current loading/error state', async () => {
  const f = fixture(); await f.ready(); const old = deferred(), current = deferred();
  f.handlers.adminListEntitlements = id => id === 'A' ? old.promise : current.promise;
  const a = f.cc.loadLicenses('A'), b = f.cc.loadLicenses('B'); old.reject({ code: 'OLD_A_ERROR' }); await a;
  assert.equal(f.cc.state.licenseError, null); assert.equal(f.cc.state.licenseLoading, true);
  current.resolve([{ fixtureTenant: 'B' }]); await b; assert.equal(f.cc.state.licenseLoading, false);
});

test('same-identity tenant list request sequence keeps the newest filter result', async () => {
  const f = fixture(); await f.ready(); const old = deferred(); let count = 0;
  f.handlers.adminListTenants = () => ++count === 1 ? old.promise : Promise.resolve([tenant('B')]);
  const pending = f.cc.loadTenants(); await f.cc.loadTenants(); old.resolve([tenant('A')]); await pending;
  assert.equal(f.cc.state.tenants[0].id, 'B');
});

test('detail, membership and invitations cannot restore the previous tenant', async () => {
  const f = fixture(); await f.ready(); const old = deferred();
  f.handlers.adminGetTenant = id => id === 'A' ? old.promise : Promise.resolve(tenant(id));
  f.handlers.adminTenantMemberships = async id => [{ fixtureTenant: id }];
  f.handlers.adminTenantInvitations = async id => [{ fixtureTenant: id }];
  f.cc.openCompany('A'); f.cc.openCompany('B'); await flush(); old.resolve(tenant('A')); await flush();
  assert.equal(f.cc.state.detail.id, 'B'); assert.equal(f.cc.state.detailMemberships[0].fixtureTenant, 'B');
  assert.equal(f.cc.state.detailInvitations[0].fixtureTenant, 'B');
});

test('detail audit and reset audit requests ignore old filter responses', async () => {
  const f = fixture(); await f.ready(); const old = deferred();
  f.cc.openCompany('A'); await flush(); f.handlers.adminListAudit = () => old.promise;
  const pending = f.cc.loadDetailAudit('A'); f.cc.openCompany('B'); await flush(); old.resolve([{ id: 'audit-A' }]); await pending;
  assert.equal(f.cc.state.detailAudit, null); assert.equal(f.cc.state.detailAuditLoading, false);
  const first = deferred(); let calls = 0;
  f.handlers.adminListAudit = () => ++calls === 1 ? first.promise : Promise.resolve([{ id: 'audit-B' }]);
  f.cc.state.auditTenantFilter = 'A'; const a = f.cc.loadAudit(); f.cc.state.auditTenantFilter = 'B'; await f.cc.loadAudit();
  first.resolve([{ id: 'audit-A' }]); await a; assert.equal(f.cc.state.audit[0].id, 'audit-B');
});

test('relock clears sensitive caches, DOM, modal, identity and late animation/timer', async () => {
  const f = fixture(); await f.ready(); await f.cc.loadLicenses('A');
  f.cc.state.detailMemberships = [{ id: 'private-member' }]; f.cc.state.audit = [{ id: 'private-audit' }];
  f.cc.openModal({ title: 'Private', body: 'PRIVATE', footer: 'PRIVATE' });
  f.node('toast-region').innerHTML = 'PRIVATE'; f.node('global-search-results').innerHTML = 'PRIVATE';
  f.invalidate(); f.tickTimers(); f.frames.splice(0).forEach(fn => fn());
  assert.equal(f.cc.state.user, null); assert.equal(f.cc.state.catalog, null); assert.equal(f.cc.state.tenants.length, 0);
  for (const key of ['detail', 'detailMemberships', 'detailInvitations', 'licenseData', 'authenticationSessionId']) assert.equal(f.cc.state[key], null);
  assert.equal(f.cc.state.audit.length, 0); assert.equal(f.node('control-center').hidden, true); assert.equal(f.node('access-screen').hidden, true);
  for (const id of ['view-root', 'modal-body', 'modal-footer', 'toast-region', 'global-search-results']) assert.equal(f.node(id).innerHTML, '');
  assert.equal(f.node('cc-owner-name-pop').textContent, ''); assert.equal(f.node('modal-title').textContent, '');
});

test('relock during bootstrap enrichment prevents follow-up data requests', async () => {
  const pending = deferred(); const f = fixture({ catalog: () => pending.promise }); await flush();
  f.invalidate(); pending.resolve({ modules: [{ key: 'old-private' }] }); await flush();
  assert.equal(f.cc.state.catalog, null); assert.equal(f.calls.filter(c => c.name === 'adminListTenants').length, 0);
});

test('new identity and new session reject old pending global requests', async () => {
  for (const userId of ['owner-A', 'owner-B']) {
    const f = fixture(); await f.ready(); const old = deferred(); let count = 0;
    f.handlers.adminListTenants = () => ++count === 1 ? old.promise : Promise.resolve([tenant('new')]);
    const pending = f.cc.loadTenants(); await f.cc.unlock(owner(userId), 'new-session');
    old.resolve([tenant('old')]); await pending;
    assert.equal(f.cc.state.user.id, userId); assert.equal(f.cc.state.authenticationSessionId, 'new-session');
    assert.equal(f.cc.state.tenants[0].id, 'new');
  }
});

test('late invite-role success or error cannot reopen a closed/replaced modal', async () => {
  for (const failure of [false, true]) {
    const f = fixture(); await f.ready(); const pending = deferred(); f.handlers.adminTenantRoles = () => pending.promise;
    const open = f.cc.openInviteModal('A'); f.cc.closeModal();
    f.cc.openModal({ title: 'New modal', body: 'NEW BODY', tenantId: 'B' });
    if (failure) pending.reject({ code: 'OLD_PRIVATE_ERROR' }); else pending.resolve([{ id: 'old', key: 'TENANT_ADMIN', name: 'OLD ROLE' }]);
    await open; assert.equal(f.node('modal-body').innerHTML, 'NEW BODY'); assert.equal(f.node('modal-title').textContent, 'New modal');
  }
});

test('old modal action cannot send a mutation after context change', async () => {
  const f = fixture(); await f.ready();
  f.cc.openModal({ title: 'A', body: '', tenantId: 'A' }); const oldButton = f.button(); oldButton.dataset.tenantId = 'A';
  f.cc.openCompany('B'); await flush();
  await f.cc.executeActivateTenant('A', oldButton);
  assert.equal(f.calls.filter(c => c.name === 'adminActivateTenant').length, 0);
});

test('pending mutation completion cannot close another identity modal or refresh its state', async () => {
  const f = fixture(); await f.ready(); const pending = deferred(); f.handlers.adminActivateTenant = () => pending.promise;
  f.cc.openModal({ title: 'A', body: '', tenantId: 'A' }); const action = f.cc.executeActivateTenant('A', f.button());
  await f.cc.unlock(owner('owner-B'), 'session-B'); f.cc.openModal({ title: 'B', body: 'KEEP B', tenantId: 'B' });
  const before = f.calls.length; pending.resolve({}); await action;
  assert.equal(f.calls.length, before); assert.equal(f.node('modal-body').innerHTML, 'KEEP B'); assert.equal(f.node('toast-region').innerHTML, '');
});

test('pending mutation error cannot surface an old tenant error in a new modal', async () => {
  const f = fixture(); await f.ready(); const pending = deferred(); f.handlers.adminActivateTenant = () => pending.promise;
  f.cc.openModal({ title: 'A', body: '', tenantId: 'A' }); const action = f.cc.executeActivateTenant('A', f.button());
  f.cc.openModal({ title: 'B', body: 'KEEP B', tenantId: 'B' }); pending.reject({ code: 'OLD_A_ERROR' }); await action;
  assert.equal(f.node('modal-body').innerHTML, 'KEEP B'); assert.equal(f.node('toast-region').innerHTML, '');
});

test('current owner action retains exact target and accepts the CORE result', async () => {
  const f = fixture(); await f.ready(); f.cc.openCompany('A'); await flush(); f.cc.openOwnerModal('A');
  f.form('owner', 'A', { email: ' fixture-owner@example.test ' });
  await f.cc.submitOwner(f.button('submit-owner'));
  const calls = f.calls.filter(c => c.name === 'adminDesignateOwner');
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].args, ['A', 'fixture-owner@example.test']);
  assert.match(f.node('toast-region').innerHTML, /OWNER confirmado/); assert.equal(f.node('modal-layer').hidden, true);
});

test('current edit action preserves payload allowlist and blocks mismatched form target', async () => {
  const f = fixture(); await f.ready(); f.cc.openCompany('A'); await flush(); f.cc.openEditTenantModal('A');
  const values = { displayName: ' Fixture A ', legalName: '', taxIdType: '', taxIdValue: '', primaryCountry: 'BR', defaultLocale: 'pt-BR', defaultTimezone: 'America/Sao_Paulo', defaultCurrency: 'BRL', slug: 'forged', status: 'SUSPENDED' };
  const form = f.form('edit-tenant', 'B', values); const button = f.button('submit-edit-tenant');
  await f.cc.submitEditTenant(button); assert.equal(f.calls.filter(c => c.name === 'adminUpdateTenant').length, 0);
  form.dataset.tenantId = 'A'; await f.cc.submitEditTenant(button);
  const call = f.calls.find(c => c.name === 'adminUpdateTenant'); assert.equal(call.args[0], 'A');
  assert.equal(call.args[1].displayName, 'Fixture A'); assert.equal(call.args[1].legalName, null);
  assert.equal('slug' in call.args[1], false); assert.equal('status' in call.args[1], false);
});

test('logout clears local state immediately and reports remote failure without success', async () => {
  const f = fixture(); await f.ready(); const pending = deferred(); f.Core.logout = () => pending.promise;
  const ending = f.cc.logout(); assert.equal(f.cc.state.user, null); assert.equal(f.cc.state.tenants.length, 0); assert.equal(f.node('view-root').innerHTML, '');
  pending.reject({ code: 'NETWORK_UNREACHABLE' }); await ending;
  assert.match(f.node('authTransitionMessage').textContent, /Não foi possível confirmar a saída/);
  assert.equal(f.node('access-screen').hidden, true);assert.equal(f.node('authTransitionRetry').hidden,false); assert.equal(f.node('cc-login-submit').disabled, false);
});

test('unified entry navigation locks CC and discards the late boot identity without another login', async () => {
  const old = deferred(); let calls = 0;
  const f = fixture({ me: () => ++calls === 1 ? old.promise : Promise.resolve({ user: owner('owner-B'), authenticationSessionId: 'session-B' }) });
  await f.cc.handleLogin({ preventDefault() {} }); old.resolve({ user: owner('owner-A'), authenticationSessionId: 'session-A' }); await flush();
  assert.equal(f.cc.state.user, null);
  assert.ok(f.calls.some(c => c.name === 'navigate' && c.destination === '/?returnTo=/control-center/index.html'));
  assert.ok(!f.calls.some(c => c.name === 'login'));
});

test('events from detached or locked action elements cannot open old tenant context', async () => {
  const f = fixture(); await f.ready(); f.cc.openModal({ title: 'A', body: '', tenantId: 'A' });
  const button = f.button('open-company'); button.dataset.tenantId = 'A'; f.cc.closeModal();
  f.events.get('click')({ target: button }); assert.equal(f.cc.state.selectedTenantId, null);
  f.invalidate(); button.connected = true; f.events.get('click')({ target: button }); assert.equal(f.cc.state.selectedTenantId, null);
});

test('current invite modal accepts only its own returned roles', async () => {
  const f = fixture(); await f.ready();
  f.handlers.adminTenantRoles = async id => [{ id: `role-${id}`, key: 'TENANT_ADMIN', name: `Role ${id}` }];
  await f.cc.openInviteModal('B');
  assert.match(f.node('modal-body').innerHTML, /role-B/); assert.match(f.node('modal-body').innerHTML, /data-tenant-id="B"/);
});

test('clipboard completion from a closed invitation cannot show a stale toast', async () => {
  for (const failure of [false, true]) {
    const f = fixture(); await f.ready(); const old = deferred();
    f.navigator.clipboard.writeText = () => old.promise;
    f.cc.openModal({ title: 'A', body: '', tenantId: 'A' });
    f.node('cc-invite-token').textContent = 'synthetic-only';
    f.events.get('click')({ target: f.button('copy-invite-token') });
    f.cc.closeModal(); f.cc.openModal({ title: 'B', body: 'NEW', tenantId: 'B' });
    if (failure) old.reject(new Error('synthetic')); else old.resolve(); await flush();
    assert.equal(f.node('toast-region').innerHTML, ''); assert.equal(f.node('modal-body').innerHTML, 'NEW');
  }
});

test('late create refresh cannot navigate away from a newer modal', async () => {
  const f = fixture(); await f.ready(); const loading = deferred(); f.handlers.adminListTenants = () => loading.promise;
  f.cc.openModal({ title: 'Create', body: '' }); f.form('create-tenant', null, { slug: 'created', displayName: 'Created', status: 'ACTIVE' });
  const pending = f.cc.submitCreateTenant(f.button('submit-create-tenant')); await flush();
  f.cc.openModal({ title: 'New decision', body: 'KEEP' }); loading.resolve([tenant('created')]); await pending;
  assert.equal(f.cc.state.selectedTenantId, null); assert.equal(f.node('modal-body').innerHTML, 'KEEP');
});

test('terminal invalidation before boot result prevents a late identity unlock', async () => {
  const old = deferred(); const f = fixture({ me: () => old.promise });
  f.invalidate(); old.resolve({ user: owner('owner-A'), authenticationSessionId: 'session-A' }); await flush();
  assert.equal(f.cc.state.user, null); assert.equal(f.node('control-center').hidden, true);
  assert.equal(f.calls.filter(call => call.name === 'catalog').length, 0);
});
