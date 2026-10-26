const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Execute the production routines in memory. No browser, network, credentials or product hooks.
const source = fs.readFileSync(path.join(__dirname, '..', 'workspace.js'), 'utf8');
const routines = [...source.matchAll(/^  (?:async )?function (\w+)\(/gm)].map((match) => {
  const end = /^  \}\r?$/gm;
  end.lastIndex = match.index;
  const closing = end.exec(source);
  assert.ok(closing, `routine ${match[1]} is complete`);
  return source.slice(match.index, closing.index + closing[0].length);
}).join('\n');
const PERM = vm.runInNewContext(`(${source.match(/  const PERM = (\{[\s\S]*?^  \});/m)[1]})`);
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';
const MEMBER_A = '55555555-5555-4555-8555-555555555555';
const MEMBER_B = '66666666-6666-4666-8666-666666666666';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function me(userId = USER, sessionId = SESSION) {
  return { user: { id: userId, fullName: 'Synthetic User', email: 'synthetic@example.test' }, authenticationSessionId: sessionId,
    tenants: [{ id: A, membershipId: MEMBER_A }, { id: B, membershipId: MEMBER_B }] };
}
function tenantContext(id, version = 'new') {
  return { tenant: { id, slug: id, status: 'ACTIVE' }, membership: { id: id === A ? MEMBER_A : MEMBER_B, status: 'ACTIVE' },
    permissions: Object.values(PERM), roles: [{ id: version, key: version }], modules: [], units: [], version };
}
function node() {
  let content = '';
  const classes = new Set();
  const listeners = new Map();
  return {
    listeners, addEventListener(type, fn) { listeners.set(type, fn); },
    hidden: false, value: '', dataset: {}, connected: true, disabled: false,
    get innerHTML() { return content; }, set innerHTML(value) { content = String(value); },
    get textContent() { return content; }, set textContent(value) { content = String(value); },
    classList: { add: (...items) => items.forEach((item) => classes.add(item)), remove: (...items) => items.forEach((item) => classes.delete(item)), contains: (item) => classes.has(item) },
    setAttribute(key, value) { this[key] = value; }, focus() { this.focused = true; },
    removeAttribute(key) { delete this[key]; },
    contains(other) { return other === this || other?.parent === this; },
    querySelector() { return null; }, closest() { return this.card || null; },
  };
}
function fixture(overrides = {}) {
  const nodes = new Map(), timers = new Map(), calls = [], rendered = [];
  const $ = (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const state = { generation: 0, loads: Object.create(null), modalScope: null, me: me(), tenantId: A, context: tenantContext(A),
    catalog: { modules: [], seatTypes: [] }, memberships: [], roles: [], invitations: [], seats: [], entitlements: [], audit: [], tenantRecord: null };
  let timerId = 0;
  const storage = new Map();
  const context = {
    state, $, PERM, Map, Set, Symbol, console,
    api: { catalog: async () => ({ modules: [], seatTypes: [] }), me: async () => me(), meContext: async (id) => tenantContext(id),
      tenantMemberships: async () => [], tenantRoles: async () => [], tenantInvitations: async () => [],
      tenantSeats: async () => [], tenantEntitlements: async () => [], tenantAudit: async () => [], tenantGet: async (id) => ({ id }), ...overrides },
    Core: { friendlyError: (error) => error.message || error.code, invitationUrl: (token, tenantId) => `${tenantId}/${token}` },
    document: { contains: (target) => target.connected !== false, activeElement: null,
      querySelectorAll: (selector) => selector.includes('inviteRole') ? [{ value: 'role-a' }] : [], getElementById: $ },
    window: { sessionStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
      setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; }, clearTimeout: (id) => timers.delete(id) },
    STORAGE_TENANT: 'synthetic-selection', LABELS: { tenantStatus: {}, membershipStatus: {} }, MODULE_META: {},
    TENANT_TONE: {}, toastTimer: null, modalOpener: null, routexActivationTimer: null,
    pendingUiTimers: new Set(), routexReduceMotion: true, routexWelcome: '',
    authView: $('authView'), workspaceShell: $('workspaceShell'), loginForm: $('loginForm'), loginError: $('loginError'),
    tenantPicker: $('tenantPicker'), tenantList: $('tenantList'), toastRegion: $('wsToastRegion'),
    wsModal: $('wsModal'), wsModalTitle: $('wsModalTitle'), wsModalBody: $('wsModalBody'), wsModalActions: $('wsModalActions'),
    routexPanel: $('routexPanel'), routexTrigger: $('routexTrigger'), routexConversation: $('routexConversation'), routexQuestion: $('routexQuestion'),
  };
  context.loginForm.card = node();
  context.wsModal.hidden = true;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../auth-transition.js'),'utf8'), context);
  context.transition = context.window.RoutflexTransition.create({render:context.window.RoutflexTransition.panel()});
  context.window.location = {replace: value => calls.push(['navigate',value]),reload(){}};
  vm.runInContext(routines, context);
  context.loadSecondaryData = () => {};
  context.renderContext = () => { rendered.push({ tenant: state.tenantId, version: state.context.version }); $('tenantName').textContent = state.context.version; };
  for (const [routine, key] of [['renderTeam', 'memberships'], ['renderInvitations', 'invitations'], ['renderSeats', 'seats'], ['renderSecurity', 'audit'], ['renderSettings', 'tenantRecord']]) {
    context[routine] = () => rendered.push({ tenant: state.tenantId, key, value: state[key] });
  }
  context.toast = (message) => calls.push(['toast', message]);
  context.appendRoutexMessage = () => {};
  context.appendRoutexProcessing = () => ({ remove() {} });
  context.renderRoutexAnswer = (topic) => calls.push(['routex', topic]);
  return { c: context, state, $, calls, rendered, timers, storage };
}

