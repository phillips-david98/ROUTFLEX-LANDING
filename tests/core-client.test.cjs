const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'core-client.js'), 'utf8');
const USER_A = '11111111-1111-4111-8111-111111111111';
const SESSION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('Planning capabilities use tenant-scoped GET/PUT and exactly the three controls', async () => {
  const calls = [];
  const { Core } = client(async (url, options) => { calls.push({ url, options }); return reply(200, {}); });
  Core.setToken('owner-access');
  await Core.api.tenantPlanningCapabilities('tenant-a', 'member-a');
  await Core.api.tenantSetPlanningCapabilities('tenant-a', 'member-a', { edit: true, import: false, export: true });
  assert.deepEqual(calls.map(({ url, options }) => [new URL(url).pathname, options.method]), [
    ['/core/tenants/tenant-a/memberships/member-a/planning-capabilities', 'GET'],
    ['/core/tenants/tenant-a/memberships/member-a/planning-capabilities', 'PUT'],
  ]);
  assert.deepEqual(JSON.parse(calls[1].options.body), { edit: true, import: false, export: true });
  assert.ok(calls.every(({ options }) => options.headers.Authorization === 'Bearer owner-access'));
});
function identity(tenants = []) {
  return { user: { id: USER_A, status: 'ACTIVE' }, authenticationSessionId: SESSION_A, tenants };
}

test('contratos administrativos usam autoridade e tenant da rota, sem conceder roles no browser', async () => {
  const calls = [];
  const { Core } = client(async (url, options) => { calls.push({ url, options }); return reply(200, {}); });
  Core.setToken('admin-access');
  await Core.api.adminUpdateTenant('tenant-a', { displayName: 'Empresa A' });
  await Core.api.adminActivateTenant('tenant-a');
  await Core.api.adminDesignateOwner('tenant-a', 'owner@example.test');
  await Core.api.adminTenantRoles('tenant-a');
  await Core.api.adminTenantMemberships('tenant-a');
  await Core.api.adminTenantInvitations('tenant-a');
  await Core.api.adminRevokeInvitation('tenant-a', 'invite-a');
  assert.deepEqual(calls.map(({ url, options }) => [new URL(url).pathname, options.method]), [
    ['/core/admin/tenants/tenant-a', 'PATCH'], ['/core/admin/tenants/tenant-a/activate', 'POST'],
    ['/core/admin/tenants/tenant-a/owner', 'POST'], ['/core/admin/tenants/tenant-a/roles', 'GET'],
    ['/core/admin/tenants/tenant-a/memberships', 'GET'], ['/core/admin/tenants/tenant-a/invitations', 'GET'],
    ['/core/admin/tenants/tenant-a/invitations/invite-a/revoke', 'POST'],
  ]);
  assert.deepEqual(JSON.parse(calls[2].options.body), { email: 'owner@example.test' });
  assert.ok(calls.every(({ options }) => options.headers.Authorization === 'Bearer admin-access' && options.credentials === 'omit'));
});

test('preview e aceite públicos enviam token só no corpo e tenant esperado', async () => {
  const calls = [];
  const { Core } = client(async (url, options) => { calls.push({ url, options }); return reply(200, {}); });
  await Core.api.previewInvitation('test-invite-token', 'tenant-a');
  await Core.api.acceptInvitation({ token: 'test-invite-token', tenantId: 'tenant-a' });
  assert.deepEqual(calls.map(({ url }) => new URL(url).pathname), ['/core/invitations/preview', '/core/invitations/accept']);
  for (const { url, options } of calls) {
    assert.equal(new URL(url).search, '');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(JSON.parse(options.body), { token: 'test-invite-token', tenantId: 'tenant-a' });
  }
});

test('links de convite conservam origem e usam apenas fragmento, no Workspace e Control Center', () => {
  for (const href of ['https://app.example.test/workspace.html?demo=1', 'https://app.example.test/control-center/index.html']) {
    const { Core } = client(async () => reply(200), { href });
    const url = new URL(Core.invitationUrl('test-invite-token', 'tenant-a'));
    assert.equal(url.origin, 'https://app.example.test');
    assert.equal(url.pathname, '/invitation.html');
    assert.equal(url.search, '');
    assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), 'test-invite-token');
    assert.equal(new URLSearchParams(url.hash.slice(1)).get('tenantId'), 'tenant-a');
  }
});

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function reply(status, body = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => body === null ? '' : JSON.stringify(body),
  };
}

