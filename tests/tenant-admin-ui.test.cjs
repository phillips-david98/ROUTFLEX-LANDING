const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Executa as funções reais de UI com DOM/API controlados, sem exportar hooks no produto.
function routine(file, name, context) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const declarations = [...source.matchAll(/^  (?:async )?function (\w+)\(/gm)];
  const index = declarations.findIndex((match) => match[1] === name);
  assert.notEqual(index, -1, `rotina ${name} encontrada`);
  const closing = /^  \}\r?$/gm;
  closing.lastIndex = declarations[index].index;
  const closingMatch = closing.exec(source);
  assert.ok(closingMatch, `fim da rotina ${name} encontrado`);
  const end = closingMatch.index + closingMatch[0].length;
  return vm.runInNewContext(`${source.slice(declarations[index].index, end)}\n${name}`, context);
}
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const badge = (_tone, label) => `<span>${escapeHtml(label)}</span>`;

test('Workspace apresenta OWNER, seus roles, status e seats sem oferecer suspensão', () => {
  const nodes = { teamContent: {}, teamActions: {} };
  const member = { membershipId: 'm1', isTenantOwner: true, status: 'ACTIVE', user: { id: 'u1', fullName: 'Responsável', email: 'a@example.test' }, roles: [{ id: 'r1', key: 'TENANT_ADMIN', name: 'Tenant Admin' }], seats: [] };
  routine('workspace.js', 'renderTeam', { $: (id) => nodes[id], state: { memberships: [member], me: { user: { id: 'admin-other' } } }, can: () => true, PERM: {}, LABELS: { membershipStatus: { ACTIVE: 'Ativo' } }, MODULE_META: {}, MEMBER_TONE: { ACTIVE: 'active' }, escapeHtml, badge, emptyCard: () => '' })();
  assert.match(nodes.teamContent.innerHTML, /OWNER/);
  assert.match(nodes.teamContent.innerHTML, /Tenant Admin/);
  assert.match(nodes.teamContent.innerHTML, /member-roles/);
  assert.match(nodes.teamContent.innerHTML, /member-seats/);
  assert.doesNotMatch(nodes.teamContent.innerHTML, /member-suspend/);
});

test('modal roles preserva TENANT_ADMIN do OWNER e oferece apenas roles retornadas pelo CORE', () => {
  let modal;
  const member = { user: { fullName: 'Owner' }, isTenantOwner: true, roles: [{ id: 'admin' }] };
  routine('workspace.js', 'openRoleModal', { memberById: () => member, state: { roles: [{ id: 'admin', key: 'TENANT_ADMIN', name: 'Administrador' }, { id: 'operator', key: 'OPERATOR', name: 'Operador' }] }, can: () => true, PERM: {}, escapeHtml, badge, openModal: (value) => { modal = value; }, emptyCard: () => '' })('m1');
  assert.match(modal.body, /Autoridade do OWNER preservada/);
  assert.doesNotMatch(modal.body, /data-action="revoke-role"/);
  assert.match(modal.body, /data-action="grant-role"[^>]*data-role-id="operator"/);
});

test('role recusada pelo servidor mantém modal com mensagem e não altera estado local', async () => {
  const line = { hidden: true };
  const button = {};
  const calls = [];
  const change = routine('workspace.js', 'changeMemberRole', { $: () => line, state: { tenantId: 'a' }, api: { tenantGrantRole: async (...args) => { calls.push(args); throw { code: 'PERMISSION_DENIED' }; } }, Core: { friendlyError: (error) => error.code } });
  await change('member-b', 'forbidden-role', true, button);
  assert.deepEqual(calls, [['a', 'member-b', 'forbidden-role']]);
  assert.equal(line.textContent, 'PERMISSION_DENIED');
  assert.equal(line.hidden, false);
  assert.equal(button.disabled, false);
});

test('seats exibem contratado, ocupado e disponível conforme resposta do servidor', () => {
  const node = {};
  routine('workspace.js', 'renderSeats', { $: () => node, state: { seats: [{ moduleKey: 'planning', state: 'ACTIVE', seats: [{ seatTypeKey: 'OPERATOR_SEAT', contracted: 2, occupied: 2, available: 0, ceiling: 2 }] }], entitlements: [] }, LABELS: { entitlementState: { ACTIVE: 'Ativo' }, seatType: { OPERATOR_SEAT: 'Operador' } }, ENT_TONE: { ACTIVE: 'active' }, badge, escapeHtml, catalogModuleName: () => 'Planning', emptyCard: () => '' })();
  assert.match(node.innerHTML, /2 contratados \/ 2 utilizados/);
  assert.match(node.innerHTML, /0 disponíveis/);
  assert.match(node.innerHTML, /Limite atingido/);
});

test('Control Center designa OWNER por email e usa link retornado sem role escolhida pelo browser', async () => {
  const form = { dataset: { tenantId: 'a' }, elements: { email: { value: ' owner@example.test ' } }, reportValidity: () => true };
  const calls = [];
  let shown;
  const result = { status: 'INVITED', invitation: { email: 'owner@example.test' }, token: 'test-token' };
  await routine('control-center/cc-live.js', 'submitOwner', { modalBody: { querySelector: () => form }, setBusy: () => {}, api: { adminDesignateOwner: async (...args) => { calls.push(args); return result; } }, showInvitationLink: (...args) => { shown = args; }, loadTenantDetail: async () => {}, fieldError: () => assert.fail('sem erro esperado'), Core: {} })({});
  assert.deepEqual(calls, [['a', 'owner@example.test']]);
  assert.equal(shown[0], result);
  assert.equal(shown[1], 'a');
});

