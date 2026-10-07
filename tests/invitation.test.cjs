const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'invitation.js'), 'utf8');
const settle = () => new Promise((resolve) => setImmediate(resolve));

async function page({ preview = {}, previewError, acceptError, hash = '#token=test-invitation-token&tenantId=tenant-a' } = {}) {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, value: '', textContent: '', disabled: false, required: false, listeners: {},
      reportValidity: () => true, focus() { this.focused = true; }, addEventListener(name, fn) { this.listeners[name] = fn; } });
    return nodes.get(id);
  };
  const calls = [];
  const history = [];
  const Core = {
    LABELS: { invitationStatus: { PENDING: 'Pendente', ACCEPTED: 'Aceito', EXPIRED: 'Expirado', REVOKED: 'Revogado' }, tenantStatus: { SUSPENDED: 'Suspensa', PROVISIONING: 'Provisionando' } },
    friendlyError: (error) => error.code,
    api: {
      previewInvitation: async (...args) => { calls.push(['preview', ...args]); if (previewError) throw previewError; return { tenant: { id: 'tenant-a', displayName: 'Empresa A', status: 'ACTIVE' }, email: 'invite@example.test', status: 'PENDING', needsPassword: true, ...preview }; },
      acceptInvitation: async (payload) => { calls.push(['accept', payload]); if (acceptError) throw acceptError; return { tenantId: 'tenant-a' }; },
    },
  };
  vm.runInNewContext(source, { window: { RoutflexCore: Core, location: { hash, pathname: '/invitation.html', search: '' }, history: { replaceState: (...args) => history.push(args) } }, document: { getElementById: get }, URLSearchParams });
  await settle();
  return { get, calls, history, submit: () => get('acceptForm').listeners.submit({ preventDefault() {} }) };
}

test('novo usuário: confirma tenant, captura fragmento e aceita sem persistir segredo na URL', async () => {
  const p = await page();
  assert.deepEqual(p.history, [[null, '', '/invitation.html']]);
  assert.deepEqual(p.calls[0], ['preview', 'test-invitation-token', 'tenant-a']);
  assert.equal(p.get('acceptForm').hidden, false);
  assert.equal(p.get('acceptPassword').required, true);
  p.get('acceptFullName').value = 'Pessoa Teste';
  p.get('acceptPassword').value = 'senha-teste-longa';
  await p.submit();
  assert.deepEqual(JSON.parse(JSON.stringify(p.calls[1][1])), { token: 'test-invitation-token', tenantId: 'tenant-a', fullName: 'Pessoa Teste', password: 'senha-teste-longa' });
  assert.equal(p.get('acceptPassword').value, '');
  assert.equal(p.get('acceptSuccess').hidden, false);
  assert.equal(p.get('acceptForm').hidden, true);
  await p.submit();
  assert.equal(p.calls.length, 2, 'aceite bem-sucedido não pode ser reenviado pela UI');
});

test('conta existente: aceite preserva credencial e não envia campos de nova conta', async () => {
  const p = await page({ preview: { needsPassword: false, isTenantOwner: true } });
  assert.equal(p.get('newAccountFields').hidden, true);
  assert.match(p.get('inviteDescription').textContent, /OWNER/);
  await p.submit();
  assert.deepEqual(Object.keys(p.calls[1][1]).sort(), ['tenantId', 'token']);
});

for (const status of ['ACCEPTED', 'EXPIRED', 'REVOKED']) {
  test(`convite ${status}: informa estado e não permite novo aceite`, async () => {
    const p = await page({ preview: { status } });
    assert.equal(p.get('acceptForm').hidden, true);
    await p.submit();
    assert.equal(p.calls.length, 1);
  });
}

test('empresa suspensa: apresenta bloqueio de onboarding', async () => {
  const p = await page({ preview: { tenant: { id: 'tenant-a', displayName: 'Empresa A', status: 'SUSPENDED' } } });
  assert.equal(p.get('acceptForm').hidden, true);
  assert.match(p.get('inviteDescription').textContent, /Suspensa/);
});

test('empresa provisionando: permite aceite do OWNER e informa ativação pendente', async () => {
  const p = await page({ preview: { tenant: { id: 'tenant-a', displayName: 'Empresa A', status: 'PROVISIONING' }, isTenantOwner: true } });
  assert.equal(p.get('acceptForm').hidden, false);
  assert.match(p.get('inviteDescription').textContent, /Workspace liberado após ativação/);
  await p.submit();
  assert.equal(p.calls.length, 2);
});

test('tenant incorreto: erro do servidor não é substituído por dados do browser', async () => {
  const p = await page({ previewError: { code: 'CROSS_TENANT_REFERENCE' } });
  assert.equal(p.get('acceptForm').hidden, true);
  assert.equal(p.get('acceptError').textContent, 'CROSS_TENANT_REFERENCE');
});

test('convite expira entre preview e aceite: exibe falha e fecha formulário', async () => {
  const p = await page({ acceptError: { code: 'INVITATION_EXPIRED' } });
  await p.submit();
  assert.equal(p.get('acceptError').textContent, 'INVITATION_EXPIRED');
  assert.equal(p.get('acceptForm').hidden, true);
  assert.equal(p.get('acceptSuccess').hidden, true);
});

test('sem link: nenhum endpoint é chamado', async () => {
  const p = await page({ hash: '' });
  assert.equal(p.calls.length, 0);
  assert.equal(p.get('acceptForm').hidden, true);
});