test('A → B discards a late context response', async () => {
  const old = deferred();
  const f = fixture({ meContext: (id) => id === A ? old.promise : Promise.resolve(tenantContext(id)) });
  const pending = f.c.selectTenant(A);
  await f.c.selectTenant(B);
  old.resolve(tenantContext(A, 'old'));
  await pending;
  assert.equal(f.state.tenantId, B);
  assert.equal(f.state.context.tenant.id, B);
  assert.deepEqual(f.rendered.map((r) => r.tenant), [B]);
});

test('A1 → B → A2 does not restore old membership roles from A1', async () => {
  const old = deferred(); let requests = 0;
  const f = fixture({ meContext: (id) => id === A && ++requests === 1 ? old.promise : Promise.resolve(tenantContext(id, 'VIEWER')) });
  const pending = f.c.selectTenant(A);
  await f.c.selectTenant(B); await f.c.selectTenant(A);
  old.resolve(tenantContext(A, 'TENANT_ADMIN'));
  await pending;
  assert.equal(f.state.context.version, 'VIEWER');
  assert.deepEqual(f.rendered.map((r) => r.version), ['VIEWER', 'VIEWER']);
});

test('obsolete context/catalog errors cannot block or overwrite a newer selection', async () => {
  for (const stage of ['catalog', 'context']) {
    const old = deferred(); let calls = 0;
    const f = fixture(stage === 'catalog' ? { catalog: () => ++calls === 1 ? old.promise : Promise.resolve({ modules: [] }) }
      : { meContext: (id) => id === A ? old.promise : Promise.resolve(tenantContext(id)) });
    if (stage === 'catalog') f.state.catalog = null;
    const pending = f.c.selectTenant(A);
    await f.c.selectTenant(B);
    old.reject({ code: 'MEMBERSHIP_NOT_ACTIVE' });
    await pending;
    assert.equal(f.state.context.tenant.id, B);
    assert.equal(f.state.blocked, null);
    assert.equal(f.$('wsBanner').textContent, '');
  }
});

test('context must match both selected tenant and authenticated membership', async () => {
  for (const wrong of [tenantContext(B), { ...tenantContext(A), membership: { id: MEMBER_B } }]) {
    const f = fixture({ meContext: async () => wrong });
    await f.c.selectTenant(A);
    assert.equal(f.state.context, null);
    assert.equal(f.rendered.length, 0);
    assert.match(f.$('wsBanner').textContent, /não corresponde/);
  }
});

test('tenant selection outside /me is rejected before any API request', async () => {
  const f = fixture({ meContext: () => assert.fail('unlisted tenant cannot be requested') });
  await f.c.selectTenant('77777777-7777-4777-8777-777777777777');
  assert.equal(f.state.tenantId, A);
});