function client(fetch, { sessionStorage = storage(), localStorage = storage(), search = '', href = 'http://localhost:5500/workspace.html', clock = Date } = {}) {
  const window = {
    sessionStorage,
    localStorage,
    location: { search, href },
  };
  vm.runInNewContext(source, { window, fetch, URL, URLSearchParams, console, Date: clock });
  return { Core: window.RoutflexCore, window, sessionStorage };
}

test('logout and explicit local clearing notify immediately, before remote logout settles', async () => {
  let resolveLogout, notifications = 0;
  const { Core } = client(() => new Promise(resolve => { resolveLogout = resolve; }));
  Core.setToken('synthetic-access');
  Core.onUnauthenticated(() => notifications++);
  const pending = Core.logout();
  assert.equal(Core.getToken(), null);
  assert.equal(notifications, 1);
  resolveLogout(reply(204)); await pending;
  assert.equal(notifications, 1);
  Core.setToken('synthetic-next'); Core.clearSession();
  assert.equal(notifications, 2);
});

test('recovery cancellation is passed to fetch and prevents a retry or late result', async () => {
  const controller = new AbortController(), calls = [];
  let finish;
  const { Core } = client((url, options) => {
    calls.push({ url, options });
    return new Promise(resolve => { finish = resolve; });
  });
  Core.setToken('synthetic-access');
  const pending = Core.api.recoveryContactRequest('synthetic@example.test', 'synthetic-only', { signal: controller.signal });
  assert.equal(calls[0].options.signal, controller.signal);
  controller.abort(); finish(reply(401));
  await assert.rejects(pending, error => error.code === 'REQUEST_ABORTED');
  assert.equal(calls.length, 1);
  await assert.rejects(Core.api.recoveryContactVerify('synthetic', '000000', { signal: controller.signal }), error => error.code === 'REQUEST_ABORTED');
  assert.equal(calls.length, 1);
});

test('cancelling a recovery request waiting for shared refresh cannot submit afterwards', async () => {
  const controller = new AbortController(), calls = [];
  let finish;
  const { Core } = client(url => {
    calls.push(new URL(url).pathname);
    return new Promise(resolve => { finish = resolve; });
  });
  const pending = Core.api.recoveryContactRequest('synthetic@example.test', 'synthetic-only', { signal: controller.signal });
  controller.abort(); finish(reply(200, { accessToken: 'synthetic-access' }));
  await assert.rejects(pending, error => error.code === 'REQUEST_ABORTED');
  assert.deepEqual(calls, ['/core/auth/refresh']);
});

test('a session deadline beyond the browser timeout limit rearms until the actual deadline', async () => {
  let now = Date.now(), ended = 0, timerId = 0;
  const expiry = now + 31 * 24 * 60 * 60 * 1000, timers = new Map();
  class Clock extends Date { static now() { return now; } }
  const { Core, window } = client(async () => reply(200, { ...identity(), authenticationSessionExpiresAt: new Date(expiry).toISOString() }), { clock: Clock });
  window.setTimeout = (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; };
  window.clearTimeout = id => timers.delete(id);
  Core.setToken('synthetic-access'); Core.onUnauthenticated(() => ended++); await Core.api.me();
  let timer = [...timers.values()][0]; assert.equal(timer.ms, 2147483647);
  now += timer.ms; timer.callback();
  assert.equal(ended, 0); assert.equal(timers.size, 1);
  timer = [...timers.values()][0]; assert.equal(timer.ms, expiry - now);
  now += timer.ms; timer.callback();
  assert.equal(ended, 1); assert.equal(Core.getToken(), null); assert.equal(timers.size, 0);
});

test('login envia credenciais e recebe access sem expor refresh ao JavaScript', async () => {
  const calls = [];
  const { Core } = client(async (url, options) => {
    calls.push({ url, options });
    return reply(201, { accessToken: 'access-a' });
  });
  const session = await Core.api.login('user@example.test', 'senha-de-teste');
  Core.setToken(session.accessToken);

  assert.equal(calls[0].url, 'http://localhost:3100/core/auth/login');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'include');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    email: 'user@example.test', password: 'senha-de-teste',
  });
  assert.equal(Core.getToken(), 'access-a');
});

