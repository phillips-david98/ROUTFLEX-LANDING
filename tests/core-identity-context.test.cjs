const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'core-client.js'), 'utf8');
const U = { A: '11111111-1111-4111-8111-111111111111', B: '22222222-2222-4222-8222-222222222222' };
const S = { A: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const me = (user = 'A', session = user) => ({ user: { id: U[user], status: 'ACTIVE' }, authenticationSessionId: S[session], tenants: [] });
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), text: async () => body === undefined ? '' : JSON.stringify(body) });
const denied = () => reply(401, { error: { code: 'UNAUTHENTICATED' } });
function memory() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function client(fetchImpl, sessionStorage = memory(), localStorage = memory()) {
  const calls = [];
  const window = { sessionStorage, localStorage, location: { search: '', href: 'https://test.invalid/workspace.html' } };
  const fetch = async (url, options) => {
    const call = { path: new URL(url).pathname.replace(/^\/core/, ''), ...options };
    calls.push(call);
    return fetchImpl(call);
  };
  vm.runInNewContext(source, { window, fetch, URL, URLSearchParams, console });
  return { Core: window.RoutflexCore, calls, sessionStorage, localStorage };
}
const unauthenticated = error => error.status === 401;

test('refresh A to B is denied before replay; returning A cannot revive the old document', async () => {
  let nextIdentity = 'B';
  const { Core, calls } = client(async c => {
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'renewed' });
    if (c.path === '/me') return reply(200, me(c.headers.Authorization === 'Bearer initial' ? 'A' : nextIdentity));
    return c.headers.Authorization === 'Bearer initial' ? denied() : reply(200, { sensitive: 'B fixture' });
  });
  Core.setToken('initial');
  assert.equal((await Core.api.me()).user.id, U.A);
  let endings = 0;
  Core.onUnauthenticated(() => { endings++; });
  await assert.rejects(Core.api.meContext('shared-tenant'), unauthenticated);
  assert.equal(calls.filter(c => c.path.includes('/context/')).length, 1);
  assert.equal(Core.getToken(), null);
  assert.equal(endings, 1);
  nextIdentity = 'A';
  const count = calls.length;
  await assert.rejects(Core.api.me(), unauthenticated);
  assert.equal(calls.length, count);
  Core.setToken('fresh-explicit-login');
  assert.equal((await Core.api.me()).user.id, U.A);
});

test('same user with a different CORE AuthenticationSession is not the same document session', async () => {
  const { Core } = client(async c => {
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'new-session' });
    if (c.path === '/me') return reply(200, me('A', c.headers.Authorization === 'Bearer initial' ? 'A' : 'B'));
    return denied();
  });
  Core.setToken('initial');
  await Core.api.me();
  await assert.rejects(Core.api.catalog(), unauthenticated);
  assert.equal(Core.getToken(), null);
});

test('same principal refresh preserves one rotation and validates before concurrent replays', async () => {
  let proofFinished = false;
  const { Core, calls } = client(async c => {
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'renewed' });
    if (c.path === '/me') {
      if (c.headers.Authorization === 'Bearer renewed') proofFinished = true;
      return reply(200, me());
    }
    if (c.headers.Authorization === 'Bearer initial') return denied();
    assert.equal(proofFinished, true);
    return reply(200, { valid: true });
  });
  Core.setToken('initial');
  await Core.api.me();
  const results = await Promise.all([Core.api.catalog(), Core.api.meContext('one'), Core.api.meContext('two')]);
  assert.ok(results.every(r => r.valid));
  assert.equal(calls.filter(c => c.path === '/auth/refresh').length, 1);
  assert.equal(calls.filter(c => c.path === '/me' && c.headers.Authorization === 'Bearer renewed').length, 1);
  assert.equal(Core.getToken(), 'renewed');
  assert.ok(calls.filter(c => c.path === '/me').every(c => c.credentials === 'omit'));
});