test('edição administrativa envia allowlist sem slug, tenantId, status ou roles manipulados', async () => {
  const values = { displayName: ' Empresa ', legalName: '', taxIdType: '', taxIdValue: '', primaryCountry: 'BR', defaultLocale: 'pt-BR', defaultTimezone: 'America/Sao_Paulo', defaultCurrency: 'BRL', slug: 'alterado', status: 'ACTIVE', role: 'PLATFORM_OWNER' };
  const form = { dataset: { tenantId: 'a' }, elements: Object.fromEntries(Object.entries(values).map(([k, value]) => [k, { value }])), reportValidity: () => true };
  let payload;
  await routine('control-center/cc-live.js', 'submitEditTenant', { modalBody: { querySelector: () => form }, setBusy: () => {}, api: { adminUpdateTenant: async (_id, body) => { payload = body; } }, closeModal: () => {}, showToast: () => {}, loadTenants: async () => {}, loadTenantDetail: async () => {}, fieldError: () => assert.fail('sem erro esperado'), Core: {} })({});
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), { displayName: 'Empresa', legalName: null, taxIdType: null, taxIdValue: null, primaryCountry: 'BR', defaultLocale: 'pt-BR', defaultTimezone: 'America/Sao_Paulo', defaultCurrency: 'BRL' });
});

test('Control Center usa lista persistida de convites com accepted/expired em nova sessão', () => {
  const html = routine('control-center/cc-live.js', 'renderCompanyInvites', { state: { detailInvitations: [{ email: 'accepted@example.test', status: 'ACCEPTED' }, { email: 'expired@example.test', status: 'EXPIRED' }] }, escapeHtml, inviteBadge: (status) => status, formatDate: () => '-', emptyState: () => '' })({ id: 'a' });
  assert.match(html, /accepted@example.test/);
  assert.match(html, /ACCEPTED/);
  assert.match(html, /EXPIRED/);
  assert.doesNotMatch(html, /nesta sessão/);
});

test('Control Center recupera onboarding revogando convite pendente pela API de plataforma', async () => {
  const calls = [];
  await routine('control-center/cc-live.js', 'executeRevokeInvitation', { setBusy: () => {}, api: { adminRevokeInvitation: async (...args) => calls.push(args) }, closeModal: () => {}, showToast: () => {}, loadTenantDetail: async () => {} })('tenant-a', 'invite-a', {});
  assert.deepEqual(calls, [['tenant-a', 'invite-a']]);
});

test('OWNER com convite existente sem novo token orienta recuperação e não cria link inválido', () => {
  let modal;
  routine('control-center/cc-live.js', 'showInvitationLink', { openModal: (value) => { modal = value; }, escapeHtml,
    Core: { invitationUrl: () => assert.fail('não se pode gerar link sem token') } })({ status: 'INVITED', invitation: { email: 'owner@example.test' } }, 'tenant-a');
  assert.match(modal.body, /Use o link entregue anteriormente/);
  assert.match(modal.body, /revogue o convite/);
  assert.doesNotMatch(modal.body, /undefined|cc-invite-token/);
});

test('convite expirado só oferece liberar reserva quando CORE informa reserva existente', () => {
  const invitations = [
    { id: 'reserved', email: 'reserved@example.test', status: 'EXPIRED', hasReservedSeats: true },
    { id: 'released', email: 'released@example.test', status: 'EXPIRED', hasReservedSeats: false },
  ];
  const cc = routine('control-center/cc-live.js', 'renderCompanyInvites', { state: { detailInvitations: invitations }, escapeHtml, inviteBadge: (status) => status, formatDate: () => '-', emptyState: () => '' })({ id: 'tenant-a' });
  assert.match(cc, /data-invitation-id="reserved">Liberar reserva/);
  assert.doesNotMatch(cc, /data-invitation-id="released"/);
  const node = {};
  routine('workspace.js', 'renderInvitations', { $: () => node, state: { invitations }, LABELS: { invitationStatus: {} }, can: () => true, PERM: {}, escapeHtml, badge, INVITE_TONE: {}, fmtDate: () => '-' })();
  assert.match(node.innerHTML, /data-invitation-id="reserved"[^>]*>Liberar reserva/);
  assert.doesNotMatch(node.innerHTML, /data-invitation-id="released"/);
});

test('suspensão e revogação de convite atualizam consumo de seats após confirmação do CORE', async () => {
  for (const operation of ['confirmSuspendMember', 'confirmRevokeInvite']) {
    const calls = [];
    const context = { state: { tenantId: 'tenant-a' }, $: () => ({ value: 'motivo teste' }), closeModal: () => {}, toast: () => {},
      api: { tenantSuspendMember: async () => calls.push('suspend'), tenantRevokeInvitation: async () => calls.push('revoke') },
      loadTeam: async () => calls.push('team'), loadInvitations: async () => calls.push('invitations'), loadSeats: async () => calls.push('seats') };
    await routine('workspace.js', operation, context)('resource-a');
    assert.equal(calls[0], operation === 'confirmSuspendMember' ? 'suspend' : 'revoke');
    assert.ok(calls.includes('seats'), `${operation} precisa atualizar seats`);
  }
});
