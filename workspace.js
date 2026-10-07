/* =============================================================================
   ROUTflex Workspace — console do tenant conectado ao Platform Core
   -----------------------------------------------------------------------------
   Regras de ouro implementadas aqui:
   - Nenhum acesso é liberado pelo navegador: botões operacionais existem apenas
     quando o Platform Core responde hasEffectiveAccess = true.
   - Estados (NOT_CONTRACTED, TRIAL, ACTIVE, SUSPENDED, EXPIRED, CANCELLED,
     carregando, erro, vazio, sem permissão, limite atingido, convite pendente,
     tenant suspenso) refletem exclusivamente as respostas da API.
   - Nenhum dado fixo é usado como resposta final; fixtures só com ?demo=1.
   ============================================================================= */
(function initWorkspace() {
  "use strict";

  const Core = window.RoutflexCore;
  if (!Core) throw new Error("core-client.js não carregado.");

  const { api, LABELS, MODULE_META } = Core;

  const PERM = {
    TENANT_READ_SELF: "core.tenant.read_self",
    MEMBER_READ: "core.member.read",
    MEMBER_INVITE: "core.member.invite",
    MEMBER_SUSPEND: "core.member.suspend",
    MEMBER_REACTIVATE: "core.member.reactivate",
    ROLE_READ: "core.role.read",
    ENTITLEMENT_READ: "core.entitlement.read",
    SEAT_READ: "core.seat.read",
    SEAT_ASSIGN: "core.seat.assign",
    SEAT_RELEASE: "core.seat.release",
    INVITATION_READ: "core.invitation.read",
    INVITATION_REVOKE: "core.invitation.revoke",
    AUDIT_READ: "core.audit.read_tenant",
  };

  const STORAGE_TENANT = "routflex.core.tenantId";

  const state = {
    me: null,
    tenantId: null,
    context: null,
    catalog: null,
    tenantRecord: null,
    seats: null,
    entitlements: null,
    memberships: null,
    invitations: null,
    roles: null,
    audit: null,
    blocked: null, // { kind: 'TENANT' | 'MEMBERSHIP', message }
  };

  /* ---------------------------------------------------------------- helpers */
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[char]));
  }

  function fmtDate(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat("pt-BR", withTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
  }

  function can(permission) {
    return Boolean(state.context && Array.isArray(state.context.permissions) && state.context.permissions.includes(permission));
  }

  const ENT_TONE = {
    ACTIVE: "active", TRIAL: "trial", SUSPENDED: "suspended",
    EXPIRED: "expired", CANCELLED: "cancelled", NOT_CONTRACTED: "notc",
  };
  const TENANT_TONE = {
    ACTIVE: "active", TRIAL: "trial", PROVISIONING: "paused",
    SUSPENDED: "suspended", CANCELLED: "cancelled",
  };
  const MEMBER_TONE = { ACTIVE: "active", INVITED: "paused", SUSPENDED: "suspended", REMOVED: "cancelled" };
  const INVITE_TONE = { PENDING: "paused", ACCEPTED: "active", EXPIRED: "expired", REVOKED: "cancelled" };

  function badge(tone, label) {
    return `<span class="status ${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
  }

  function skeleton(lines = 3) {
    return `<div class="ws-skeleton" aria-hidden="true">${'<span></span>'.repeat(lines)}</div>`;
  }

  function emptyCard(text) {
    return `<div class="ws-empty">${escapeHtml(text)}</div>`;
  }

  function noPermissionCard(text) {
    return `<div class="ws-empty ws-empty--lock"><strong>Sem permissão</strong><span>${escapeHtml(text)}</span></div>`;
  }

  function errorCard(message, retryAction) {
    return `<div class="ws-empty ws-empty--error"><strong>Falha ao carregar</strong><span>${escapeHtml(message)}</span>${retryAction ? `<button class="secondary btn-mini" type="button" data-action="${escapeHtml(retryAction)}">Tentar novamente</button>` : ""}</div>`;
  }

  /* --------------------------------------------------------------- toasts */
  const toastRegion = $("wsToastRegion");
  let toastTimer = null;
  function toast(message, tone = "success") {
    if (!toastRegion) return;
    toastRegion.innerHTML = `<div class="ws-toast ws-toast--${escapeHtml(tone)}">${escapeHtml(message)}</div>`;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toastRegion.innerHTML = ""; }, 4200);
  }

  /* --------------------------------------------------------------- modal */
  const wsModal = $("wsModal");
  const wsModalTitle = $("wsModalTitle");
  const wsModalBody = $("wsModalBody");
  const wsModalActions = $("wsModalActions");
  let modalOpener = null;

  function openModal({ title, body, actions }) {
    if (!wsModal) return;
    modalOpener = document.activeElement;
    wsModalTitle.textContent = title;
    wsModalBody.innerHTML = body;
    wsModalActions.innerHTML = actions || `<button class="secondary" type="button" data-ws-modal-close>Fechar</button>`;
    wsModal.hidden = false;
    const focusable = wsModal.querySelector("input, select, textarea, button:not([data-ws-modal-close])");
    (focusable || wsModal.querySelector("button"))?.focus();
  }

  function closeModal() {
    if (!wsModal || wsModal.hidden) return;
    wsModal.hidden = true;
    wsModalBody.innerHTML = "";
    wsModalActions.innerHTML = "";
    if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
    modalOpener = null;
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-ws-modal-close]")) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && wsModal && !wsModal.hidden) closeModal();
  });

  /* ----------------------------------------------------------- top banner */
  function setBanner(html) {
    const region = $("wsBanner");
    if (region) region.innerHTML = html || "";
  }

  /* ============================================================ AUTH FLOW */
  const authView = $("authView");
  const workspaceShell = $("workspaceShell");
  const loginForm = $("loginForm");
  const loginError = $("loginError");
  const tenantPicker = $("tenantPicker");
  const tenantList = $("tenantList");

  function showAuth(message) {
    state.me = null;
    state.tenantId = null;
    state.context = null;
    workspaceShell.hidden = true;
    authView.hidden = false;
    tenantPicker.hidden = true;
    loginForm.closest(".ws-auth-card").hidden = false;
    if (message) {
      loginError.textContent = message;
      loginError.hidden = false;
    } else {
      loginError.hidden = true;
    }
  }

  function showPicker() {
    authView.hidden = false;
    workspaceShell.hidden = true;
    loginForm.closest(".ws-auth-card").hidden = true;
    tenantPicker.hidden = false;
    tenantList.innerHTML = state.me.tenants.map((tenant) => {
      const statusLabel = LABELS.tenantStatus[tenant.status] || tenant.status;
      const membershipLabel = LABELS.membershipStatus[tenant.membershipStatus] || tenant.membershipStatus;
      return `
        <button class="ws-tenant-option" type="button" role="listitem" data-tenant-id="${escapeHtml(tenant.id)}">
          <span class="company-avatar" aria-hidden="true">${escapeHtml(initials(tenant.displayName))}</span>
          <span class="ws-tenant-copy">
            <strong>${escapeHtml(tenant.displayName)}</strong>
            <small>${escapeHtml(tenant.slug)} · vínculo ${escapeHtml(membershipLabel)}</small>
          </span>
          ${badge(TENANT_TONE[tenant.status] || "notc", statusLabel)}
        </button>`;
    }).join("");
  }

  tenantList?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-tenant-id]");
    if (option) selectTenant(option.dataset.tenantId);
  });

  $("pickerLogout")?.addEventListener("click", () => doLogout());

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    if (!email || !password) return;
    const submit = $("loginSubmit");
    submit.disabled = true;
    submit.textContent = "Autenticando…";
    loginError.hidden = true;
    try {
      const session = await api.login(email, password);
      Core.setToken(session.accessToken);
      await loadMe();
    } catch (error) {
      showAuth(Core.friendlyError(error));
    } finally {
      submit.disabled = false;
      submit.textContent = "Entrar no Workspace";
    }
  });

  Core.onUnauthenticated(() => {
    try { window.sessionStorage.removeItem(STORAGE_TENANT); } catch (_) { /* noop */ }
    showAuth("Sessão expirada. Autentique-se novamente.");
  });

  let logoutPending = false;
  async function doLogout() {
    if (logoutPending) return;
    logoutPending = true;
    workspaceShell.hidden = true;
    authView.hidden = true;
    let message = "Sessão encerrada.";
    try {
      await Core.logout();
    } catch (error) {
      message = `Estado local encerrado; não foi possível confirmar a revogação no CORE. ${Core.friendlyError(error)}`;
      console.warn('[Workspace] Logout remoto não confirmado:', error?.code || 'UNKNOWN_ERROR', error?.requestId || '');
    } finally {
      Core.clearSession();
      try { window.sessionStorage.removeItem(STORAGE_TENANT); } catch (_) { /* noop */ }
      showAuth(message);
      logoutPending = false;
    }
  }

  async function loadMe() {
    const me = await api.me();
    state.me = me;

    $("sessionIdentity").hidden = false;
    $("sessionAvatar").textContent = initials(me.user.fullName);
    $("sessionUserName").textContent = me.user.fullName;
    $("sessionUserEmail").textContent = me.user.email;
    const greeting = $("routexGreeting");
    if (greeting) greeting.textContent = `Olá, ${me.user.fullName.split(/\s+/)[0]}.`;

    if (!me.tenants.length) {
      showAuth("Seu usuário está autenticado, porém sem vínculo com organizações. Solicite um convite ao administrador.");
      return;
    }
    let preferred = null;
    try { preferred = window.sessionStorage.getItem(STORAGE_TENANT); } catch (_) { /* noop */ }
    const remembered = me.tenants.find((tenant) => tenant.id === preferred);
    if (remembered) return selectTenant(remembered.id);
    if (me.tenants.length === 1) return selectTenant(me.tenants[0].id);
    showPicker();
  }

  /* ======================================================== TENANT CONTEXT */
  async function selectTenant(tenantId) {
    state.tenantId = tenantId;
    state.blocked = null;
    try { window.sessionStorage.setItem(STORAGE_TENANT, tenantId); } catch (_) { /* noop */ }

    authView.hidden = true;
    workspaceShell.hidden = false;
    $("switchTenant").hidden = !(state.me && state.me.tenants.length > 1);
    renderLoadingShell();

    try {
      if (!state.catalog) state.catalog = await api.catalog();
    } catch (error) {
      setBanner(`<div class="ws-banner ws-banner--error"><strong>Catálogo indisponível.</strong><span>${escapeHtml(Core.friendlyError(error))}</span><button class="secondary btn-mini" type="button" data-action="retry-context">Tentar novamente</button></div>`);
      return;
    }

    try {
      state.context = await api.meContext(tenantId);
    } catch (error) {
      state.context = null;
      if (error.code === "TENANT_NOT_ACTIVE") {
        state.blocked = { kind: "TENANT", message: "Esta organização está suspensa. Os dados permanecem preservados e o acesso será restabelecido após regularização." };
      } else if (error.code === "MEMBERSHIP_NOT_ACTIVE") {
        state.blocked = { kind: "MEMBERSHIP", message: "Seu vínculo com esta organização está suspenso. Procure o administrador da organização." };
      } else {
        setBanner(`<div class="ws-banner ws-banner--error"><strong>Não foi possível carregar a organização.</strong><span>${escapeHtml(Core.friendlyError(error))}</span><button class="secondary btn-mini" type="button" data-action="retry-context">Tentar novamente</button></div>`);
        return;
      }
      renderBlocked();
      return;
    }

    setBanner("");
    renderContext();
    loadSecondaryData();
  }

  function renderLoadingShell() {
    setBanner("");
    $("stripTenant").textContent = "Carregando…";
    $("stripStatus").textContent = "—";
    $("stripMembership").textContent = "—";
    $("tenantName").textContent = "Carregando…";
    $("tenantTagline").textContent = "Sincronizando com o Platform Core.";
    $("tenantAvatar").textContent = "…";
    ["factSlug", "factStatus", "factMembership", "factRoles", "factUnits"].forEach((id) => { $(id).textContent = "—"; });
    $("metricsGrid").innerHTML = `<article class="metric-card">${skeleton(2)}</article>`.repeat(4);
    $("moduleGrid").innerHTML = `<article class="module-card">${skeleton(4)}</article>`.repeat(4);
    $("teamActions").innerHTML = "";
    $("teamContent").innerHTML = skeleton(4);
    $("invitesBlock").innerHTML = "";
    $("securityContent").innerHTML = skeleton(4);
    $("licenseContent").innerHTML = skeleton(3);
    $("marketContent").innerHTML = `<article class="market-card">${skeleton(3)}</article>`.repeat(2);
    $("settingsContent").innerHTML = skeleton(3);
  }

  function renderBlocked() {
    const tenant = state.me.tenants.find((item) => item.id === state.tenantId);
    const name = tenant ? tenant.displayName : "Organização";
    const statusLabel = tenant ? (LABELS.tenantStatus[tenant.status] || tenant.status) : "—";

    $("stripTenant").textContent = name;
    $("stripStatus").innerHTML = badge(TENANT_TONE[tenant?.status] || "suspended", statusLabel);
    $("stripMembership").textContent = state.blocked.kind === "MEMBERSHIP" ? "Vínculo suspenso" : "—";
    $("tenantAvatar").textContent = initials(name);
    $("tenantName").textContent = name;
    $("tenantTagline").textContent = state.blocked.message;

    setBanner(`<div class="ws-banner ws-banner--warning"><strong>${state.blocked.kind === "TENANT" ? "Organização suspensa" : "Vínculo suspenso"}.</strong><span>${escapeHtml(state.blocked.message)}</span></div>`);

    const blockedCard = `<div class="ws-empty ws-empty--lock"><strong>${state.blocked.kind === "TENANT" ? "Acesso suspenso" : "Vínculo suspenso"}</strong><span>${escapeHtml(state.blocked.message)}</span></div>`;
    ["factSlug", "factStatus", "factMembership", "factRoles", "factUnits"].forEach((id) => { $(id).textContent = "—"; });
    $("factStatus").innerHTML = badge("suspended", statusLabel);
    $("metricsGrid").innerHTML = "";
    $("moduleGrid").innerHTML = blockedCard;
    $("teamActions").innerHTML = "";
    $("teamContent").innerHTML = blockedCard;
    $("invitesBlock").innerHTML = "";
    $("securityContent").innerHTML = blockedCard;
    $("licenseContent").innerHTML = blockedCard;
    $("marketContent").innerHTML = "";
    $("settingsContent").innerHTML = blockedCard;
  }

  /* ------------------------------------------------------------ render base */
  function renderContext() {
    const { tenant, membership, roles, units } = state.context;
    const tenantInfo = state.me.tenants.find((item) => item.id === tenant.id);
    const displayName = tenantInfo ? tenantInfo.displayName : tenant.slug;
    const statusLabel = LABELS.tenantStatus[tenant.status] || tenant.status;
    const membershipLabel = membership.isTenantOwner ? "Tenant Owner" : (roles.some((role) => role.key === "TENANT_ADMIN") ? "Tenant Admin" : "Membro");

    $("stripTenant").textContent = displayName;
    $("stripStatus").innerHTML = badge(TENANT_TONE[tenant.status] || "notc", statusLabel);
    $("stripMembership").textContent = membershipLabel;

    $("tenantAvatar").textContent = initials(displayName);
    $("tenantName").textContent = displayName;
    $("tenantTagline").textContent = `Identificador ${tenant.slug} · dados resolvidos pelo Platform Core.`;

    $("factSlug").textContent = tenant.slug;
    $("factStatus").innerHTML = badge(TENANT_TONE[tenant.status] || "notc", statusLabel);
    $("factMembership").textContent = membershipLabel;
    $("factRoles").textContent = roles.length ? roles.map((role) => role.name).join(", ") : "—";
    $("factUnits").textContent = String(units.length);

    renderMetrics();
    renderModules();
    renderMarketplace();

    if (tenant.status === "TRIAL") {
      setBanner(`<div class="ws-banner ws-banner--info"><strong>Organização em período de avaliação (Trial).</strong><span>Estados e limites seguem o contrato vigente no Platform Core.</span></div>`);
    }
  }

  function renderMetrics() {
    const modules = state.context.modules || [];
    const catalogTotal = (state.catalog?.modules || []).length || 4;
    const withAccess = modules.filter((module) => module.hasEffectiveAccess).length;
    const mySeats = modules.filter((module) => module.hasSeat).length;
    const rolesCount = state.context.roles.length;
    const unitsCount = state.context.units.length;

    $("metricsGrid").innerHTML = `
      <article class="metric-card"><span>Módulos com acesso</span><strong>${withAccess}</strong><small>de ${catalogTotal} do catálogo oficial</small></article>
      <article class="metric-card"><span>Suas licenças</span><strong>${mySeats}</strong><small>licenças atribuídas ao seu usuário</small></article>
      <article class="metric-card"><span>Seus papéis</span><strong>${rolesCount}</strong><small>${escapeHtml(state.context.roles.map((role) => role.name).join(", ") || "nenhum papel")}</small></article>
      <article class="metric-card"><span>Unidades visíveis</span><strong>${unitsCount}</strong><small>estrutura organizacional autorizada</small></article>`;
  }

  /* ------------------------------------------------------------- módulos */
  function moduleEntry(moduleKey) {
    const found = (state.context.modules || []).find((module) => module.moduleKey === moduleKey);
    return found || { moduleKey, entitlementState: "NOT_CONTRACTED", entitlementEffective: false, seatTypeKey: null, hasSeat: false, hasEffectiveAccess: false };
  }

  function renderModules() {
    const links = Core.moduleLinks();
    const catalogModules = (state.catalog?.modules || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const canManageTeam = can(PERM.MEMBER_READ);

    $("moduleGrid").innerHTML = catalogModules.map((catalogModule) => {
      const meta = MODULE_META[catalogModule.key] || { short: "?", iconClass: "planning", fallbackName: catalogModule.name };
      const entry = moduleEntry(catalogModule.key);
      const stateLabel = LABELS.entitlementState[entry.entitlementState] || entry.entitlementState;
      const tone = ENT_TONE[entry.entitlementState] || "notc";
      const seatLabel = entry.seatTypeKey ? (LABELS.seatType[entry.seatTypeKey] || entry.seatTypeKey) : "—";

      let footer = "";
      let extraNote = "";

      if (entry.hasEffectiveAccess) {
        const url = links[catalogModule.key];
        footer = url
          ? `<a class="ws-btn-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">Acessar</a>`
          : `<button type="button" data-action="module-url-missing" data-module="${escapeHtml(catalogModule.key)}">Acessar</button>`;
      } else if (entry.entitlementEffective && !entry.hasSeat) {
        if (canManageTeam) {
          footer = `<button type="button" data-action="go-team">Gerenciar equipe</button>`;
          extraNote = `<p class="ws-card-note">Módulo contratado. Atribua licenças na gestão de equipe.</p>`;
        } else {
          footer = "";
          extraNote = `<p class="ws-card-note">Sem licença atribuída ao seu usuário. Solicite ao administrador da organização.</p>`;
        }
      } else if (entry.entitlementState === "SUSPENDED") {
        extraNote = `<p class="ws-card-note">Módulo suspenso — dados preservados. Regularize a contratação para restabelecer o acesso.</p>`;
        footer = `<a class="ws-btn-link secondary" href="mailto:comercial@routflex.com.br?subject=Reativa%C3%A7%C3%A3o%20de%20m%C3%B3dulo%20ROUTflex">Falar com o comercial</a>`;
      } else if (entry.entitlementState === "EXPIRED" || entry.entitlementState === "CANCELLED") {
        extraNote = `<p class="ws-card-note">Contratação ${stateLabel.toLowerCase()}. O time comercial pode reativar o módulo.</p>`;
        footer = `<a class="ws-btn-link secondary" href="mailto:comercial@routflex.com.br?subject=Contrata%C3%A7%C3%A3o%20ROUTflex">Regularizar contratação</a>`;
      } else {
        footer = `
          <a class="ws-btn-link secondary" href="index.html" target="_blank" rel="noopener">Conhecer</a>
          <a class="ws-btn-link" href="mailto:comercial@routflex.com.br?subject=Contratar%20${encodeURIComponent(catalogModule.name)}">Contratar</a>`;
      }

      return `
        <article class="module-card${entry.hasEffectiveAccess ? " module-active" : ""}">
          <div class="module-head">
            <span class="module-icon ${escapeHtml(meta.iconClass)}">${escapeHtml(meta.short)}</span>
            ${badge(tone, stateLabel)}
          </div>
          <h3>${escapeHtml(catalogModule.name)}</h3>
          <p>${escapeHtml(catalogModule.description || "")}</p>
          <dl class="module-meta">
            <div><dt>Contratação</dt><dd>${escapeHtml(stateLabel)}</dd></div>
            <div><dt>Sua licença</dt><dd>${escapeHtml(entry.hasSeat ? seatLabel : "Não atribuída")}</dd></div>
            <div><dt>Acesso</dt><dd>${entry.hasEffectiveAccess ? "Liberado pelo Core" : "Não liberado"}</dd></div>
          </dl>
          ${extraNote}
          <div class="ws-card-actions">${footer}</div>
        </article>`;
    }).join("");
  }

  function renderMarketplace() {
    const catalogModules = (state.catalog?.modules || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const notContracted = catalogModules.filter((catalogModule) => {
      const entry = moduleEntry(catalogModule.key);
      return entry.entitlementState === "NOT_CONTRACTED" || entry.entitlementState === "CANCELLED" || entry.entitlementState === "EXPIRED";
    });

    if (!notContracted.length) {
      $("marketContent").innerHTML = emptyCard("Todos os módulos do catálogo oficial já estão contratados por esta organização.");
      return;
    }

    $("marketContent").innerHTML = notContracted.map((catalogModule) => {
      const entry = moduleEntry(catalogModule.key);
      const stateLabel = LABELS.entitlementState[entry.entitlementState] || entry.entitlementState;
      return `
        <article class="market-card">
          <span class="market-status">${escapeHtml(stateLabel)}</span>
          <h3>${escapeHtml(catalogModule.name)}</h3>
          <p>${escapeHtml(catalogModule.description || "")}</p>
          <small><strong>Origem:</strong> catálogo oficial do Platform Core.</small>
          <div>
            <a class="ws-btn-link" href="mailto:comercial@routflex.com.br?subject=Contratar%20${encodeURIComponent(catalogModule.name)}">Contratar</a>
            <a class="ws-btn-link secondary" href="index.html" target="_blank" rel="noopener">Conhecer</a>
          </div>
        </article>`;
    }).join("");
  }

  /* ==================================================== SECONDARY LOADERS */
  function loadSecondaryData() {
    loadTeam();
    loadInvitations();
    loadSeats();
    loadSecurity();
    loadSettings();
  }

  async function loadTeam() {
    const container = $("teamContent");
    const actions = $("teamActions");
    actions.innerHTML = "";

    if (!can(PERM.MEMBER_READ)) {
      container.innerHTML = noPermissionCard("A listagem de usuários exige a permissão core.member.read concedida a um dos seus papéis.");
      return;
    }
    container.innerHTML = skeleton(4);
    try {
      const [memberships, roles] = await Promise.all([
        api.tenantMemberships(state.tenantId, { limit: 100 }),
        can(PERM.ROLE_READ) ? api.tenantRoles(state.tenantId) : Promise.resolve(null),
      ]);
      state.memberships = memberships;
      state.roles = roles;
      renderTeam();
    } catch (error) {
      container.innerHTML = errorCard(Core.friendlyError(error), "retry-team");
    }
  }

  function renderTeam() {
    const container = $("teamContent");
    const actions = $("teamActions");
    const memberships = state.memberships || [];

    const buttons = [];
    if (can(PERM.MEMBER_INVITE)) buttons.push(`<button type="button" data-action="open-invite">Convidar usuário</button>`);
    buttons.push(`<button class="secondary" type="button" data-action="retry-team">Atualizar</button>`);
    actions.innerHTML = buttons.join("");

    if (!memberships.length) {
      container.innerHTML = emptyCard("Nenhum usuário vinculado a esta organização.");
      return;
    }

    const canSeats = can(PERM.SEAT_ASSIGN) || can(PERM.SEAT_RELEASE);
    const rows = memberships.map((member) => {
      const memberStatusLabel = LABELS.membershipStatus[member.status] || member.status;
      const seatPills = member.seats.filter((seat) => seat.state === "ACTIVE").map((seat) => {
        const meta = MODULE_META[seat.moduleKey] || { short: "?", iconClass: "planning" };
        return `<span class="ws-seat-pill ${escapeHtml(meta.iconClass)}" title="${escapeHtml(LABELS.seatType[seat.seatTypeKey] || seat.seatTypeKey)}">${escapeHtml(meta.short)}</span>`;
      }).join("") || `<span class="ws-dim">—</span>`;

      const rowActions = [];
      if (canSeats) rowActions.push(`<button class="secondary btn-mini" type="button" data-action="member-seats" data-membership-id="${escapeHtml(member.membershipId)}">Licenças</button>`);
      const isSelf = state.me && member.user.id === state.me.user.id;
      if (!isSelf && member.status === "ACTIVE" && can(PERM.MEMBER_SUSPEND)) {
        rowActions.push(`<button class="secondary btn-mini" type="button" data-action="member-suspend" data-membership-id="${escapeHtml(member.membershipId)}">Suspender</button>`);
      }
      if (member.status === "SUSPENDED" && can(PERM.MEMBER_REACTIVATE)) {
        rowActions.push(`<button class="secondary btn-mini" type="button" data-action="member-reactivate" data-membership-id="${escapeHtml(member.membershipId)}">Reativar</button>`);
      }

      return `
        <tr>
          <td><strong>${escapeHtml(member.user.fullName)}</strong><br><span class="ws-dim">${escapeHtml(member.user.email)}</span></td>
          <td>${escapeHtml(member.roles.map((role) => role.name).join(", ") || "—")}</td>
          <td>${seatPills}</td>
          <td>${badge(MEMBER_TONE[member.status] || "notc", memberStatusLabel)}</td>
          <td class="ws-row-actions">${rowActions.join("") || "—"}</td>
        </tr>`;
    }).join("");

    container.innerHTML = `
      <div class="table-card">
        <table>
          <thead><tr><th scope="col">Usuário</th><th scope="col">Papéis</th><th scope="col">Licenças</th><th scope="col">Status</th><th scope="col">Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  async function loadInvitations() {
    const container = $("invitesBlock");
    if (!can(PERM.INVITATION_READ)) { container.innerHTML = ""; return; }
    container.innerHTML = skeleton(2);
    try {
      state.invitations = await api.tenantInvitations(state.tenantId);
      renderInvitations();
    } catch (error) {
      container.innerHTML = errorCard(Core.friendlyError(error), "retry-invites");
    }
  }

  function renderInvitations() {
    const container = $("invitesBlock");
    const pending = (state.invitations || []).filter((invite) => invite.status === "PENDING");
    const others = (state.invitations || []).filter((invite) => invite.status !== "PENDING").slice(0, 3);
    const list = pending.concat(others);

    if (!list.length) {
      container.innerHTML = `<div class="ws-subblock"><h3 class="ws-subtitle">Convites</h3>${emptyCard("Nenhum convite registrado.")}</div>`;
      return;
    }

    const rows = list.map((invite) => {
      const label = LABELS.invitationStatus[invite.status] || invite.status;
      const revokeButton = invite.status === "PENDING" && can(PERM.INVITATION_REVOKE)
        ? `<button class="secondary btn-mini" type="button" data-action="invite-revoke" data-invitation-id="${escapeHtml(invite.id)}" data-email="${escapeHtml(invite.email)}">Revogar</button>`
        : "—";
      return `
        <tr>
          <td>${escapeHtml(invite.email)}</td>
          <td>${badge(INVITE_TONE[invite.status] || "notc", label)}</td>
          <td>${fmtDate(invite.expiresAt)}</td>
          <td class="ws-row-actions">${revokeButton}</td>
        </tr>`;
    }).join("");

    container.innerHTML = `
      <div class="ws-subblock">
        <h3 class="ws-subtitle">Convites ${pending.length ? badge("paused", `${pending.length} pendente${pending.length > 1 ? "s" : ""}`) : ""}</h3>
        <div class="table-card">
          <table>
            <thead><tr><th scope="col">E-mail</th><th scope="col">Status</th><th scope="col">Expira em</th><th scope="col">Ação</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function loadSeats() {
    const container = $("licenseContent");
    if (!can(PERM.SEAT_READ)) {
      container.innerHTML = noPermissionCard("O consumo de licenças exige a permissão core.seat.read.");
      return;
    }
    container.innerHTML = skeleton(3);
    try {
      const [seats, entitlements] = await Promise.all([
        api.tenantSeats(state.tenantId),
        can(PERM.ENTITLEMENT_READ) ? api.tenantEntitlements(state.tenantId) : Promise.resolve(null),
      ]);
      state.seats = seats;
      state.entitlements = entitlements;
      renderSeats();
    } catch (error) {
      container.innerHTML = errorCard(Core.friendlyError(error), "retry-seats");
    }
  }

  function catalogModuleName(moduleKey) {
    const catalogModule = (state.catalog?.modules || []).find((item) => item.key === moduleKey);
    return catalogModule ? catalogModule.name : (MODULE_META[moduleKey]?.fallbackName || moduleKey);
  }

  function renderSeats() {
    const container = $("licenseContent");
    const seats = state.seats || [];
    if (!seats.length) {
      container.innerHTML = emptyCard("Nenhuma quota de licença contratada para esta organização.");
      return;
    }

    const blocks = seats.map((moduleSeats) => {
      const stateLabel = LABELS.entitlementState[moduleSeats.state] || moduleSeats.state;
      const tone = ENT_TONE[moduleSeats.state] || "notc";
      const entitlement = (state.entitlements || []).find((item) => item.moduleKey === moduleSeats.moduleKey);
      const dates = [];
      if (entitlement?.trialEndsAt) dates.push(`Trial até ${fmtDate(entitlement.trialEndsAt)}`);
      if (entitlement?.expiresAt) dates.push(`Expira em ${fmtDate(entitlement.expiresAt)}`);

      const rows = moduleSeats.seats.map((quota) => {
        const width = quota.ceiling > 0 ? Math.min(100, Math.round((quota.occupied / quota.ceiling) * 100)) : 0;
        const full = quota.available === 0;
        return `
          <div class="ws-seat-row">
            <span class="ws-seat-name">${escapeHtml(LABELS.seatType[quota.seatTypeKey] || quota.seatTypeKey)}</span>
            <strong>${quota.occupied} / ${quota.ceiling}</strong>
            <em class="ws-bar${full ? " is-full" : ""}${quota.inOverage ? " is-over" : ""}"><i style="width:${width}%"></i></em>
            ${full ? badge("suspended", "Limite atingido") : (quota.inOverage ? badge("paused", "Em excedente") : "")}
          </div>`;
      }).join("") || emptyCard("Sem quotas para este módulo.");

      return `
        <div class="ws-license-block">
          <div class="ws-license-head">
            <strong>${escapeHtml(catalogModuleName(moduleSeats.moduleKey))}</strong>
            ${badge(tone, stateLabel)}
            ${dates.length ? `<span class="ws-dim">${escapeHtml(dates.join(" · "))}</span>` : ""}
          </div>
          ${rows}
        </div>`;
    }).join("");

    container.innerHTML = `<div class="license-card ws-license-card">${blocks}</div><p class="ws-section-note">Valores de contratação, teto e consumo fornecidos diretamente pelo Platform Core — nenhum cálculo é feito no navegador.</p>`;
  }

  async function loadSecurity() {
    const container = $("securityContent");
    if (!can(PERM.AUDIT_READ)) {
      container.innerHTML = noPermissionCard("A auditoria da organização exige a permissão core.audit.read_tenant.");
      return;
    }
    container.innerHTML = skeleton(4);
    try {
      state.audit = await api.tenantAudit(state.tenantId, { limit: 8 });
      renderSecurity();
    } catch (error) {
      container.innerHTML = errorCard(Core.friendlyError(error), "retry-audit");
    }
  }

  function renderSecurity() {
    const container = $("securityContent");
    const events = Array.isArray(state.audit) ? state.audit : (state.audit?.items || []);
    if (!events.length) {
      container.innerHTML = emptyCard("Nenhum evento de auditoria registrado.");
      return;
    }
    const items = events.slice(0, 8).map((event) => `
      <div class="ws-audit-item">
        <span class="ws-dim">${fmtDate(event.occurredAt, true)}</span>
        <strong>${escapeHtml(event.action)}</strong>
        ${badge(event.result === "SUCCESS" ? "active" : "suspended", event.result === "SUCCESS" ? "Concluído" : "Negado")}
      </div>`).join("");
    container.innerHTML = `<div class="security-card ws-audit-card">${items}</div>`;
  }

  async function loadSettings() {
    const container = $("settingsContent");
    if (!can(PERM.TENANT_READ_SELF)) {
      container.innerHTML = noPermissionCard("Os dados corporativos exigem a permissão core.tenant.read_self.");
      return;
    }
    container.innerHTML = skeleton(3);
    try {
      state.tenantRecord = await api.tenantGet(state.tenantId);
      renderSettings();
    } catch (error) {
      container.innerHTML = errorCard(Core.friendlyError(error), "retry-settings");
    }
  }

  function renderSettings() {
    const record = state.tenantRecord;
    const rows = [
      ["Razão social", record.legalName || "—"],
      ["Documento", record.taxIdType && record.taxIdValue ? `${record.taxIdType} ${record.taxIdValue}` : "—"],
      ["Identificador", record.slug],
      ["País", record.primaryCountry || "—"],
      ["Idioma padrão", record.defaultLocale || "—"],
      ["Fuso horário", record.defaultTimezone || "—"],
      ["Moeda", record.defaultCurrency || "—"],
      ["Criada em", fmtDate(record.createdAt)],
      ["Conexão", `${Core.demoActive() ? "Fixtures de demonstração" : Core.apiBase()}`],
    ];
    $("settingsContent").innerHTML = `
      <div class="settings-card">
        ${rows.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join("")}
      </div>`;
  }

  /* =========================================================== TEAM ACTIONS */
  function memberById(membershipId) {
    return (state.memberships || []).find((member) => member.membershipId === membershipId);
  }

  function openInviteModal() {
    const roles = state.roles || [];
    const effectiveModules = (state.context.modules || []).filter((module) => module.entitlementEffective);
    const seatTypes = state.catalog?.seatTypes || [];
    const units = state.context.units || [];

    const rolesField = roles.length
      ? `<label class="ws-field"><span>Papéis do convidado</span>
           <span class="ws-check-list">${roles.map((role) => `
             <label class="ws-check"><input type="checkbox" name="inviteRole" value="${escapeHtml(role.id)}" ${role.key === "OPERATOR" ? "checked" : ""}> ${escapeHtml(role.name)}</label>`).join("")}
           </span>
         </label>`
      : `<p class="ws-form-error">Não foi possível carregar os papéis disponíveis (permissão core.role.read necessária).</p>`;

    const seatField = effectiveModules.length && seatTypes.length
      ? `<div class="ws-field-row">
           <label class="ws-field"><span>Licença inicial (opcional)</span>
             <select id="inviteSeatModule"><option value="">Sem licença inicial</option>${effectiveModules.map((module) => `<option value="${escapeHtml(module.moduleKey)}">${escapeHtml(catalogModuleName(module.moduleKey))}</option>`).join("")}</select>
           </label>
           <label class="ws-field"><span>Tipo de licença</span>
             <select id="inviteSeatType">${seatTypes.map((seatType) => `<option value="${escapeHtml(seatType.key)}">${escapeHtml(LABELS.seatType[seatType.key] || seatType.name || seatType.key)}</option>`).join("")}</select>
           </label>
         </div>`
      : "";

    const unitField = units.length
      ? `<label class="ws-field"><span>Restringir a unidades (opcional)</span>
           <span class="ws-check-list">${units.map((unit) => `
             <label class="ws-check"><input type="checkbox" name="inviteUnit" value="${escapeHtml(unit.id)}"> ${escapeHtml(unit.name)} (${escapeHtml(unit.code)})</label>`).join("")}
           </span>
         </label>`
      : "";

    openModal({
      title: "Convidar usuário",
      body: `
        <form id="inviteForm">
          <label class="ws-field"><span>E-mail</span><input id="inviteEmail" type="email" required placeholder="pessoa@empresa.com.br"></label>
          ${rolesField}
          ${seatField}
          ${unitField}
          <p class="ws-form-error" id="inviteError" role="alert" hidden></p>
        </form>`,
      actions: `
        <button class="secondary" type="button" data-ws-modal-close>Cancelar</button>
        <button type="button" data-action="submit-invite" ${roles.length ? "" : "disabled"}>Enviar convite</button>`,
    });
  }

  async function submitInvite() {
    const email = $("inviteEmail")?.value.trim();
    const roleIds = Array.from(document.querySelectorAll('input[name="inviteRole"]:checked')).map((input) => input.value);
    const unitIds = Array.from(document.querySelectorAll('input[name="inviteUnit"]:checked')).map((input) => input.value);
    const seatModule = $("inviteSeatModule")?.value || "";
    const seatType = $("inviteSeatType")?.value || "";
    const errorEl = $("inviteError");

    if (!email) { errorEl.textContent = "Informe o e-mail do convidado."; errorEl.hidden = false; return; }
    if (!roleIds.length) { errorEl.textContent = "Selecione ao menos um papel."; errorEl.hidden = false; return; }

    const payload = { email, intendedRoleIds: roleIds };
    if (unitIds.length) payload.intendedUnitIds = unitIds;
    if (seatModule && seatType) payload.intendedSeats = [{ moduleKey: seatModule, seatTypeKey: seatType }];

    try {
      const result = await api.tenantCreateInvitation(state.tenantId, payload);
      openModal({
        title: "Convite criado",
        body: `
          <p>Convite registrado para <strong>${escapeHtml(email)}</strong>.</p>
          <p class="ws-token-warning">O token abaixo é exibido <strong>uma única vez</strong>. Copie e envie ao convidado por canal seguro.</p>
          <div class="ws-token-box"><code id="inviteTokenValue">${escapeHtml(result.token)}</code><button class="secondary btn-mini" type="button" data-action="copy-token">Copiar</button></div>
          <p class="ws-dim">Expira em ${fmtDate(result.invitation?.expiresAt)}.</p>`,
        actions: `<button type="button" data-ws-modal-close>Concluir</button>`,
      });
      toast("Convite criado com sucesso.");
      loadInvitations();
    } catch (error) {
      errorEl.textContent = Core.friendlyError(error);
      errorEl.hidden = false;
    }
  }

  function openSeatModal(membershipId) {
    const member = memberById(membershipId);
    if (!member) return;
    const effectiveModules = (state.context.modules || []).filter((module) => module.entitlementEffective);
    const seatTypes = state.catalog?.seatTypes || [];
    const activeSeats = member.seats.filter((seat) => seat.state === "ACTIVE");

    const currentRows = activeSeats.length
      ? activeSeats.map((seat) => `
          <div class="ws-seat-row">
            <span class="ws-seat-name">${escapeHtml(catalogModuleName(seat.moduleKey))} · ${escapeHtml(LABELS.seatType[seat.seatTypeKey] || seat.seatTypeKey)}</span>
            ${can(PERM.SEAT_RELEASE) ? `<button class="secondary btn-mini" type="button" data-action="release-seat" data-membership-id="${escapeHtml(membershipId)}" data-seat-id="${escapeHtml(seat.seatAssignmentId)}">Liberar</button>` : ""}
          </div>`).join("")
      : emptyCard("Nenhuma licença ativa para este usuário.");

    const assignForm = can(PERM.SEAT_ASSIGN) && effectiveModules.length
      ? `<div class="ws-field-row">
           <label class="ws-field"><span>Módulo</span>
             <select id="seatModule">${effectiveModules.map((module) => `<option value="${escapeHtml(module.moduleKey)}">${escapeHtml(catalogModuleName(module.moduleKey))}</option>`).join("")}</select>
           </label>
           <label class="ws-field"><span>Tipo de licença</span>
             <select id="seatTypeSelect">${seatTypes.map((seatType) => `<option value="${escapeHtml(seatType.key)}">${escapeHtml(LABELS.seatType[seatType.key] || seatType.name || seatType.key)}</option>`).join("")}</select>
           </label>
         </div>
         <p class="ws-form-error" id="seatError" role="alert" hidden></p>`
      : `<p class="ws-dim">${can(PERM.SEAT_ASSIGN) ? "Nenhum módulo com contratação vigente." : "Atribuição de licenças exige a permissão core.seat.assign."}</p>`;

    openModal({
      title: `Licenças — ${member.user.fullName}`,
      body: `
        <div class="ws-subblock"><h3 class="ws-subtitle">Licenças atuais</h3>${currentRows}</div>
        <div class="ws-subblock"><h3 class="ws-subtitle">Atribuir nova licença</h3>${assignForm}</div>`,
      actions: `
        <button class="secondary" type="button" data-ws-modal-close>Fechar</button>
        ${can(PERM.SEAT_ASSIGN) && effectiveModules.length ? `<button type="button" data-action="assign-seat" data-membership-id="${escapeHtml(membershipId)}">Atribuir licença</button>` : ""}`,
    });
  }

  async function assignSeat(membershipId) {
    const moduleKey = $("seatModule")?.value;
    const seatTypeKey = $("seatTypeSelect")?.value;
    const errorEl = $("seatError");
    if (!moduleKey || !seatTypeKey) return;
    try {
      await api.tenantAssignSeat(state.tenantId, membershipId, { moduleKey, seatTypeKey });
      toast("Licença atribuída.");
      closeModal();
      await Promise.all([loadTeam(), loadSeats()]);
      if (state.me && memberById(membershipId)?.user.id === state.me.user.id) {
        state.context = await api.meContext(state.tenantId);
        renderContext();
      }
    } catch (error) {
      if (errorEl) {
        if (error.code === "SEAT_QUOTA_EXCEEDED" && error.details) {
          const det = error.details;
          errorEl.innerHTML = `<strong>Limite atingido.</strong> Contratadas: ${escapeHtml(String(det.contracted ?? "—"))} · Teto: ${escapeHtml(String(det.ceiling ?? "—"))} · Ocupadas: ${escapeHtml(String(det.occupied ?? "—"))} · Disponíveis: ${escapeHtml(String(det.available ?? "0"))}. Amplie a contratação com o comercial.`;
        } else {
          errorEl.textContent = Core.friendlyError(error);
        }
        errorEl.hidden = false;
      }
    }
  }

  async function releaseSeat(membershipId, seatAssignmentId) {
    try {
      await api.tenantReleaseSeat(state.tenantId, membershipId, seatAssignmentId);
      toast("Licença liberada.");
      closeModal();
      await Promise.all([loadTeam(), loadSeats()]);
      if (state.me && memberById(membershipId)?.user.id === state.me.user.id) {
        state.context = await api.meContext(state.tenantId);
        renderContext();
      }
    } catch (error) {
      toast(Core.friendlyError(error), "danger");
    }
  }

  function openSuspendMemberModal(membershipId) {
    const member = memberById(membershipId);
    if (!member) return;
    openModal({
      title: `Suspender ${member.user.fullName}?`,
      body: `
        <p>O usuário perderá acesso à organização até ser reativado. Esta ação é registrada em auditoria.</p>
        <label class="ws-field"><span>Motivo (obrigatório)</span><textarea id="suspendReason" rows="3" minlength="3" maxlength="500" placeholder="Descreva o motivo administrativo"></textarea></label>
        <p class="ws-form-error" id="suspendError" role="alert" hidden></p>`,
      actions: `
        <button class="secondary" type="button" data-ws-modal-close>Cancelar</button>
        <button type="button" data-action="confirm-suspend-member" data-membership-id="${escapeHtml(membershipId)}">Suspender usuário</button>`,
    });
  }

  async function confirmSuspendMember(membershipId) {
    const reason = $("suspendReason")?.value.trim() || "";
    const errorEl = $("suspendError");
    if (reason.length < 3) { errorEl.textContent = "Informe um motivo com pelo menos 3 caracteres."; errorEl.hidden = false; return; }
    try {
      await api.tenantSuspendMember(state.tenantId, membershipId, reason);
      toast("Usuário suspenso.");
      closeModal();
      loadTeam();
    } catch (error) {
      errorEl.textContent = Core.friendlyError(error);
      errorEl.hidden = false;
    }
  }

  async function reactivateMember(membershipId) {
    try {
      await api.tenantReactivateMember(state.tenantId, membershipId);
      toast("Usuário reativado.");
      loadTeam();
    } catch (error) {
      toast(Core.friendlyError(error), "danger");
    }
  }

  function openRevokeInviteModal(invitationId, email) {
    openModal({
      title: "Revogar convite?",
      body: `<p>O convite para <strong>${escapeHtml(email)}</strong> deixará de ser válido imediatamente.</p>`,
      actions: `
        <button class="secondary" type="button" data-ws-modal-close>Cancelar</button>
        <button type="button" data-action="confirm-revoke-invite" data-invitation-id="${escapeHtml(invitationId)}">Revogar convite</button>`,
    });
  }

  async function confirmRevokeInvite(invitationId) {
    try {
      await api.tenantRevokeInvitation(state.tenantId, invitationId);
      toast("Convite revogado.");
      closeModal();
      loadInvitations();
    } catch (error) {
      toast(Core.friendlyError(error), "danger");
    }
  }

  /* ------------------------------------------------------ delegated clicks */
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
      case "retry-context": selectTenant(state.tenantId); break;
      case "retry-team": loadTeam(); break;
      case "retry-invites": loadInvitations(); break;
      case "retry-seats": loadSeats(); break;
      case "retry-audit": loadSecurity(); break;
      case "retry-settings": loadSettings(); break;
      case "go-team": document.getElementById("usuarios")?.scrollIntoView({ behavior: "smooth", block: "start" }); break;
      case "module-url-missing":
        openModal({
          title: "Acesso liberado — URL não configurada",
          body: `<p>O Platform Core confirma seu acesso a este módulo, porém a URL de acesso não está configurada neste ambiente.</p><p class="ws-dim">Configuração local: chave <code>routflex.workspace.moduleLinks</code> no localStorage.</p>`,
        });
        break;
      case "open-invite": openInviteModal(); break;
      case "submit-invite": submitInvite(); break;
      case "member-seats": openSeatModal(target.dataset.membershipId); break;
      case "assign-seat": assignSeat(target.dataset.membershipId); break;
      case "release-seat": releaseSeat(target.dataset.membershipId, target.dataset.seatId); break;
      case "member-suspend": openSuspendMemberModal(target.dataset.membershipId); break;
      case "confirm-suspend-member": confirmSuspendMember(target.dataset.membershipId); break;
      case "member-reactivate": reactivateMember(target.dataset.membershipId); break;
      case "invite-revoke": openRevokeInviteModal(target.dataset.invitationId, target.dataset.email); break;
      case "confirm-revoke-invite": confirmRevokeInvite(target.dataset.invitationId); break;
      case "copy-token": {
        const token = $("inviteTokenValue")?.textContent || "";
        navigator.clipboard?.writeText(token).then(() => toast("Token copiado."), () => toast("Não foi possível copiar automaticamente.", "warning"));
        break;
      }
      default: break;
    }
  });

  $("switchTenant")?.addEventListener("click", () => {
    try { window.sessionStorage.removeItem(STORAGE_TENANT); } catch (_) { /* noop */ }
    showPicker();
  });

  /* ================================================================ NAV */
  const navLinks = Array.from(document.querySelectorAll(".workspace-nav a"));
  const sections = navLinks
    .map(link => document.getElementById(link.dataset.section))
    .filter(Boolean);

  function setActive(id) {
    navLinks.forEach(link => {
      link.classList.toggle("is-active", link.dataset.section === id);
    });

    const section = document.getElementById(id);
    if (section) {
      section.classList.remove("is-section-focus");
      window.requestAnimationFrame(() => section.classList.add("is-section-focus"));
    }
  }

  navLinks.forEach(link => {
    link.addEventListener("click", () => setActive(link.dataset.section));
  });

  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { threshold: [0.28, 0.48, 0.68] });
    sections.forEach(section => observer.observe(section));
  }

  /* ============================================================= LOGOUT */
  const logoutTrigger = document.getElementById("logoutTrigger");
  const logoutModal = document.getElementById("logoutModal");
  const logoutCancelButtons = document.querySelectorAll("[data-logout-cancel]");
  const logoutConfirm = document.querySelector("[data-logout-confirm]");

  function openLogoutModal() {
    if (!logoutModal) return;
    logoutModal.hidden = false;
    logoutConfirm?.focus();
  }

  function closeLogoutModal() {
    if (!logoutModal) return;
    logoutModal.hidden = true;
    logoutTrigger?.focus();
  }

  logoutTrigger?.addEventListener("click", openLogoutModal);
  logoutCancelButtons.forEach(button => button.addEventListener("click", closeLogoutModal));
  logoutConfirm?.addEventListener("click", () => {
    closeLogoutModal();
    doLogout();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && logoutModal && !logoutModal.hidden) closeLogoutModal();
  });

  /* ============================================================== ROUTEX */
  const routexTrigger = document.getElementById("routexTrigger");
  const routexPanel = document.getElementById("routexPanel");
  const routexClose = document.getElementById("routexClose");
  const routexConversation = document.getElementById("routexConversation");
  const routexForm = document.getElementById("routexQuestionForm");
  const routexQuestion = document.getElementById("routexQuestion");
  const routexReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let routexActivationTimer = null;

  const routexStatic = {
    modulos: {
      title: "Módulos ROUTflex",
      intro: "Claro. Sobre qual módulo você gostaria de saber mais?",
      actions: [["Planning", "planning"], ["OPS", "ops"], ["Palm", "palm"], ["Sales", "sales"]],
    },
    planning: {
      title: "ROUTflex Planning",
      intro: "Planejamento territorial e roteirização operacional para equipes de campo.",
      items: ["Balanceamento territorial", "Distribuição de clientes", "Planejamento de visitas", "Simulação operacional", "Controle de rotas"],
      actions: [["Conhecer OPS", "ops"], ["Voltar", "modulos"]],
    },
    ops: {
      title: "ROUTflex OPS",
      intro: "Centro de controle operacional para acompanhar execução, auditoria e rotina de campo.",
      items: ["Auditoria operacional", "Controle de execução", "Supply Chain", "Telemetria", "WhatsApp Operacional"],
      actions: [["Conhecer Palm", "palm"], ["Voltar", "modulos"]],
    },
    palm: {
      title: "ROUTflex Palm",
      intro: "Mobilidade em campo para registrar visitas, evidências e execução de rotas.",
      items: ["Execução de rotas", "Check-ins", "Telemetria", "Coleta de evidências", "Controle de visitas"],
      actions: [["Conhecer Sales", "sales"], ["Voltar", "modulos"]],
    },
    sales: {
      title: "ROUTflex Sales",
      intro: "CRM/ERP comercial para conectar vendas, pedidos e indicadores ao ecossistema ROUTflex.",
      items: ["CRM", "Pedidos", "Estoque", "Financeiro", "Indicadores comerciais"],
      actions: [["Conhecer Planning", "planning"], ["Voltar", "modulos"]],
    },
    fallback: {
      title: "ROUTEX",
      intro: "Esta funcionalidade será expandida em futuras versões do ROUTEX.",
    },
  };

  function routexAnswerFor(topic) {
    if (routexStatic[topic]) return routexStatic[topic];

    if (topic === "plano" && state.context) {
      const statusLabel = LABELS.tenantStatus[state.context.tenant.status] || state.context.tenant.status;
      const activeModules = (state.context.modules || []).filter((module) => module.entitlementEffective).map((module) => catalogModuleName(module.moduleKey));
      return {
        title: "Sua contratação",
        intro: `Dados atuais resolvidos pelo Platform Core para ${state.context.tenant.slug}.`,
        items: [
          `Status da organização: ${statusLabel}`,
          `Módulos com contratação vigente: ${activeModules.join(", ") || "nenhum"}`,
          "Detalhes de licenças na seção Licenciamento",
        ],
      };
    }
    if (topic === "licencas") {
      if (!can(PERM.SEAT_READ)) return { title: "Licenciamento", intro: "Seu papel atual não possui permissão para consultar o consumo de licenças." };
      if (state.seats) {
        const items = state.seats.flatMap((moduleSeats) => moduleSeats.seats.map((quota) => `${catalogModuleName(moduleSeats.moduleKey)} · ${LABELS.seatType[quota.seatTypeKey] || quota.seatTypeKey}: ${quota.occupied} de ${quota.ceiling}`));
        return { title: "Licenciamento", intro: "Consumo informado pelo Platform Core:", items: items.length ? items : ["Nenhuma quota contratada."] };
      }
      return { title: "Licenciamento", intro: "Os dados de licenças ainda estão sendo carregados." };
    }
    if (topic === "seguranca") {
      return can(PERM.AUDIT_READ)
        ? { title: "Segurança", intro: "A auditoria da organização está disponível na seção Segurança, alimentada pelos logs do Platform Core." }
        : { title: "Segurança", intro: "Seu papel atual não possui permissão de leitura de auditoria (core.audit.read_tenant)." };
    }
    if (topic === "marketplace" && state.context) {
      const notContracted = (state.catalog?.modules || []).filter((catalogModule) => moduleEntry(catalogModule.key).entitlementState === "NOT_CONTRACTED").map((catalogModule) => catalogModule.name);
      return {
        title: "Marketplace ROUTflex",
        intro: notContracted.length ? "Módulos do catálogo oficial ainda não contratados:" : "Todos os módulos do catálogo já estão contratados.",
        items: notContracted,
      };
    }
    if (topic === "usuarios") {
      if (!can(PERM.MEMBER_READ)) return { title: "Usuários", intro: "Seu papel atual não possui permissão para listar usuários (core.member.read)." };
      if (state.memberships) {
        const active = state.memberships.filter((member) => member.status === "ACTIVE").length;
        return { title: "Usuários", intro: `Esta organização possui ${state.memberships.length} vínculo(s), sendo ${active} ativo(s).` };
      }
      return { title: "Usuários", intro: "A lista de usuários ainda está sendo carregada." };
    }
    return routexStatic.fallback;
  }

  function normalizeTerm(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function findRoutexTopic(value) {
    const term = normalizeTerm(value);
    if (term.includes("planning") || term.includes("roteir") || term.includes("territ")) return "planning";
    if (term.includes("ops") || term.includes("operacion") || term.includes("auditoria")) return "ops";
    if (term.includes("palm") || term.includes("campo") || term.includes("check")) return "palm";
    if (term.includes("sales") || term.includes("crm") || term.includes("comercial")) return "sales";
    if (term.includes("plano") || term.includes("contrat")) return "plano";
    if (term.includes("licen")) return "licencas";
    if (term.includes("market")) return "marketplace";
    if (term.includes("segur") || term.includes("2fa") || term.includes("sso") || term.includes("senha")) return "seguranca";
    if (term.includes("usuario") || term.includes("user") || term.includes("acesso") || term.includes("convite")) return "usuarios";
    if (term.includes("modulo") || term.includes("modulos")) return "modulos";
    return "fallback";
  }

  function scrollRoutexToEnd() {
    if (routexConversation) routexConversation.scrollTop = routexConversation.scrollHeight;
  }

  function appendRoutexMessage(html, fromUser = false) {
    if (!routexConversation) return;
    const message = document.createElement("article");
    message.className = fromUser
      ? "routex-message routex-message-user"
      : "routex-message routex-message-system";
    message.innerHTML = html;
    routexConversation.appendChild(message);
    scrollRoutexToEnd();
  }

  function renderActionButtons(actions) {
    if (!actions || !actions.length) return "";
    return `
      <div class="routex-inline-actions">
        ${actions.map(([label, topic]) => `<button type="button" data-routex-topic="${topic}">${label}</button>`).join("")}
      </div>
    `;
  }

  function renderRoutexAnswer(topic) {
    const answer = routexAnswerFor(topic);
    const list = answer.items && answer.items.length
      ? `<ul>${answer.items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    appendRoutexMessage(`
      <h3>${escapeHtml(answer.title)}</h3>
      ${answer.intro ? `<p>${escapeHtml(answer.intro)}</p>` : ""}
      ${list}
      ${renderActionButtons(answer.actions)}
    `);
  }

  function appendRoutexProcessing() {
    if (!routexConversation) return null;
    const message = document.createElement("article");
    message.className = "routex-message routex-message-system routex-message-processing";
    message.setAttribute("role", "status");
    message.setAttribute("aria-label", "ROUTEX está processando a solicitação");
    message.innerHTML = `
      <span class="routex-processing-orb" aria-hidden="true"></span>
      <span class="routex-processing-copy">Analisando
        <span class="routex-processing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
      </span>
    `;
    routexConversation.appendChild(message);
    routexConversation.setAttribute("aria-busy", "true");
    scrollRoutexToEnd();
    return message;
  }

  function queueRoutexAnswer(topic, userLabel = "") {
    if (userLabel) appendRoutexMessage(`<p>${escapeHtml(userLabel)}</p>`, true);
    const processing = appendRoutexProcessing();
    routexTrigger?.classList.add("routex-is-processing");
    window.setTimeout(() => {
      processing?.remove();
      renderRoutexAnswer(topic);
      if (!routexConversation?.querySelector(".routex-message-processing")) {
        routexConversation?.setAttribute("aria-busy", "false");
        routexTrigger?.classList.remove("routex-is-processing");
      }
    }, routexReduceMotion ? 80 : 520);
  }

  function openRoutex() {
    if (!routexPanel) return;
    routexPanel.inert = false;
    routexPanel.classList.add("routex-is-open");
    routexPanel.setAttribute("aria-hidden", "false");
    routexTrigger?.setAttribute("aria-expanded", "true");
    routexTrigger?.setAttribute("aria-label", "Fechar ROUTEX");
    routexTrigger?.classList.remove("routex-is-activating");
    if (routexTrigger) void routexTrigger.offsetWidth;
    routexTrigger?.classList.add("routex-is-activating");
    if (routexActivationTimer) window.clearTimeout(routexActivationTimer);
    routexActivationTimer = window.setTimeout(() => {
      routexTrigger?.classList.remove("routex-is-activating");
      routexActivationTimer = null;
    }, 480);
    window.setTimeout(() => routexQuestion?.focus(), routexReduceMotion ? 0 : 180);
  }

  function closeRoutex() {
    if (!routexPanel) return;
    routexPanel.classList.remove("routex-is-open");
    routexPanel.setAttribute("aria-hidden", "true");
    routexPanel.inert = true;
    routexTrigger?.setAttribute("aria-expanded", "false");
    routexTrigger?.setAttribute("aria-label", "Abrir ROUTEX");
    routexTrigger?.focus();
  }

  routexTrigger?.addEventListener("click", () => {
    if (routexPanel?.classList.contains("routex-is-open")) closeRoutex();
    else openRoutex();
  });
  routexClose?.addEventListener("click", closeRoutex);
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-routex-topic]");
    if (!button || !routexPanel?.contains(button)) return;
    queueRoutexAnswer(button.dataset.routexTopic, button.textContent.trim());
  });
  routexForm?.addEventListener("submit", event => {
    event.preventDefault();
    const value = routexQuestion?.value.trim() || "";
    if (!value) return;
    queueRoutexAnswer(findRoutexTopic(value), value);
    if (routexQuestion) routexQuestion.value = "";
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && routexPanel?.classList.contains("routex-is-open")) closeRoutex();
  });

  /* ================================================================ BOOT */
  if (Core.demoRequested()) {
    const flag = $("demoFlag");
    if (flag) { flag.hidden = false; flag.removeAttribute("aria-hidden"); }
  }

  (async function boot() {
    const hadAccessToken = Boolean(Core.getToken());
    try {
      // /me é a autoridade; sem access, o cliente tenta refresh HttpOnly uma vez.
      await loadMe();
    } catch (error) {
      showAuth(error.status === 401 && !hadAccessToken ? undefined : Core.friendlyError(error));
    }
  })();
})();