test('login invalido nao cria estado autenticado', async () => {
  const { Core } = client(async () => reply(401, {
    error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais invalidas.' },
  }));
  await assert.rejects(Core.api.login('bad@example.test', 'errada'),
    (error) => error.status === 401 && error.code === 'INVALID_CREDENTIALS');
  assert.equal(Core.getToken(), null);
});

test('401 do access faz um refresh e repete a request apenas uma vez', async () => {
  const calls = [];
  const { Core } = client(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/refresh')) return reply(200, { accessToken: 'access-b' });
    return options.headers.Authorization === 'Bearer access-a'
      ? reply(401, { error: { code: 'UNAUTHENTICATED' } })
      : reply(200, identity());
  });
  Core.setToken('access-a');
  assert.equal((await Core.api.me()).user.id, USER_A);
  assert.equal(Core.getToken(), 'access-b');
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname),
    ['/core/me', '/core/auth/refresh', '/core/me']);
  assert.deepEqual(calls.map((call) => call.options.credentials),
    ['omit', 'include', 'omit']);
});

test('F5 sem access restaura sessao por refresh antes de /me e contexto', async () => {
  const calls = [];
  const { Core } = client(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/refresh')) return reply(200, { accessToken: 'restored' });
    if (url.endsWith('/me')) return reply(200, identity([{ id: 't1' }]));
    return reply(200, { tenant: { id: 't1' } });
  });
  const me = await Core.api.me();
  const context = await Core.api.meContext(me.tenants[0].id);
  assert.equal(context.tenant.id, 't1');
  assert.equal(Core.getToken(), 'restored');
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname),
    ['/core/auth/refresh', '/core/me', '/core/me/context/t1']);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer restored');
});

test('refresh invalido encerra estado local e informa listeners', async () => {
  let ended = 0;
  let rotations = 0;
  const { Core } = client(async (url) => {
    if (url.endsWith('/auth/refresh')) {
      rotations++;
      return reply(401, { error: { code: 'INVALID_REFRESH_TOKEN' } });
    }
    return reply(401, { error: { code: 'UNAUTHENTICATED' } });
  });
  Core.setToken('stale');
  Core.onUnauthenticated(() => { ended++; });
  await assert.rejects(Core.api.me(), (error) => error.status === 401);
  assert.equal(Core.getToken(), null);
  assert.equal(ended, 1);
  assert.equal(rotations, 1);
});

test('logout chama CORE com cookie e limpa access mesmo com falha remota', async () => {
  for (const fail of [false, true]) {
    const calls = [];
    const { Core } = client(async (url, options) => {
      calls.push({ url, options });
      if (fail) throw new Error('offline');
      return reply(204);
    });
    Core.setToken('access-a');
    if (fail) await assert.rejects(Core.logout(), (error) => error.code === 'NETWORK_UNREACHABLE');
    else await Core.logout();
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, '/core/auth/logout');
    assert.equal(calls[0].options.credentials, 'include');
    assert.equal(Core.getToken(), null);
  }
});

test('falha de logout bloqueia F5 e tenta revogar antes de restaurar ou relogar', async () => {
  const sharedLocal = storage();
  const first = client(async () => { throw new Error('offline'); }, { localStorage: sharedLocal });
  first.Core.setToken('old');
  await assert.rejects(first.Core.logout(), (error) => error.code === 'NETWORK_UNREACHABLE');
  assert.equal(first.Core.getToken(), null);
  assert.equal(sharedLocal.getItem('routflex.core.logoutPending'), '1');

  const calls = [];
  const afterF5 = client(async (url) => {
    calls.push(new URL(url).pathname);
    return reply(204);
  }, { localStorage: sharedLocal });
  await assert.rejects(afterF5.Core.api.me(), (error) => error.status === 401);
  assert.deepEqual(calls, ['/core/auth/logout']);
  assert.equal(sharedLocal.getItem('routflex.core.logoutPending'), null);
});