for (const [label, invalid] of [
  ['missing session', { user: { id: U.A, status: 'ACTIVE' } }],
  ['invalid session', { ...me(), authenticationSessionId: 'untrusted' }],
  ['invalid user', { ...me(), user: { id: 'untrusted', status: 'ACTIVE' } }],
  ['inactive user', { ...me(), user: { id: U.A, status: 'SUSPENDED' } }],
]) {
  test(`malformed CORE identity (${label}) cannot establish or restore context`, async () => {
    const { Core, calls } = client(async () => reply(200, invalid));
    Core.setToken('candidate');
    await assert.rejects(Core.api.me(), unauthenticated);
    assert.equal(Core.getToken(), null);
    await assert.rejects(Core.api.catalog(), unauthenticated);
    assert.equal(calls.length, 1);
  });
}

test('renewal missing session identity fails closed without accepting candidate access', async () => {
  const { Core, calls } = client(async c => {
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'unproven' });
    if (c.path === '/me') return reply(200, c.headers.Authorization === 'Bearer initial' ? me() : { user: me().user });
    return denied();
  });
  Core.setToken('initial');
  await Core.api.me();
  await assert.rejects(Core.api.catalog());
  assert.equal(Core.getToken(), null);
  assert.equal(calls.filter(c => c.path === '/catalog').length, 1);
});

test('unavailable identity proof never accepts the candidate or replays the domain request', async () => {
  const { Core, calls } = client(async c => {
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'unproven' });
    if (c.path === '/me') return c.headers.Authorization === 'Bearer initial' ? reply(200, me()) : reply(503, { error: { code: 'UNAVAILABLE' } });
    return denied();
  });
  Core.setToken('initial');
  await Core.api.me();
  await assert.rejects(Core.api.catalog(), e => e.status === 503);
  assert.equal(Core.getToken(), 'initial');
  assert.equal(calls.filter(c => c.path === '/catalog').length, 1);
  assert.equal(Core.demoActive(), false);
});

test('a later me response with a different principal terminates instead of relabeling identity', async () => {
  let subject = 'A';
  const { Core } = client(async () => reply(200, me(subject)));
  Core.setToken('initial');
  await Core.api.me();
  subject = 'B';
  await assert.rejects(Core.api.me(), unauthenticated);
  assert.equal(Core.getToken(), null);
});

test('logout during pending renewal proof cannot restore the old context', async () => {
  const started = deferred(), release = deferred();
  const { Core, calls } = client(async c => {
    if (c.path === '/auth/logout') return reply(204);
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'renewed' });
    if (c.path === '/me') {
      if (c.headers.Authorization === 'Bearer renewed') { started.resolve(); await release.promise; }
      return reply(200, me());
    }
    return denied();
  });
  Core.setToken('initial');
  await Core.api.me();
  const pending = assert.rejects(Core.api.catalog(), unauthenticated);
  await started.promise;
  const logout = Core.logout();
  release.resolve();
  await Promise.all([pending, logout]);
  assert.equal(Core.getToken(), null);
  assert.equal(calls.filter(c => c.path === '/catalog').length, 1);
  await assert.rejects(Core.api.me(), unauthenticated);
});

test('explicit B login during old A proof invalidates only old work, not the new session', async () => {
  const started = deferred(), release = deferred();
  const { Core } = client(async c => {
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'renewed-A' });
    if (c.path === '/me') {
      if (c.headers.Authorization === 'Bearer renewed-A') { started.resolve(); await release.promise; }
      return reply(200, me(c.headers.Authorization === 'Bearer explicit-B' ? 'B' : 'A'));
    }
    return denied();
  });
  Core.setToken('initial');
  await Core.api.me();
  let changes = 0;
  Core.onUnauthenticated(() => { changes++; });
  const pending = assert.rejects(Core.api.catalog(), unauthenticated);
  await started.promise;
  Core.setToken('explicit-B');
  assert.equal(changes, 1);
  assert.equal((await Core.api.me()).user.id, U.B);
  release.resolve();
  await pending;
  assert.equal(Core.getToken(), 'explicit-B');
  assert.equal((await Core.api.me()).user.id, U.B);
});

