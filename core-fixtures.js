/* =============================================================================
   ROUTflex Core — FIXTURES DE DESENVOLVIMENTO (dados fictícios)
   -----------------------------------------------------------------------------
   ⚠ Este arquivo NUNCA participa do fluxo real.
   - Só é ativado quando a página é aberta com ?demo=1 (opt-in explícito).
   - A interface exibe selo permanente "MODO DEMONSTRAÇÃO" quando ativo.
   - As respostas espelham exatamente os contratos aprovados do Platform Core;
     nenhum campo fora do contrato é adicionado.
   - Cenários reproduzem os exemplos aprovados de UX:
       Redeflex           → Planning: acessar · OPS: acessar · Palm: gerenciar equipe · Sales: conhecer
       Luciana Perfumes   → Sales: acessar · Planning/OPS/Palm: conhecer
   ============================================================================= */
(function initRoutflexCoreFixtures() {
  "use strict";

  const now = () => new Date().toISOString();
  const uuid = (seedText) => `00000000-0000-4000-8000-${String(Math.abs(hash(seedText))).padStart(12, "0").slice(0, 12)}`;
  function hash(text) {
    let value = 0;
    for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) | 0;
    return value;
  }

  const CATALOG = {
    modules: [
      { key: "planning", name: "ROUTflex Planning", suiteKey: "routflex", description: "Planejamento territorial, carteiras e roteirização.", isActive: true, sortOrder: 1 },
      { key: "ops", name: "ROUTflex OPS", suiteKey: "routflex", description: "Gestão de execução e operação de campo.", isActive: true, sortOrder: 2 },
      { key: "palm", name: "ROUTflex Palm", suiteKey: "routflex", description: "Execução móvel para equipes externas.", isActive: true, sortOrder: 3 },
      { key: "sales", name: "ROUTflex Sales", suiteKey: "routflex", description: "Gestão comercial integrada ao ecossistema.", isActive: true, sortOrder: 4 },
    ],
    seatTypes: [
      { key: "OPERATOR_SEAT", name: "Licença de operador" },
      { key: "FIELD_SEAT", name: "Licença de campo" },
      { key: "MANAGER_SEAT", name: "Licença de gestão" },
      { key: "VIEWER_SEAT", name: "Licença de leitura" },
    ],
    permissions: [],
    systemRoles: [
      { key: "TENANT_ADMIN", name: "Administrador do tenant", description: "Governança completa do tenant.", permissionCount: 24 },
      { key: "OPERATOR", name: "Operador", description: "Uso operacional dos módulos.", permissionCount: 6 },
      { key: "VIEWER", name: "Visualizador", description: "Leitura.", permissionCount: 4 },
    ],
    permissionCatalogSize: 34,
  };

  const ADMIN_PERMISSIONS = [
    "core.tenant.read_self", "core.member.read", "core.member.invite", "core.member.suspend",
    "core.member.reactivate", "core.member.assign_role", "core.member.revoke_role", "core.role.read",
    "core.entitlement.read", "core.seat.read", "core.seat.assign", "core.seat.release",
    "core.unit.read", "core.unit.create", "core.invitation.read", "core.invitation.revoke",
    "core.audit.read_tenant",
  ];
  const OPERATOR_PERMISSIONS = ["core.tenant.read_self", "core.entitlement.read"];

  const ROLE_TENANT_ADMIN = { id: uuid("role-tenant-admin"), key: "TENANT_ADMIN", name: "Administrador do tenant", isSystem: true };
  const ROLE_OPERATOR = { id: uuid("role-operator"), key: "OPERATOR", name: "Operador", isSystem: true };
  const ROLE_VIEWER = { id: uuid("role-viewer"), key: "VIEWER", name: "Visualizador", isSystem: true };

  const TENANT_REDEFLEX = {
    id: uuid("tenant-redeflex"), slug: "redeflex", displayName: "Redeflex", legalName: "Redeflex Distribuição LTDA",
    taxIdType: "CNPJ", taxIdValue: "12.345.678/0001-90", status: "ACTIVE", primaryCountry: "BR",
    defaultLocale: "pt-BR", defaultTimezone: "America/Sao_Paulo", defaultCurrency: "BRL",
    suspendedAt: null, suspendedReason: null, cancelledAt: null,
    createdAt: "2026-05-02T12:00:00.000Z", updatedAt: now(),
  };
  const TENANT_LUCIANA = {
    id: uuid("tenant-luciana"), slug: "luciana-perfumes", displayName: "Luciana Perfumes", legalName: "Luciana Perfumes ME",
    taxIdType: "CNPJ", taxIdValue: "98.765.432/0001-10", status: "ACTIVE", primaryCountry: "BR",
    defaultLocale: "pt-BR", defaultTimezone: "America/Sao_Paulo", defaultCurrency: "BRL",
    suspendedAt: null, suspendedReason: null, cancelledAt: null,
    createdAt: "2026-06-11T12:00:00.000Z", updatedAt: now(),
  };

  const USERS = {
    "admin@redeflex.demo": {
      user: { id: uuid("user-redeflex-admin"), email: "admin@redeflex.demo", fullName: "Administrador Redeflex", status: "ACTIVE", platformRole: null, locale: "pt-BR", timezone: "America/Sao_Paulo", lastLoginAt: now() },
      tenants: [{ membershipId: uuid("mb-redeflex-admin"), membershipStatus: "ACTIVE", isTenantOwner: true, id: TENANT_REDEFLEX.id, slug: TENANT_REDEFLEX.slug, displayName: TENANT_REDEFLEX.displayName, status: TENANT_REDEFLEX.status }],
      contexts: {
        [TENANT_REDEFLEX.id]: {
          tenant: { id: TENANT_REDEFLEX.id, slug: TENANT_REDEFLEX.slug, status: TENANT_REDEFLEX.status },
          membership: { id: uuid("mb-redeflex-admin"), status: "ACTIVE", isTenantOwner: true },
          roles: [ROLE_TENANT_ADMIN],
          permissions: ADMIN_PERMISSIONS,
          modules: [
            { moduleKey: "planning", entitlementState: "ACTIVE", entitlementEffective: true, seatTypeKey: "OPERATOR_SEAT", hasSeat: true, hasEffectiveAccess: true },
            { moduleKey: "ops", entitlementState: "ACTIVE", entitlementEffective: true, seatTypeKey: "OPERATOR_SEAT", hasSeat: true, hasEffectiveAccess: true },
            { moduleKey: "palm", entitlementState: "ACTIVE", entitlementEffective: true, seatTypeKey: null, hasSeat: false, hasEffectiveAccess: false },
            { moduleKey: "sales", entitlementState: "NOT_CONTRACTED", entitlementEffective: false, seatTypeKey: null, hasSeat: false, hasEffectiveAccess: false },
          ],
          units: [
            { id: uuid("unit-redeflex-matriz"), parentId: null, unitType: "HQ", code: "RDX-MTZ", name: "Matriz São Paulo", status: "ACTIVE", path: "/RDX-MTZ", depth: 0, externalCodes: [] },
            { id: uuid("unit-redeflex-cur"), parentId: null, unitType: "BRANCH", code: "RDX-CUR", name: "Filial Curitiba", status: "ACTIVE", path: "/RDX-CUR", depth: 0, externalCodes: [] },
          ],
        },
      },
    },
    "luciana@lucianaperfumes.demo": {
      user: { id: uuid("user-luciana"), email: "luciana@lucianaperfumes.demo", fullName: "Luciana Almeida", status: "ACTIVE", platformRole: null, locale: "pt-BR", timezone: "America/Sao_Paulo", lastLoginAt: now() },
      tenants: [{ membershipId: uuid("mb-luciana"), membershipStatus: "ACTIVE", isTenantOwner: true, id: TENANT_LUCIANA.id, slug: TENANT_LUCIANA.slug, displayName: TENANT_LUCIANA.displayName, status: TENANT_LUCIANA.status }],
      contexts: {
        [TENANT_LUCIANA.id]: {
          tenant: { id: TENANT_LUCIANA.id, slug: TENANT_LUCIANA.slug, status: TENANT_LUCIANA.status },
          membership: { id: uuid("mb-luciana"), status: "ACTIVE", isTenantOwner: true },
          roles: [ROLE_TENANT_ADMIN, ROLE_OPERATOR],
          permissions: ADMIN_PERMISSIONS.concat(OPERATOR_PERMISSIONS),
          modules: [
            { moduleKey: "planning", entitlementState: "NOT_CONTRACTED", entitlementEffective: false, seatTypeKey: null, hasSeat: false, hasEffectiveAccess: false },
            { moduleKey: "ops", entitlementState: "NOT_CONTRACTED", entitlementEffective: false, seatTypeKey: null, hasSeat: false, hasEffectiveAccess: false },
            { moduleKey: "palm", entitlementState: "NOT_CONTRACTED", entitlementEffective: false, seatTypeKey: null, hasSeat: false, hasEffectiveAccess: false },
            { moduleKey: "sales", entitlementState: "ACTIVE", entitlementEffective: true, seatTypeKey: "OPERATOR_SEAT", hasSeat: true, hasEffectiveAccess: true },
          ],
          units: [
            { id: uuid("unit-luciana-loja"), parentId: null, unitType: "HQ", code: "LP-01", name: "Loja Centro", status: "ACTIVE", path: "/LP-01", depth: 0, externalCodes: [] },
          ],
        },
      },
    },
  };

  const MEMBERSHIPS = {
    [TENANT_REDEFLEX.id]: [
      {
        membershipId: uuid("mb-redeflex-admin"), status: "ACTIVE", isTenantOwner: true, employeeCode: null, joinedAt: "2026-05-02T12:30:00.000Z",
        user: { id: uuid("user-redeflex-admin"), email: "admin@redeflex.demo", fullName: "Administrador Redeflex", status: "ACTIVE" },
        roles: [{ id: ROLE_TENANT_ADMIN.id, key: "TENANT_ADMIN", name: "Administrador do tenant" }],
        unitScopes: [],
        seats: [
          { seatAssignmentId: uuid("seat-rdx-planning"), moduleKey: "planning", seatTypeKey: "OPERATOR_SEAT", state: "ACTIVE" },
          { seatAssignmentId: uuid("seat-rdx-ops"), moduleKey: "ops", seatTypeKey: "OPERATOR_SEAT", state: "ACTIVE" },
        ],
      },
      {
        membershipId: uuid("mb-redeflex-campo"), status: "ACTIVE", isTenantOwner: false, employeeCode: "RDX-114", joinedAt: "2026-05-20T09:00:00.000Z",
        user: { id: uuid("user-redeflex-campo"), email: "carlos.souza@redeflex.demo", fullName: "Carlos Souza", status: "ACTIVE" },
        roles: [{ id: ROLE_OPERATOR.id, key: "OPERATOR", name: "Operador" }],
        unitScopes: [{ mode: "INCLUDE", unit: { id: uuid("unit-redeflex-cur"), code: "RDX-CUR", name: "Filial Curitiba" } }],
        seats: [{ seatAssignmentId: uuid("seat-rdx-palm-carlos"), moduleKey: "palm", seatTypeKey: "FIELD_SEAT", state: "ACTIVE" }],
      },
      {
        membershipId: uuid("mb-redeflex-ana"), status: "SUSPENDED", isTenantOwner: false, employeeCode: "RDX-201", joinedAt: "2026-06-02T09:00:00.000Z",
        user: { id: uuid("user-redeflex-ana"), email: "ana.lima@redeflex.demo", fullName: "Ana Lima", status: "ACTIVE" },
        roles: [{ id: ROLE_VIEWER.id, key: "VIEWER", name: "Visualizador" }],
        unitScopes: [],
        seats: [],
      },
    ],
    [TENANT_LUCIANA.id]: [
      {
        membershipId: uuid("mb-luciana"), status: "ACTIVE", isTenantOwner: true, employeeCode: null, joinedAt: "2026-06-11T12:30:00.000Z",
        user: { id: uuid("user-luciana"), email: "luciana@lucianaperfumes.demo", fullName: "Luciana Almeida", status: "ACTIVE" },
        roles: [{ id: ROLE_TENANT_ADMIN.id, key: "TENANT_ADMIN", name: "Administrador do tenant" }, { id: ROLE_OPERATOR.id, key: "OPERATOR", name: "Operador" }],
        unitScopes: [],
        seats: [{ seatAssignmentId: uuid("seat-lp-sales"), moduleKey: "sales", seatTypeKey: "OPERATOR_SEAT", state: "ACTIVE" }],
      },
    ],
  };

  const SEATS = {
    [TENANT_REDEFLEX.id]: [
      { moduleKey: "planning", state: "ACTIVE", isEffective: true, seats: [{ seatTypeKey: "OPERATOR_SEAT", contracted: 5, overageAllowed: 0, ceiling: 5, occupied: 1, available: 4, inOverage: false }] },
      { moduleKey: "ops", state: "ACTIVE", isEffective: true, seats: [{ seatTypeKey: "OPERATOR_SEAT", contracted: 5, overageAllowed: 0, ceiling: 5, occupied: 1, available: 4, inOverage: false }] },
      { moduleKey: "palm", state: "ACTIVE", isEffective: true, seats: [{ seatTypeKey: "FIELD_SEAT", contracted: 1, overageAllowed: 0, ceiling: 1, occupied: 1, available: 0, inOverage: false }] },
    ],
    [TENANT_LUCIANA.id]: [
      { moduleKey: "sales", state: "ACTIVE", isEffective: true, seats: [{ seatTypeKey: "OPERATOR_SEAT", contracted: 3, overageAllowed: 1, ceiling: 4, occupied: 1, available: 3, inOverage: false }] },
    ],
  };

  const ENTITLEMENTS = {
    [TENANT_REDEFLEX.id]: [
      { id: uuid("ent-rdx-planning"), tenantId: TENANT_REDEFLEX.id, moduleKey: "planning", state: "ACTIVE", activatedAt: "2026-05-03T12:00:00.000Z", trialEndsAt: null, expiresAt: null, seatQuotas: [{ seatTypeKey: "OPERATOR_SEAT", quantityContracted: 5, quantityOverageAllowed: 0 }] },
      { id: uuid("ent-rdx-ops"), tenantId: TENANT_REDEFLEX.id, moduleKey: "ops", state: "ACTIVE", activatedAt: "2026-05-03T12:00:00.000Z", trialEndsAt: null, expiresAt: null, seatQuotas: [{ seatTypeKey: "OPERATOR_SEAT", quantityContracted: 5, quantityOverageAllowed: 0 }] },
      { id: uuid("ent-rdx-palm"), tenantId: TENANT_REDEFLEX.id, moduleKey: "palm", state: "ACTIVE", activatedAt: "2026-05-10T12:00:00.000Z", trialEndsAt: null, expiresAt: null, seatQuotas: [{ seatTypeKey: "FIELD_SEAT", quantityContracted: 1, quantityOverageAllowed: 0 }] },
      { id: uuid("ent-rdx-sales"), tenantId: TENANT_REDEFLEX.id, moduleKey: "sales", state: "NOT_CONTRACTED", activatedAt: null, trialEndsAt: null, expiresAt: null, seatQuotas: [] },
    ],
    [TENANT_LUCIANA.id]: [
      { id: uuid("ent-lp-sales"), tenantId: TENANT_LUCIANA.id, moduleKey: "sales", state: "ACTIVE", activatedAt: "2026-06-12T12:00:00.000Z", trialEndsAt: null, expiresAt: null, seatQuotas: [{ seatTypeKey: "OPERATOR_SEAT", quantityContracted: 3, quantityOverageAllowed: 1 }] },
    ],
  };

  const INVITATIONS = {
    [TENANT_REDEFLEX.id]: [
      { id: uuid("inv-rdx-01"), email: "novo.vendedor@redeflex.demo", status: "PENDING", issuerType: "TENANT", expiresAt: "2026-08-15T12:00:00.000Z", acceptedAt: null, revokedAt: null, createdAt: "2026-07-28T12:00:00.000Z" },
    ],
    [TENANT_LUCIANA.id]: [],
  };

  const AUDIT = {
    [TENANT_REDEFLEX.id]: [
      { id: uuid("aud-rdx-1"), occurredAt: "2026-07-30T14:12:00.000Z", tenantId: TENANT_REDEFLEX.id, actorType: "USER", actorUserId: uuid("user-redeflex-admin"), category: "MEMBERSHIP", action: "membership.seat.assigned", targetType: "SEAT_ASSIGNMENT", targetId: uuid("seat-rdx-palm-carlos"), result: "SUCCESS", severity: "INFO", changes: null, ipAddress: "127.0.0.1", userAgent: "fixtures", requestId: "fx-001" },
      { id: uuid("aud-rdx-2"), occurredAt: "2026-07-29T10:05:00.000Z", tenantId: TENANT_REDEFLEX.id, actorType: "USER", actorUserId: uuid("user-redeflex-admin"), category: "INVITATION", action: "invitation.created", targetType: "INVITATION", targetId: uuid("inv-rdx-01"), result: "SUCCESS", severity: "INFO", changes: null, ipAddress: "127.0.0.1", userAgent: "fixtures", requestId: "fx-002" },
    ],
    [TENANT_LUCIANA.id]: [
      { id: uuid("aud-lp-1"), occurredAt: "2026-07-27T09:40:00.000Z", tenantId: TENANT_LUCIANA.id, actorType: "USER", actorUserId: uuid("user-luciana"), category: "AUTH", action: "auth.login", targetType: "USER", targetId: uuid("user-luciana"), result: "SUCCESS", severity: "INFO", changes: null, ipAddress: "127.0.0.1", userAgent: "fixtures", requestId: "fx-101" },
    ],
  };

  const ROLES_BY_TENANT = {
    [TENANT_REDEFLEX.id]: [ROLE_TENANT_ADMIN, ROLE_OPERATOR, ROLE_VIEWER],
    [TENANT_LUCIANA.id]: [ROLE_TENANT_ADMIN, ROLE_OPERATOR, ROLE_VIEWER],
  };

  let sessionEmail = null;

  function err(code, message, status) {
    const error = new window.RoutflexCore.CoreApiError({ code, message, status });
    return Promise.reject(error);
  }

  async function handle(path, { method, body }) {
    await new Promise((resolve) => setTimeout(resolve, 260)); // latência simulada

    if (path === "/auth/login" && method === "POST") {
      const account = USERS[String(body?.email || "").toLowerCase()];
      if (!account || !body?.password) return err("INVALID_CREDENTIALS", "Credenciais inválidas.", 401);
      sessionEmail = account.user.email;
      return {
        accessToken: `demo-token-${hash(sessionEmail)}`,
        tokenType: "Bearer",
        expiresInSeconds: 900,
        user: { id: account.user.id, email: account.user.email, fullName: account.user.fullName, platformRole: account.user.platformRole },
      };
    }

    const account = sessionEmail ? USERS[sessionEmail] : null;
    if (!account) return err("UNAUTHENTICATED", "Sessão demo não iniciada.", 401);

    if (path === "/me") return { user: account.user, tenants: account.tenants };
    if (path === "/catalog") return CATALOG;

    let match = path.match(/^\/me\/context\/([^/]+)$/);
    if (match) {
      const context = account.contexts[match[1]];
      if (!context) return err("MEMBERSHIP_NOT_FOUND", "Vínculo não encontrado.", 403);
      return JSON.parse(JSON.stringify(context));
    }

    match = path.match(/^\/tenants\/([^/]+)(\/.*)?$/);
    if (match) {
      const tenantId = match[1];
      const rest = match[2] || "";
      if (!account.contexts[tenantId]) return err("MEMBERSHIP_NOT_FOUND", "Vínculo não encontrado.", 403);

      if (rest === "" && method === "GET") return tenantId === TENANT_REDEFLEX.id ? TENANT_REDEFLEX : TENANT_LUCIANA;
      if (rest === "/memberships") return JSON.parse(JSON.stringify(MEMBERSHIPS[tenantId] || []));
      if (rest === "/roles") return ROLES_BY_TENANT[tenantId] || [];
      if (rest === "/entitlements") return JSON.parse(JSON.stringify(ENTITLEMENTS[tenantId] || []));
      if (rest === "/seats") return JSON.parse(JSON.stringify(SEATS[tenantId] || []));
      if (rest === "/units") return JSON.parse(JSON.stringify(account.contexts[tenantId].units));
      if (rest === "/audit-logs") return JSON.parse(JSON.stringify(AUDIT[tenantId] || []));
      if (rest === "/invitations" && method === "GET") return JSON.parse(JSON.stringify(INVITATIONS[tenantId] || []));

      if (rest === "/invitations" && method === "POST") {
        const duplicated = (INVITATIONS[tenantId] || []).some((invite) => invite.email === body.email && invite.status === "PENDING");
        if (duplicated) return err("INVITATION_ALREADY_PENDING", "Convite pendente já existe.", 409);
        const invitation = {
          id: uuid(`inv-${body.email}-${Date.now()}`), email: body.email, status: "PENDING", issuerType: "TENANT",
          expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), acceptedAt: null, revokedAt: null, createdAt: now(),
        };
        (INVITATIONS[tenantId] = INVITATIONS[tenantId] || []).unshift(invitation);
        return { invitation, token: `demo-invite-${hash(body.email + Date.now())}` };
      }

      let action = rest.match(/^\/invitations\/([^/]+)\/revoke$/);
      if (action && method === "POST") {
        const invitation = (INVITATIONS[tenantId] || []).find((invite) => invite.id === action[1]);
        if (invitation) { invitation.status = "REVOKED"; invitation.revokedAt = now(); }
        return { revoked: true };
      }

      action = rest.match(/^\/memberships\/([^/]+)\/suspend$/);
      if (action && method === "POST") {
        const member = (MEMBERSHIPS[tenantId] || []).find((item) => item.membershipId === action[1]);
        if (member) member.status = "SUSPENDED";
        return { suspended: true };
      }
      action = rest.match(/^\/memberships\/([^/]+)\/reactivate$/);
      if (action && method === "POST") {
        const member = (MEMBERSHIPS[tenantId] || []).find((item) => item.membershipId === action[1]);
        if (member) member.status = "ACTIVE";
        return { reactivated: true };
      }

      action = rest.match(/^\/memberships\/([^/]+)\/seats$/);
      if (action && method === "POST") {
        const moduleSeats = (SEATS[tenantId] || []).find((entry) => entry.moduleKey === body.moduleKey);
        const quota = moduleSeats?.seats.find((seat) => seat.seatTypeKey === body.seatTypeKey);
        if (!quota) return err("VALIDATION_FAILED", "Tipo de licença sem quota para este módulo.", 422);
        if (quota.available <= 0) {
          const error = new window.RoutflexCore.CoreApiError({
            code: "SEAT_QUOTA_EXCEEDED", message: "Limite de licenças atingido.", status: 409,
            details: { moduleKey: body.moduleKey, seatTypeKey: body.seatTypeKey, contracted: quota.contracted, ceiling: quota.ceiling, occupied: quota.occupied, available: quota.available },
          });
          return Promise.reject(error);
        }
        const member = (MEMBERSHIPS[tenantId] || []).find((item) => item.membershipId === action[1]);
        if (member?.seats.some((seat) => seat.moduleKey === body.moduleKey && seat.state === "ACTIVE")) {
          return err("SEAT_ALREADY_ASSIGNED", "Usuário já possui licença deste módulo.", 409);
        }
        quota.occupied += 1; quota.available -= 1;
        const seat = { seatAssignmentId: uuid(`seat-${action[1]}-${body.moduleKey}-${Date.now()}`), moduleKey: body.moduleKey, seatTypeKey: body.seatTypeKey, state: "ACTIVE" };
        member?.seats.push(seat);
        return seat;
      }

      action = rest.match(/^\/memberships\/([^/]+)\/seats\/([^/]+)$/);
      if (action && method === "DELETE") {
        const member = (MEMBERSHIPS[tenantId] || []).find((item) => item.membershipId === action[1]);
        const index = member ? member.seats.findIndex((seat) => seat.seatAssignmentId === action[2]) : -1;
        if (member && index >= 0) {
          const [removed] = member.seats.splice(index, 1);
          const moduleSeats = (SEATS[tenantId] || []).find((entry) => entry.moduleKey === removed.moduleKey);
          const quota = moduleSeats?.seats.find((seat) => seat.seatTypeKey === removed.seatTypeKey);
          if (quota) { quota.occupied -= 1; quota.available += 1; }
        }
        return { released: true };
      }
    }

    if (path.startsWith("/admin/")) {
      return err("PLATFORM_ROLE_REQUIRED", "Fixtures do Workspace não simulam o console de plataforma.", 403);
    }

    return err("VALIDATION_FAILED", `Rota não coberta pelas fixtures: ${method} ${path}`, 422);
  }

  window.RoutflexCoreFixtures = { ready: true, handle };
})();