test('novo login apos falha de logout primeiro revoga o cookie anterior', async () => {
  const sharedLocal = storage();
  const first = client(async () => { throw new Error('offline'); }, { localStorage: sharedLocal });
  await assert.rejects(first.Core.logout());

  const calls = [];
  const later = client(async (url) => {
    calls.push(new URL(url).pathname);
    return url.endsWith('/auth/login')
      ? reply(201, { accessToken: 'new' })
      : reply(204);
  }, { localStorage: sharedLocal });
  const session = await later.Core.api.login('user@example.test', 'senha-de-teste');
  assert.equal(session.accessToken, 'new');
  assert.deepEqual(calls, ['/core/auth/logout', '/core/auth/login']);
  assert.equal(sharedLocal.getItem('routflex.core.logoutPending'), null);
});

test('tres requests com 401 compartilham uma rotacao', async () => {
  let rotations = 0;
  let retries = 0;
  const { Core } = client(async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      rotations++;
      return reply(200, { accessToken: 'new' });
    }
    if (options.headers.Authorization === 'Bearer old') {
      return reply(401, { error: { code: 'UNAUTHENTICATED' } });
    }
    retries++;
    return reply(200, url.endsWith('/me') ? identity() : { ok: true });
  });
  Core.setToken('old');
  await Promise.all([Core.api.me(), Core.api.catalog(), Core.api.meContext('t1')]);
  assert.equal(rotations, 1);
  assert.equal(retries, 3);
});

test('401 atrasados apos refresh invalido nao iniciam novas rotacoes', async () => {
  let rotations = 0;
  const { Core } = client(async (url) => {
    if (url.endsWith('/auth/refresh')) {
      rotations++;
      return reply(401, { error: { code: 'INVALID_REFRESH_TOKEN' } });
    }
    return reply(401, { error: { code: 'UNAUTHENTICATED' } });
  });
  Core.setToken('old');
  await Promise.allSettled([Core.api.me(), Core.api.catalog(), Core.api.meContext('t1')]);
  assert.equal(rotations, 1);
  assert.equal(Core.getToken(), null);
});

test('403 nao renova; CORE indisponivel nao entra em demo nem autentica', async () => {
  let rotations = 0;
  const forbidden = client(async (url) => {
    if (url.endsWith('/auth/refresh')) rotations++;
    return reply(403, { error: { code: 'PERMISSION_DENIED' } });
  });
  forbidden.Core.setToken('valid');
  await assert.rejects(forbidden.Core.api.catalog(), (error) => error.status === 403);
  assert.equal(rotations, 0);
  assert.equal(forbidden.Core.getToken(), 'valid');

  const offline = client(async () => { throw new Error('offline'); });
  await assert.rejects(offline.Core.api.me(), (error) => error.code === 'NETWORK_UNREACHABLE');
  assert.equal(offline.Core.getToken(), null);
  assert.equal(offline.Core.demoActive(), false);
});

test('401 apos retry nao cria loop de refresh', async () => {
  let rotations = 0;
  const { Core } = client(async (url) => {
    if (url.endsWith('/auth/refresh')) {
      rotations++;
      return reply(200, { accessToken: 'new' });
    }
    return reply(401, { error: { code: 'UNAUTHENTICATED' } });
  });
  Core.setToken('old');
  await assert.rejects(Core.api.me(), (error) => error.status === 401);
  assert.equal(rotations, 1);
  assert.equal(Core.getToken(), null);
});

test('resposta antiga nao reabre estado autenticado depois do logout', async () => {
  let releaseMe;
  const waitingMe = new Promise((resolve) => { releaseMe = resolve; });
  let meStarted;
  const started = new Promise((resolve) => { meStarted = resolve; });
  const { Core } = client(async (url) => {
    if (url.endsWith('/auth/logout')) return reply(204);
    meStarted();
    await waitingMe;
    return reply(200, identity());
  });
  Core.setToken('old');
  const pendingMe = Core.api.me();
  await started;
  await Core.logout();
  releaseMe();
  await assert.rejects(pendingMe, (error) => error.status === 401);
  assert.equal(Core.getToken(), null);
});

test('5xx nao provoca refresh nem apaga access ainda disponivel', async () => {
  let rotations = 0;
  const { Core } = client(async (url) => {
    if (url.endsWith('/auth/refresh')) rotations++;
    return reply(503, { error: { code: 'SERVICE_UNAVAILABLE' } });
  });
  Core.setToken('existing');
  await assert.rejects(Core.api.me(), (error) => error.status === 503);
  assert.equal(rotations, 0);
  assert.equal(Core.getToken(), 'existing');
});