const loaders = [
  ['loadTeam', 'tenantMemberships', 'memberships', [{ membershipId: MEMBER_A }]],
  ['loadInvitations', 'tenantInvitations', 'invitations', [{ id: 'invite-a' }]],
  ['loadSeats', 'tenantSeats', 'seats', [{ moduleKey: 'planning' }]],
  ['loadSecurity', 'tenantAudit', 'audit', [{ id: 'audit-a' }]],
  ['loadSettings', 'tenantGet', 'tenantRecord', { id: A }],
];
for (const [loader, apiName, key, value] of loaders) {
  test(`${loader}: late A success/error cannot replace B cache or DOM`, async () => {
    for (const failure of [false, true]) {
      const old = deferred(); const f = fixture({ [apiName]: (id) => id === A ? old.promise : Promise.resolve(value) });
      const pending = f.c[loader]();
      await f.c.selectTenant(B);
      await f.c[loader]();
      const before = JSON.stringify(f.rendered);
      const cache = f.state[key];
      if (failure) old.reject({ code: 'OLD_ERROR' }); else old.resolve({ obsolete: true });
      await pending;
      assert.equal(f.state[key], cache);
      assert.equal(JSON.stringify(f.rendered), before);
    }
  });
  test(`${loader}: latest retry wins within the same tenant generation`, async () => {
    const old = deferred(); let requests = 0;
    const f = fixture({ [apiName]: () => ++requests === 1 ? old.promise : Promise.resolve(value) });
    const pending = f.c[loader](); await f.c[loader]();
    old.resolve({ obsolete: true }); await pending;
    assert.equal(f.state[key], value);
  });
}

test('identity or AuthenticationSession replacement discards an outstanding loader', async () => {
  for (const nextMe of [me('77777777-7777-4777-8777-777777777777'), me(USER, '88888888-8888-4888-8888-888888888888')]) {
    const old = deferred(); const f = fixture({ tenantMemberships: () => old.promise });
    const pending = f.c.loadTeam();
    f.state.me = nextMe;
    old.resolve([{ membershipId: MEMBER_A }]); await pending;
    assert.equal(f.state.memberships, null);
    assert.equal(f.rendered.length, 0);
  }
});

test('showAuth removes caches, DOM, modal, tenant selection and deferred UI residue', async () => {
  const old = deferred(); const f = fixture({ tenantMemberships: () => old.promise });
  const pending = f.c.loadTeam();
  f.state.roles = [{ key: 'TENANT_ADMIN' }]; f.state.seats = [{ id: 'private-seat' }];
  f.state.invitations = [{ id: 'private-invite' }]; f.state.audit = [{ id: 'private-audit' }];
  for (const id of ['teamContent', 'licenseContent', 'invitesBlock', 'settingsContent', 'wsBanner', 'sessionUserEmail', 'routexConversation']) f.$(id).textContent = 'private residue';
  f.c.openModal({ title: 'Private invitation', body: 'synthetic-invitation-link' });
  f.c.queueRoutexAnswer('usuarios'); f.$('routexQuestion').value = 'private question';
  f.c.showAuth('ended');
  old.resolve([{ membershipId: MEMBER_A }]); await pending;
  for (const key of ['me', 'tenantId', 'context', 'catalog', 'memberships', 'roles', 'seats', 'entitlements', 'invitations', 'audit', 'tenantRecord', 'modalScope']) assert.equal(f.state[key], null, key);
  for (const id of ['teamContent', 'licenseContent', 'invitesBlock', 'settingsContent', 'wsBanner', 'sessionUserEmail', 'routexConversation', 'wsModalBody', 'wsModalTitle']) assert.equal(f.$(id).textContent, '', id);
  assert.equal(f.$('wsModal').hidden, true); assert.equal(f.$('workspaceShell').hidden, true);
  assert.equal(f.$('routexQuestion').value, ''); assert.equal(f.timers.size, 0);
  assert.equal(f.rendered.length, 0);
});

test('picker clears tenant residue while retaining only authenticated identity', () => {
  const f = fixture(); const identity = f.state.me;
  f.state.memberships = [{ membershipId: MEMBER_A }];
  f.c.showPicker();
  assert.equal(f.state.me, identity); assert.equal(f.state.tenantId, null);
  assert.equal(f.state.memberships, null); assert.equal(f.$('workspaceShell').hidden, true);
});

test('a delayed /me cannot restore an identity after local lock', async () => {
  const old = deferred(); const f = fixture({ me: () => old.promise });
  const pending = f.c.loadMe(); f.c.showAuth('ended'); old.resolve(me()); await pending;
  assert.equal(f.state.me, null); assert.equal(f.$('workspaceShell').hidden, true);
});

test('a late /me error is discarded after a newer identity is selected', async () => {
  const old = deferred(); const f = fixture({ me: () => old.promise });
  const pending = f.c.loadMe(); f.c.invalidateContext(true); f.state.me = me('77777777-7777-4777-8777-777777777777');
  old.reject({ code: 'OLD_ERROR' }); await pending;
  assert.equal(f.state.me.user.id, '77777777-7777-4777-8777-777777777777');
});