test('revoked simulated session terminates retries and cannot silently restore on another request', async () => {
  let revoked = false;
  const { Core, calls } = client(async c => !revoked && c.path === '/me' ? reply(200, me()) : denied());
  Core.setToken('initial');
  await Core.api.me();
  revoked = true;
  await assert.rejects(Core.api.catalog(), unauthenticated);
  const count = calls.length;
  await assert.rejects(Core.api.me(), unauthenticated);
  assert.equal(calls.length, count);
  assert.equal(Core.getToken(), null);
});

test('simulated F5 revalidates CORE identity and preserves unrelated legitimate drafts', async () => {
  const session = memory(), local = memory();
  local.setItem('legitimate-planning-draft', 'unchanged-user-work');
  session.setItem('routflex.core.accessToken', 'restored');
  local.setItem('forged-principal', JSON.stringify(me('B')));
  const transport = async c => reply(200, c.path === '/auth/refresh' ? { accessToken: 'refreshed-in-memory' } : me());
  const first = client(transport, session, local);
  assert.equal((await first.Core.api.me()).user.id, U.A);
  const second = client(transport, session, local);
  assert.equal((await second.Core.api.me()).user.id, U.A);
  second.Core.clearSession();
  assert.equal(local.getItem('legitimate-planning-draft'), 'unchanged-user-work');
  assert.equal(session.getItem('routflex.core.accessToken'), null);
});

test('an obsolete non-401 error cannot be published as a failure of a newer session', async () => {
  const started = deferred(), release = deferred();
  const { Core } = client(async c => {
    if (c.path === '/me') return reply(200, me(c.headers.Authorization === 'Bearer new-B' ? 'B' : 'A'));
    started.resolve(); await release.promise;
    return reply(503, { error: { code: 'OLD_FAILURE' } });
  });
  Core.setToken('initial');
  await Core.api.me();
  const old = assert.rejects(Core.api.catalog(), unauthenticated);
  await started.promise;
  Core.setToken('new-B');
  assert.equal((await Core.api.me()).user.id, U.B);
  release.resolve();
  await old;
  assert.equal(Core.getToken(), 'new-B');
});

test('an obsolete renewal-proof error cannot be published in the new identity', async () => {
  const started = deferred(), release = deferred();
  const { Core, calls } = client(async c => {
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'renewed-A' });
    if (c.path === '/me') {
      if (c.headers.Authorization === 'Bearer renewed-A') {
        started.resolve(); await release.promise;
        return reply(503, { error: { code: 'OLD_PROOF_FAILURE' } });
      }
      return reply(200, me(c.headers.Authorization === 'Bearer new-B' ? 'B' : 'A'));
    }
    return denied();
  });
  Core.setToken('initial');
  await Core.api.me();
  const old = assert.rejects(Core.api.catalog(), unauthenticated);
  await started.promise;
  Core.setToken('new-B');
  assert.equal((await Core.api.me()).user.id, U.B);
  release.resolve();
  await old;
  assert.equal(Core.getToken(), 'new-B');
  assert.equal(calls.filter(c => c.path === '/catalog').length, 1);
});

test('an obsolete replay error cannot be published in the new identity', async () => {
  const started = deferred(), release = deferred();
  const { Core } = client(async c => {
    if (c.path === '/auth/refresh') return reply(200, { accessToken: 'renewed-A' });
    if (c.path === '/me') return reply(200, me(c.headers.Authorization === 'Bearer new-B' ? 'B' : 'A'));
    if (c.headers.Authorization === 'Bearer initial') return denied();
    started.resolve(); await release.promise;
    return reply(503, { error: { code: 'OLD_REPLAY_FAILURE' } });
  });
  Core.setToken('initial');
  await Core.api.me();
  const old = assert.rejects(Core.api.catalog(), unauthenticated);
  await started.promise;
  Core.setToken('new-B');
  assert.equal((await Core.api.me()).user.id, U.B);
  release.resolve();
  await old;
  assert.equal(Core.getToken(), 'new-B');
});