const writes = [
  ['changeMemberRole', 'tenantGrantRole', [MEMBER_A, 'role-a', true, {}]],
  ['assignSeat', 'tenantAssignSeat', [MEMBER_A]],
  ['releaseSeat', 'tenantReleaseSeat', [MEMBER_A, 'seat-a']],
  ['confirmSuspendMember', 'tenantSuspendMember', [MEMBER_A]],
  ['reactivateMember', 'tenantReactivateMember', [MEMBER_A]],
  ['confirmRevokeInvite', 'tenantRevokeInvitation', ['invite-a']],
  ['submitInvite', 'tenantCreateInvitation', []],
];
for (const [routine, apiName, args] of writes) {
  test(`${routine}: captured tenant is used and late completion/error cannot affect B`, async () => {
    for (const failure of [false, true]) {
      const old = deferred(), requests = [];
      const f = fixture({ [apiName]: (...payload) => { requests.push(payload); return old.promise; } });
      f.state.memberships = [{ membershipId: MEMBER_A, user: { id: 'other-user' }, seats: [] }];
      f.$('seatModule').value = 'planning'; f.$('seatTypeSelect').value = 'OPERATOR_SEAT';
      f.$('suspendReason').value = 'synthetic reason'; f.$('inviteEmail').value = 'synthetic@example.test';
      f.c.openModal({ title: 'A operation', body: 'A' });
      const pending = f.c[routine](...args);
      await f.c.selectTenant(B);
      f.c.openModal({ title: 'B modal', body: 'B content' });
      const before = f.calls.length;
      if (failure) old.reject({ code: 'OLD_ERROR' }); else old.resolve({ token: 'synthetic-link', invitation: {} });
      await pending;
      assert.equal(requests.length, 1); assert.equal(requests[0][0], A);
      assert.equal(f.calls.length, before); assert.equal(f.$('wsModalBody').textContent, 'B content');
      assert.equal(f.state.context.tenant.id, B);
    }
  });
}

test('closing an invitation modal discards its late token instead of reopening it', async () => {
  const old = deferred(); const f = fixture({ tenantCreateInvitation: () => old.promise });
  f.$('inviteEmail').value = 'synthetic@example.test'; f.c.openModal({ title: 'Invite', body: 'Form' });
  const pending = f.c.submitInvite(); f.c.closeModal();
  old.resolve({ token: 'synthetic-invitation-link', invitation: {} }); await pending;
  assert.equal(f.$('wsModal').hidden, true); assert.equal(f.$('wsModalBody').textContent, '');
});

test('delegated actions reject detached buttons, stale modals and foreign IDs', () => {
  const f = fixture();
  f.state.memberships = [{ membershipId: MEMBER_A, user: { id: 'other-user' }, seats: [] }];
  f.state.roles = [{ id: 'role-a' }];
  f.c.openModal({ title: 'Roles', body: 'Form' });
  const button = node(); button.parent = f.$('wsModal');
  button.dataset = { action: 'grant-role', membershipId: MEMBER_A, roleId: 'role-a' };
  assert.equal(f.c.actionAllowed(button), true);
  button.connected = false; assert.equal(f.c.actionAllowed(button), false); button.connected = true;
  button.dataset.membershipId = MEMBER_B; assert.equal(f.c.actionAllowed(button), false); button.dataset.membershipId = MEMBER_A;
  f.state.context.permissions = []; assert.equal(f.c.actionAllowed(button), false);
  f.state.context.permissions = Object.values(PERM); f.state.generation += 1;
  assert.equal(f.c.actionAllowed(button), false);
});

test('self role or seat change reloads context and removes permissions-dependent residue', async () => {
  for (const [routine, apiName, args] of writes.slice(0, 3)) {
    const f = fixture({ [apiName]: async () => ({}), meContext: async () => ({ ...tenantContext(A), permissions: [] }) });
    f.state.memberships = [{ membershipId: MEMBER_A, user: { id: USER }, seats: [] }];
    f.$('seatModule').value = 'planning'; f.$('seatTypeSelect').value = 'OPERATOR_SEAT';
    f.c.openModal({ title: 'Self change', body: 'Old permissions' });
    const generation = f.state.generation;
    await f.c[routine](...args);
    assert.ok(f.state.generation > generation); assert.equal(f.state.context.permissions.length, 0);
    assert.equal(f.state.memberships, null); assert.equal(f.$('wsModalBody').textContent, '');
  }
});

test('logout clears identity and UI immediately, even while remote revocation is pending or fails', async () => {
  for (const failure of [false, true]) {
    const remote = deferred(), old = deferred(); const f = fixture({ tenantMemberships: () => old.promise });
    f.c.logoutPending = false;
    f.c.console = { warn() {} };
    f.c.Core.logout = () => remote.promise;
    f.c.Core.clearSession = () => f.calls.push(['clearSession']);
    f.storage.set('preserved-planning-draft', 'synthetic-work');
    const load = f.c.loadTeam(); const logout = f.c.doLogout();
    assert.equal(f.state.me, null); assert.equal(f.state.context, null);
    assert.equal(f.$('workspaceShell').hidden, true);
    old.resolve([{ membershipId: MEMBER_A }]); await load;
    if (failure) remote.reject({ code: 'OFFLINE' }); else remote.resolve();
    await logout;
    assert.equal(f.state.memberships, null); assert.equal(f.c.logoutPending, false);
    assert.equal(f.storage.get('preserved-planning-draft'), 'synthetic-work');
    assert.equal(f.$('authView').hidden, true);
    assert.equal(f.c.transition.phase, failure ? 'invalid' : 'navigating');
    assert.equal(f.calls.filter(([call]) => call === 'navigate').length, failure ? 0 : 1);
  }
});

test('even an already-queued ROUTEX callback cannot restore old context after invalidation', () => {
  const f = fixture(); f.c.queueRoutexAnswer('usuarios');
  const callbacks = [...f.timers.values()];
  f.c.showAuth('ended'); callbacks.forEach((fn) => fn());
  assert.equal(f.calls.filter(([call]) => call === 'routex').length, 0);
});

async function fullPage(apiOverrides = {}) {
  const f = fixture(apiOverrides), listeners = new Map();
  let ended = () => {}, token = 'synthetic-access';
  f.c.document.addEventListener = (name, fn) => {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
  };
  f.c.document.querySelectorAll = () => [];
  f.c.document.querySelector = () => null;
  f.c.window.matchMedia = () => ({ matches: true });
  f.c.Core.api = f.c.api; f.c.Core.LABELS = f.c.LABELS; f.c.Core.MODULE_META = {};
  f.c.Core.moduleLinks = () => ({});
  f.c.Core.demoRequested = () => false;
  f.c.Core.getToken = () => token;
  f.c.Core.setToken = (next) => { if (token) ended(); token = next; };
  f.c.Core.onUnauthenticated = (fn) => { ended = fn; };
  f.c.window.RoutflexCore = f.c.Core;
  f.c.window.RoutflexDestination = { resolve: async () => ({ kind: 'workspace' }) };
  f.c.window.location = { replace: destination => f.calls.push(['navigate', destination]) };
  f.storage.set('routflex.core.tenantId', A);
  // Instrument only the VM copy. No exports/hooks are added to the product file.
  const executable = source.replace('  (async function boot() {', '  globalThis.workspace = { state, showAuth, loadMe, selectTenant };\n  globalThis.boot = (async function boot() {');
  vm.runInContext(executable, f.c);
  await f.c.boot;
  await Promise.resolve(); await Promise.resolve();
  return { ...f, state: f.c.workspace.state, ended: () => ended(), getToken: () => token, listeners };
}

test('full Workspace boot renders the canonical DTO and unauthenticated callback clears it', async () => {
  const f = await fullPage();
  assert.equal(f.state.context.tenant.id, A);
  assert.equal(f.$('workspaceShell').hidden, false);
  assert.match(f.$('sessionUserEmail').textContent, /synthetic/);
  f.ended();
  assert.equal(f.state.me, null); assert.equal(f.state.context, null);
  assert.equal(f.$('sessionUserEmail').textContent, ''); assert.equal(f.$('workspaceShell').hidden, true);
});

test('Workspace delegates credential entry to Landing without a second authentication request', async () => {
  let logins=0;
  const f = await fullPage({ login: async () => { logins++; } });
  f.c.workspace.showAuth();
  await f.$('loginForm').listeners.get('submit')({ preventDefault() {} });
  assert.equal(logins,0);assert.equal(f.getToken(),'synthetic-access');
  assert.ok(f.calls.some(([name,destination])=>name==='navigate'&&destination==='/?returnTo=/workspace.html'));
});

test('field-only identity bypasses Workspace without rendering administrative cards', async () => {
  const f=await fullPage();f.c.workspace.showAuth();
  f.c.window.RoutflexDestination.resolve=async()=>({kind:'palm',href:'http://localhost:5173/palm'});
  await f.c.workspace.loadMe();
  assert.equal(f.$('workspaceShell').hidden,true);
  assert.ok(f.calls.some(([name,destination])=>name==='navigate'&&destination==='http://localhost:5173/palm'));
});
