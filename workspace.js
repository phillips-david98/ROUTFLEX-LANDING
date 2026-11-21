/* =============================================================================
   ROUTflex Workspace — console do tenant conectado ao Platform Core
   -----------------------------------------------------------------------------
   Regras de ouro implementadas aqui:
   - Nenhum acesso é liberado pelo navegador: botões operacionais existem apenas
     quando o Platform Core responde hasEffectiveAccess = true.
   - Estados (NOT_CONTRACTED, TRIAL, ACTIVE, SUSPENDED, EXPIRED, CANCELLED,
     carregando, erro, vazio, sem permissão, limite atingido, convite pendente,
     tenant suspenso) refletem exclusivamente as respostas da API.
   - Nenhum dado fixo ou fixture participa da entrada oficial.
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
    ROLE_ASSIGN: "core.member.assign_role",
    ROLE_REVOKE: "core.member.revoke_role",
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
    generation: 0,
    loads: Object.create(null),
    modalScope: null,
    loginAttempt: null,
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
  const pendingUiTimers = new Set();

  // A tenant may be selected again before an earlier response completes (A → B → A).
  // Identity, tenant and generation must all still match before using any response.
  function captureContext(loader) {
    const scope = {
      generation: state.generation, tenantId: state.tenantId, me: state.me,
      userId: state.me?.user?.id, sessionId: state.me?.authenticationSessionId,
      loader, request: loader ? Symbol(loader) : null,
    };
    if (loader) state.loads[loader] = scope.request;
    return scope;
  }

  function isCurrentContext(scope) {
    return scope.generation === state.generation && scope.tenantId === state.tenantId &&
      scope.me === state.me && scope.userId === state.me?.user?.id &&
      scope.sessionId === state.me?.authenticationSessionId &&
      (!scope.loader || state.loads[scope.loader] === scope.request);
  }

  function validateTenantContext(context, scope) {
    const membership = scope.me?.tenants?.find((tenant) => tenant.id === scope.tenantId);
    if (!membership || context?.tenant?.id !== scope.tenantId ||
        !membership.membershipId || context?.membership?.id !== membership.membershipId) {
      throw { code: "INVALID_TENANT_CONTEXT", message: "O contexto retornado não corresponde à organização e ao vínculo selecionados." };
    }
    return context;
  }

  function invalidateContext(clearIdentity = false) {
    document.dispatchEvent(new CustomEvent('routflex:protected-context-cleared'));
    window.RoutflexBilling?.reset();
    state.generation += 1;
    state.loads = Object.create(null); // Logical cancellation; no claim that an accepted write was cancelled.
    state.tenantId = null;
    for (const key of ["context", "tenantRecord", "seats", "entitlements", "memberships", "invitations", "roles", "audit", "blocked"]) state[key] = null;
    if (clearIdentity) {
      state.me = null;
      state.catalog = null;
      state.loginAttempt = null;
      if ($("loginSubmit")) {
        $("loginSubmit").disabled = false;
        $("loginSubmit").textContent = "Entrar pela Landing";
      }
      for (const id of ["sessionAvatar", "sessionUserName", "sessionUserEmail", "tenantList"]) {
        const node = $(id);
        if (node) node.textContent = "";
      }
      if ($("sessionIdentity")) $("sessionIdentity").hidden = true;
      for (const id of ["loginEmail", "loginPassword"]) if ($(id)) $(id).value = "";
    }
    for (const id of ["stripTenant", "stripStatus", "stripMembership", "tenantName", "tenantTagline", "tenantAvatar", "factSlug", "factStatus", "factMembership", "factRoles", "factUnits", "metricsGrid", "moduleGrid", "teamActions", "teamContent", "invitesBlock", "securityContent", "licenseContent", "marketContent", "settingsContent", "wsBanner", "wsToastRegion", "routexConversation"]) {
      const node = $(id);
      if (node) node.textContent = "";
    }
    closeModal(false);
    if ($("logoutModal")) $("logoutModal").hidden = true;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = null;
    pendingUiTimers.forEach((timer) => window.clearTimeout(timer));
    pendingUiTimers.clear();
    if (routexActivationTimer) window.clearTimeout(routexActivationTimer);
    routexActivationTimer = null;
    if (routexPanel) {
      routexPanel.classList.remove("routex-is-open");
      routexPanel.setAttribute("aria-hidden", "true");
      routexPanel.inert = true;
    }
    routexConversation?.setAttribute("aria-busy", "false");
    if (routexConversation) routexConversation.innerHTML = routexWelcome;
    if ($("routexGreeting")) $("routexGreeting").textContent = state.me
      ? `Olá, ${state.me.user.fullName.split(/\s+/)[0]}.` : "Olá.";
    routexTrigger?.classList.remove("routex-is-processing", "routex-is-activating");
    routexTrigger?.setAttribute("aria-expanded", "false");
    routexTrigger?.setAttribute("aria-label", "Abrir ROUTEX");
    if (routexQuestion) routexQuestion.value = "";
  }

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
    state.modalScope = captureContext();
    modalOpener = document.activeElement;
    wsModalTitle.textContent = title;
    wsModalBody.innerHTML = body;
    wsModalActions.innerHTML = actions || `<button class="secondary" type="button" data-ws-modal-close>Fechar</button>`;
    wsModal.hidden = false;
    const focusable = wsModal.querySelector("input, select, textarea, button:not([data-ws-modal-close])");
    (focusable || wsModal.querySelector("button"))?.focus();
  }

  function closeModal(restoreFocus = true) {
    state.modalScope = null;
    if (!wsModal) return;
    wsModal.hidden = true;
    wsModalTitle.textContent = "";
    wsModalBody.innerHTML = "";
    wsModalActions.innerHTML = "";
    if (restoreFocus && modalOpener && document.contains(modalOpener)) modalOpener.focus();
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

  const transition = window.RoutflexTransition.create({
    intent: '/workspace.html', render: window.RoutflexTransition.panel(),
  });
  function clearProtected() {
    invalidateContext(true);
    workspaceShell.hidden = true; authView.hidden = true; tenantPicker.hidden = true;
    loginForm.closest('.ws-auth-card').hidden = true;
  }
  function showAuth(message) {
    clearProtected();
    transition.set('invalid', message || 'Não foi possível confirmar sua sessão.', () => window.location.reload());
  }

  function showPicker() {
    transition.set("valid");
    invalidateContext();
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

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.replace("/?returnTo=/workspace.html");
  });

  Core.onUnauthenticated(error => {
    const wasValid = Boolean(state.me);
    clearProtected(); transition.invalid(error, wasValid);
  });

  let logoutPending = false;
  async function doLogout() {
    if (logoutPending) return;
    logoutPending = true;
    try { await transition.logout(Core, clearProtected); }
    finally { logoutPending = false; }
  }

  async function loadMe() {
    const scope = captureContext("identity");
    let me;
    try { me = await api.me(); }
    catch (error) {
      if (!isCurrentContext(scope)) return;
      throw error;
    }
    if (!isCurrentContext(scope)) return;
    invalidateContext(true);
    state.me = me;

    // CORE's existing administrative role is PLATFORM_OWNER. No membership/seat
    // is required for the platform console; no browser-created role alias.
    if (me.user.platformRole === "PLATFORM_OWNER") {
      transition.navigate("/control-center/index.html");
      return;
    }

    // A field-only identity never renders administrative Workspace cards.
    const entry = await window.RoutflexDestination.resolve(Core, { me });
    if (state.me !== me) return;
    if (entry.kind === 'palm') { transition.navigate(entry.href); return; }
    if (entry.kind === 'blocked' || (entry.kind === 'choose' && entry.fieldOnly)) {
      transition.navigate('/?returnTo=/palm'); return;
    }

    $("sessionIdentity").hidden = false;
    $("sessionAvatar").textContent = initials(me.user.fullName);
    $("sessionUserName").textContent = me.user.fullName;
    $("sessionUserEmail").textContent = me.user.email;
    const greeting = $("routexGreeting");
    if (greeting) greeting.textContent = `Olá, ${me.user.fullName.split(/\s+/)[0]}.`;

    if (!me.tenants.length) {
      showPicker();
      tenantList.innerHTML = emptyCard("Seu usuário está autenticado, mas não possui acesso a uma organização. Solicite um convite ao administrador.");
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
    if (!state.me?.tenants?.some((tenant) => tenant.id === tenantId)) return;
    invalidateContext();
    state.tenantId = tenantId;
    const scope = captureContext();
    try { window.sessionStorage.setItem(STORAGE_TENANT, tenantId); } catch (_) { /* noop */ }

    authView.hidden = true;
    workspaceShell.hidden = false;
    transition.set("valid");
    $("switchTenant").hidden = !(state.me && state.me.tenants.length > 1);
    renderLoadingShell();

    try {
      if (!state.catalog) {
        const catalog = await api.catalog();
        if (!isCurrentContext(scope)) return;
        state.catalog = catalog;
      }
    } catch (error) {
      if (!isCurrentContext(scope)) return;
      setBanner(`<div class="ws-banner ws-banner--error"><strong>Catálogo indisponível.</strong><span>${escapeHtml(Core.friendlyError(error))}</span><button class="secondary btn-mini" type="button" data-action="retry-context">Tentar novamente</button></div>`);
      return;
    }

    try {
      const context = await api.meContext(tenantId);
      if (!isCurrentContext(scope)) return;
      state.context = validateTenantContext(context, scope);
    } catch (error) {
      if (!isCurrentContext(scope)) return;
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
    if ($("billingContent")) $("billingContent").innerHTML = blockedCard;
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
    const logos = {
      planning: "assets/Emblema de rota azul com três pontos.png",
      ops: "assets/Hub operacional azul com três conexões.png",
      palm: "assets/Emblema azul de execução móvel.png",
      sales: "assets/Emblema azul de crescimento em vendas.png",
    };
    const catalogModules = (state.catalog?.modules || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const canManageTeam = can(PERM.MEMBER_READ);

    $("moduleGrid").innerHTML = catalogModules.map((catalogModule) => {
      const meta = MODULE_META[catalogModule.key] || { short: "?", iconClass: "planning", fallbackName: catalogModule.name };
      const logo = Object.hasOwn(logos, catalogModule.key) ? logos[catalogModule.key] : null;
      const entry = moduleEntry(catalogModule.key);
      const stateLabel = LABELS.entitlementState[entry.entitlementState] || entry.entitlementState;
      const tone = ENT_TONE[entry.entitlementState] || "notc";
      const seatLabel = entry.seatTypeKey ? (LABELS.seatType[entry.seatTypeKey] || entry.seatTypeKey) : "—";

      let footer = "";
      let extraNote = "";

      if (catalogModule.key === "palm") {
        // Workspace presents management information; drivers enter PALM directly.
        extraNote = `<p class="ws-card-note">O motorista acessa suas rotas diretamente no PALM com sua conta. Este cartão reúne informações de acesso e licenciamento.</p>`;
        if (canManageTeam) footer = `<button type="button" data-action="go-team">Gerenciar equipe</button>`;
      } else if (entry.hasEffectiveAccess) {
        let url = links[catalogModule.key];
        if (url && (catalogModule.key === "ops" || catalogModule.key === "sales")) {
          // Preserve the selected CORE context; OPS revalidates this public hint.
          const destination = new URL(url);
          destination.searchParams.set("tenantId", state.context.tenant.id);
          url = destination.href;
        }
        footer = url
          ? `<a class="ws-btn-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Acessar</a>`
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
            <span class="module-icon ${escapeHtml(meta.iconClass)}">${logo ? `<img src="${escapeHtml(logo)}" alt="" width="48" height="48">` : escapeHtml(meta.short)}</span>
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
    loadBilling();
    loadTeam();
    loadInvitations();
    loadSeats();
    loadSecurity();
    loadSettings();
  }

  function loadBilling() {
    const scope = captureContext("billing");
    window.RoutflexBilling?.load({ tenantId: scope.tenantId, allowed: can("core.billing.read"),
      current: () => isCurrentContext(scope) && Boolean(state.context), api });
  }

  async function loadTeam() {
    const scope = captureContext("team");
    state.memberships = null;
    state.roles = null;
    const container = $("teamContent");
    const actions = $("teamActions");
    actions.innerHTML = "";

    if (!can(PERM.MEMBER_READ)) {
      state.memberships = null;
      state.roles = null;
      container.innerHTML = noPermissionCard("A listagem de usuários exige a permissão core.member.read concedida a um dos seus papéis.");
      return;
    }
    container.innerHTML = skeleton(4);
    try {
      const [memberships, roles] = await Promise.all([
        api.tenantMemberships(scope.tenantId, { limit: 100 }),
        can(PERM.ROLE_READ) ? api.tenantRoles(scope.tenantId) : Promise.resolve(null),
      ]);
      if (!isCurrentContext(scope)) return;
      state.memberships = memberships;
      state.roles = roles;
      renderTeam();
    } catch (error) {
      if (!isCurrentContext(scope)) return;
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
      if (state.context?.membership?.isTenantOwner && can(PERM.MEMBER_INVITE) && member.status === 'ACTIVE') rowActions.push(`<button class="secondary btn-mini" type="button" data-recovery-member="${escapeHtml(member.membershipId)}" data-recovery-tenant="${escapeHtml(state.context.tenant.id)}">Recuperar acesso</button>`);
      if (state.context?.membership?.isTenantOwner && can(PERM.ROLE_ASSIGN) && can(PERM.ROLE_REVOKE)) rowActions.push(`<button class="secondary btn-mini" type="button" data-action="member-planning-capabilities" data-membership-id="${escapeHtml(member.membershipId)}">Permissões Planning</button>`);
      if (canSeats) rowActions.push(`<button class="secondary btn-mini" type="button" data-action="member-seats" data-membership-id="${escapeHtml(member.membershipId)}">Licenças</button>`);
      if (can(PERM.ROLE_READ) && (can(PERM.ROLE_ASSIGN) || can(PERM.ROLE_REVOKE))) rowActions.push(`<button class="secondary btn-mini" type="button" data-action="member-roles" data-membership-id="${escapeHtml(member.membershipId)}">Papéis</button>`);
      const isSelf = state.me && member.user.id === state.me.user.id;
      if (!isSelf && !member.isTenantOwner && member.status === "ACTIVE" && can(PERM.MEMBER_SUSPEND)) {
        rowActions.push(`<button class="secondary btn-mini" type="button" data-action="member-suspend" data-membership-id="${escapeHtml(member.membershipId)}">Suspender</button>`);
      }
      if (member.status === "SUSPENDED" && can(PERM.MEMBER_REACTIVATE)) {
        rowActions.push(`<button class="secondary btn-mini" type="button" data-action="member-reactivate" data-membership-id="${escapeHtml(member.membershipId)}">Reativar</button>`);
      }

      return `
        <tr>
          <td><strong>${escapeHtml(member.user.fullName)}</strong> ${member.isTenantOwner ? badge("active", "OWNER") : ""}<br><span class="ws-dim">${escapeHtml(member.user.email)}</span></td>
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
    const scope = captureContext("invitations");
    state.invitations = null;
    const container = $("invitesBlock");
    if (!can(PERM.INVITATION_READ)) { state.invitations = null; container.innerHTML = ""; return; }
    container.innerHTML = skeleton(2);
    try {
      const invitations = await api.tenantInvitations(scope.tenantId);
      if (!isCurrentContext(scope)) return;
      state.invitations = invitations;
      renderInvitations();
    } catch (error) {
      if (!isCurrentContext(scope)) return;
      container.innerHTML = errorCard(Core.friendlyError(error), "retry-invites");
    }
  }

  function renderInvitations() {
    const container = $("invitesBlock");
    const pending = (state.invitations || []).filter((invite) => invite.status === "PENDING");
    const recoverable = (state.invitations || []).filter((invite) => invite.status === "EXPIRED" && invite.hasReservedSeats);
    const others = (state.invitations || []).filter((invite) => invite.status !== "PENDING" && !recoverable.includes(invite)).slice(0, 3);
    const list = pending.concat(recoverable, others);

    if (!list.length) {
      container.innerHTML = `<div class="ws-subblock"><h3 class="ws-subtitle">Convites</h3>${emptyCard("Nenhum convite registrado.")}</div>`;
      return;
    }

    const rows = list.map((invite) => {
      const label = LABELS.invitationStatus[invite.status] || invite.status;
      const revokeButton = (invite.status === "PENDING" || (invite.status === "EXPIRED" && invite.hasReservedSeats)) && can(PERM.INVITATION_REVOKE)
        ? `<button class="secondary btn-mini" type="button" data-action="invite-revoke" data-invitation-id="${escapeHtml(invite.id)}" data-email="${escapeHtml(invite.email)}">${invite.status === "EXPIRED" ? "Liberar reserva" : "Revogar"}</button>`
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
    const scope = captureContext("seats");
    state.seats = null;
    state.entitlements = null;
    const container = $("licenseContent");
    if (!can(PERM.SEAT_READ)) {
      state.seats = null;
      state.entitlements = null;
      container.innerHTML = noPermissionCard("O consumo de licenças exige a permissão core.seat.read.");
      return;
    }
    container.innerHTML = skeleton(3);
    try {
      const [seats, entitlements] = await Promise.all([
        api.tenantSeats(scope.tenantId),
        can(PERM.ENTITLEMENT_READ) ? api.tenantEntitlements(scope.tenantId) : Promise.resolve(null),
      ]);
      if (!isCurrentContext(scope)) return;
      state.seats = seats;
      state.entitlements = entitlements;
      renderSeats();
    } catch (error) {
      if (!isCurrentContext(scope)) return;
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
            <strong>${quota.contracted} contratados / ${quota.occupied} utilizados</strong>
            <span class="ws-dim">${quota.available} disponíveis · teto ${quota.ceiling}</span>
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
    const scope = captureContext("audit");
    state.audit = null;
    const container = $("securityContent");
    if (!can(PERM.AUDIT_READ)) {
      state.audit = null;
      container.innerHTML = noPermissionCard("A auditoria da organização exige a permissão core.audit.read_tenant.");
      return;
    }
    container.innerHTML = skeleton(4);
    try {
      const audit = await api.tenantAudit(scope.tenantId, { limit: 8 });
      if (!isCurrentContext(scope)) return;
      state.audit = audit;
      renderSecurity();
    } catch (error) {
      if (!isCurrentContext(scope)) return;
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
    const scope = captureContext("settings");
    state.tenantRecord = null;
    const container = $("settingsContent");
    if (!can(PERM.TENANT_READ_SELF)) {
      state.tenantRecord = null;
      container.innerHTML = noPermissionCard("Os dados corporativos exigem a permissão core.tenant.read_self.");
      return;
    }
    container.innerHTML = skeleton(3);
    try {
      const tenantRecord = await api.tenantGet(scope.tenantId);
      if (!isCurrentContext(scope)) return;
      state.tenantRecord = tenantRecord;
      renderSettings();
    } catch (error) {
      if (!isCurrentContext(scope)) return;
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
    const scope = captureContext();
    const modal = state.modalScope;
    const current = () => isCurrentContext(scope) && modal === state.modalScope;
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
      const result = await api.tenantCreateInvitation(scope.tenantId, payload);
      if (!current()) return;
      openModal({
        title: "Convite criado",
        body: `
          <p>Convite registrado para <strong>${escapeHtml(email)}</strong>.</p>
          <p class="ws-token-warning">O link abaixo é exibido <strong>uma única vez</strong>. Copie e envie ao convidado por canal seguro.</p>
          <div class="ws-token-box"><code id="inviteTokenValue">${escapeHtml(Core.invitationUrl(result.token, scope.tenantId))}</code><button class="secondary btn-mini" type="button" data-action="copy-token">Copiar link</button></div>
          <p class="ws-dim">Expira em ${fmtDate(result.invitation?.expiresAt)}.</p>`,
        actions: `<button type="button" data-ws-modal-close>Concluir</button>`,
      });
      toast("Convite criado com sucesso.");
      await Promise.all([loadInvitations(), loadSeats()]);
    } catch (error) {
      if (!current()) return;
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

  function validatePlanningCapabilities(result, tenantId, membershipId) {
    if (result?.tenantId !== tenantId || result?.membershipId !== membershipId ||
        typeof result.hasEffectiveAccess !== "boolean" || ["capabilities", "effectiveCapabilities"].some(field =>
          !result[field] || Object.keys(result[field]).length !== 3 ||
          ["edit", "import", "export"].some(key => typeof result[field][key] !== "boolean"))) {
      throw { code: "INVALID_PLANNING_CAPABILITIES", message: "Não foi possível confirmar as permissões deste usuário." };
    }
    return result;
  }

  async function openPlanningCapabilities(membershipId) {
    const member = memberById(membershipId);
    if (!member || !state.context?.membership?.isTenantOwner) return;
    const scope = captureContext("planning-capabilities");
    openModal({ title: `Permissões Planning — ${member.user.fullName}`, body: skeleton(3), actions: "" });
    const modal = state.modalScope;
    const current = () => isCurrentContext(scope) && modal === state.modalScope;
    try {
      const result = validatePlanningCapabilities(await api.tenantPlanningCapabilities(scope.tenantId, membershipId), scope.tenantId, membershipId);
      if (!current()) return;
      const caps = result.capabilities;
      wsModalBody.innerHTML = `<p>O usuário pode consultar o Planning quando tiver licença e assento ativos. As opções abaixo controlam o que ele pode fazer.</p>
        <div class="ws-check-list">
          <label><input id="planningCapabilityEdit" type="checkbox" ${caps.edit ? "checked" : ""}> Pode editar Planning</label>
          <label><input id="planningCapabilityImport" type="checkbox" ${caps.import ? "checked" : ""} ${caps.edit ? "" : "disabled"}> Pode importar clientes</label>
          <label><input id="planningCapabilityExport" type="checkbox" ${caps.export ? "checked" : ""}> Pode exportar clientes e baixar backup operacional com dados</label>
        </div><p class="ws-dim">Importar também exige edição. Publicação no OPS mantém sua autorização própria.</p>
        ${result.hasEffectiveAccess ? "" : '<p class="ws-dim">Sem acesso efetivo no momento. Confira a contratação e a licença atribuída ao usuário.</p>'}
        <p class="ws-form-error" id="planningCapabilitiesError" role="alert" hidden></p>`;
      wsModalActions.innerHTML = `<button class="secondary" type="button" data-ws-modal-close>Cancelar</button><button type="button" data-action="save-planning-capabilities" data-membership-id="${escapeHtml(membershipId)}">Salvar permissões</button>`;
      $("planningCapabilityEdit")?.addEventListener("change", () => {
        const edit = $("planningCapabilityEdit").checked, importing = $("planningCapabilityImport");
        importing.disabled = !edit;
        if (!edit) importing.checked = false;
      });
    } catch (error) {
      if (current()) wsModalBody.innerHTML = errorCard(Core.friendlyError(error));
    }
  }

  async function savePlanningCapabilities(membershipId, button) {
    const scope = captureContext("planning-capabilities-write"), modal = state.modalScope;
    const current = () => isCurrentContext(scope) && modal === state.modalScope;
    const payload = { edit: Boolean($("planningCapabilityEdit")?.checked),
      import: Boolean($("planningCapabilityImport")?.checked), export: Boolean($("planningCapabilityExport")?.checked) };
    if (payload.import && !payload.edit) return;
    button.disabled = true;
    try {
      validatePlanningCapabilities(await api.tenantSetPlanningCapabilities(scope.tenantId, membershipId, payload), scope.tenantId, membershipId);
      if (!current()) return;
      const isSelf = memberById(membershipId)?.user.id === state.me?.user.id;
      closeModal();
      toast("Permissões Planning atualizadas.");
      if (isSelf) await selectTenant(scope.tenantId);
      else { await loadTeam(); if (isCurrentContext(scope)) loadSecurity(); }
    } catch (error) {
      if (!current()) return;
      const line = $("planningCapabilitiesError");
      if (line) { line.textContent = Core.friendlyError(error); line.hidden = false; }
      button.disabled = false;
    }
  }

  function openRoleModal(membershipId) {
    const member = memberById(membershipId);
    if (!member) return;
    const assigned = new Set(member.roles.map((role) => role.id));
    const rows = (state.roles || []).map((role) => {
      const hasRole = assigned.has(role.id);
      const protectedRole = member.isTenantOwner && role.key === "TENANT_ADMIN";
      const allowed = hasRole ? can(PERM.ROLE_REVOKE) : can(PERM.ROLE_ASSIGN);
      return `<div class="ws-seat-row"><span class="ws-seat-name">${escapeHtml(role.name)} ${hasRole ? badge("active", "Atribuído") : ""}</span>
        ${protectedRole ? `<span class="ws-dim">Autoridade do OWNER preservada</span>` : allowed ? `<button class="secondary btn-mini" type="button" data-action="${hasRole ? "revoke-role" : "grant-role"}" data-membership-id="${escapeHtml(membershipId)}" data-role-id="${escapeHtml(role.id)}">${hasRole ? "Revogar" : "Atribuir"}</button>` : ""}</div>`;
    }).join("");
    openModal({ title: `Papéis — ${member.user.fullName}`, body: `<p>Os papéis valem somente nesta empresa. OWNER é designado pela plataforma.</p>${rows || emptyCard("Nenhum papel disponível.")}<p class="ws-form-error" id="roleError" role="alert" hidden></p>`, actions: `<button class="secondary" type="button" data-ws-modal-close>Fechar</button>` });
  }

  async function changeMemberRole(membershipId, roleId, grant, button) {
    const { generation, tenantId, me, modalScope } = state;
    const current = () => generation === state.generation && tenantId === state.tenantId && me === state.me && modalScope === state.modalScope;
    const isSelf = me && memberById(membershipId)?.user.id === me.user.id;
    button.disabled = true;
    try {
      if (grant) await api.tenantGrantRole(tenantId, membershipId, roleId);
      else await api.tenantRevokeRole(tenantId, membershipId, roleId);
      if (!current()) return;
      if (isSelf) {
        await selectTenant(tenantId);
        return;
      }
      await loadTeam();
      if (!current()) return;
      toast(grant ? "Papel atribuído." : "Papel revogado.");
      if (can(PERM.ROLE_READ) && (can(PERM.ROLE_ASSIGN) || can(PERM.ROLE_REVOKE))) openRoleModal(membershipId);
      else closeModal();
      loadSecurity();
    } catch (error) {
      if (!current()) return;
      const line = $("roleError");
      if (line) { line.textContent = Core.friendlyError(error); line.hidden = false; }
      button.disabled = false;
    }
  }

  async function assignSeat(membershipId) {
    const scope = captureContext();
    const modal = state.modalScope;
    const current = () => isCurrentContext(scope) && modal === state.modalScope;
    const isSelf = state.me && memberById(membershipId)?.user.id === state.me.user.id;
    const moduleKey = $("seatModule")?.value;
    const seatTypeKey = $("seatTypeSelect")?.value;
    const errorEl = $("seatError");
    if (!moduleKey || !seatTypeKey) return;
    try {
      await api.tenantAssignSeat(scope.tenantId, membershipId, { moduleKey, seatTypeKey });
      if (!current()) return;
      if (isSelf) { await selectTenant(scope.tenantId); return; }
      toast("Licença atribuída.");
      closeModal();
      await Promise.all([loadTeam(), loadSeats()]);
    } catch (error) {
      if (!current()) return;
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
    const scope = captureContext();
    const modal = state.modalScope;
    const current = () => isCurrentContext(scope) && modal === state.modalScope;
    const isSelf = state.me && memberById(membershipId)?.user.id === state.me.user.id;
    try {
      await api.tenantReleaseSeat(scope.tenantId, membershipId, seatAssignmentId);
      if (!current()) return;
      if (isSelf) { await selectTenant(scope.tenantId); return; }
      toast("Licença liberada.");
      closeModal();
      await Promise.all([loadTeam(), loadSeats()]);
    } catch (error) {
      if (!current()) return;
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
    const { generation, tenantId, me, modalScope } = state;
    const current = () => generation === state.generation && tenantId === state.tenantId && me === state.me && modalScope === state.modalScope;
    const reason = $("suspendReason")?.value.trim() || "";
    const errorEl = $("suspendError");
    if (reason.length < 3) { errorEl.textContent = "Informe um motivo com pelo menos 3 caracteres."; errorEl.hidden = false; return; }
    try {
      await api.tenantSuspendMember(tenantId, membershipId, reason);
      if (!current()) return;
      toast("Usuário suspenso.");
      closeModal();
      await Promise.all([loadTeam(), loadSeats()]);
    } catch (error) {
      if (!current()) return;
      errorEl.textContent = Core.friendlyError(error);
      errorEl.hidden = false;
    }
  }

  async function reactivateMember(membershipId) {
    const scope = captureContext();
    try {
      await api.tenantReactivateMember(scope.tenantId, membershipId);
      if (!isCurrentContext(scope)) return;
      toast("Usuário reativado.");
      loadTeam();
    } catch (error) {
      if (!isCurrentContext(scope)) return;
      toast(Core.friendlyError(error), "danger");
    }
  }

  function openRevokeInviteModal(invitationId, email) {
    const expired = (state.invitations || []).find((invite) => invite.id === invitationId)?.status === "EXPIRED";
    openModal({
      title: expired ? "Liberar reserva de convite expirado?" : "Revogar convite?",
      body: expired ? `<p>As licenças reservadas serão devolvidas à empresa. O convite permanece expirado.</p>` : `<p>O convite para <strong>${escapeHtml(email)}</strong> deixará de ser válido imediatamente.</p>`,
      actions: `
        <button class="secondary" type="button" data-ws-modal-close>Cancelar</button>
        <button type="button" data-action="confirm-revoke-invite" data-invitation-id="${escapeHtml(invitationId)}">${expired ? "Liberar reserva" : "Revogar convite"}</button>`,
    });
  }

  async function confirmRevokeInvite(invitationId) {
    const { generation, tenantId, me, modalScope } = state;
    const current = () => generation === state.generation && tenantId === state.tenantId && me === state.me && modalScope === state.modalScope;
    try {
      await api.tenantRevokeInvitation(tenantId, invitationId);
      if (!current()) return;
      toast("Convite encerrado; eventuais reservas foram liberadas.");
      closeModal();
      await Promise.all([loadInvitations(), loadSeats()]);
    } catch (error) {
      if (!current()) return;
      toast(Core.friendlyError(error), "danger");
    }
  }

  /* ------------------------------------------------------ delegated clicks */
  function actionAllowed(target) {
    if (!target || !document.contains(target) || workspaceShell.hidden || !state.me || !state.tenantId) return false;
    const action = target.dataset.action;
    if (action === "retry-context") return state.me.tenants.some((tenant) => tenant.id === state.tenantId);
    if (!state.context || state.context.tenant.id !== state.tenantId) return false;
    const modalAction = ["submit-invite", "grant-role", "revoke-role", "assign-seat", "release-seat", "confirm-suspend-member", "confirm-revoke-invite", "copy-token", "save-planning-capabilities"].includes(action);
    if ((modalAction || wsModal?.contains(target)) &&
        (!wsModal || wsModal.hidden || !wsModal.contains(target) || !state.modalScope || !isCurrentContext(state.modalScope))) return false;
    const required = {
      "open-invite": PERM.MEMBER_INVITE, "submit-invite": PERM.MEMBER_INVITE,
      "grant-role": PERM.ROLE_ASSIGN, "revoke-role": PERM.ROLE_REVOKE,
      "assign-seat": PERM.SEAT_ASSIGN, "release-seat": PERM.SEAT_RELEASE,
      "member-suspend": PERM.MEMBER_SUSPEND, "confirm-suspend-member": PERM.MEMBER_SUSPEND,
      "member-reactivate": PERM.MEMBER_REACTIVATE,
      "invite-revoke": PERM.INVITATION_REVOKE, "confirm-revoke-invite": PERM.INVITATION_REVOKE,
    }[action];
    if (required && !can(required)) return false;
    if (["member-planning-capabilities", "save-planning-capabilities"].includes(action) &&
        (!state.context.membership?.isTenantOwner || !can(PERM.ROLE_ASSIGN) || !can(PERM.ROLE_REVOKE))) return false;
    if (target.dataset.membershipId) {
      const member = memberById(target.dataset.membershipId);
      if (!member) return false;
      if (["member-suspend", "confirm-suspend-member"].includes(action) &&
          (member.isTenantOwner || member.user.id === state.me.user.id)) return false;
      if (action === "release-seat" && !member.seats?.some((seat) => seat.seatAssignmentId === target.dataset.seatId && seat.state === "ACTIVE")) return false;
    }
    if (target.dataset.roleId && !state.roles?.some((role) => role.id === target.dataset.roleId)) return false;
    if (target.dataset.invitationId && !state.invitations?.some((invite) => invite.id === target.dataset.invitationId)) return false;
    return true;
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!actionAllowed(target)) return;
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
          body: `<p>Seu acesso foi confirmado, mas este módulo ainda não está disponível neste ambiente. Entre em contato com o administrador.</p>`,
        });
        break;
      case "open-invite": openInviteModal(); break;
      case "submit-invite": submitInvite(); break;
      case "member-seats": openSeatModal(target.dataset.membershipId); break;
      case "member-roles": openRoleModal(target.dataset.membershipId); break;
      case "member-planning-capabilities": openPlanningCapabilities(target.dataset.membershipId); break;
      case "save-planning-capabilities": savePlanningCapabilities(target.dataset.membershipId, target); break;
      case "grant-role": changeMemberRole(target.dataset.membershipId, target.dataset.roleId, true, target); break;
      case "revoke-role": changeMemberRole(target.dataset.membershipId, target.dataset.roleId, false, target); break;
      case "assign-seat": assignSeat(target.dataset.membershipId); break;
      case "release-seat": releaseSeat(target.dataset.membershipId, target.dataset.seatId); break;
      case "member-suspend": openSuspendMemberModal(target.dataset.membershipId); break;
      case "confirm-suspend-member": confirmSuspendMember(target.dataset.membershipId); break;
      case "member-reactivate": reactivateMember(target.dataset.membershipId); break;
      case "invite-revoke": openRevokeInviteModal(target.dataset.invitationId, target.dataset.email); break;
      case "confirm-revoke-invite": confirmRevokeInvite(target.dataset.invitationId); break;
      case "copy-token": {
        const scope = captureContext();
        const modal = state.modalScope;
        const token = $("inviteTokenValue")?.textContent || "";
        navigator.clipboard?.writeText(token).then(
          () => { if (isCurrentContext(scope) && modal === state.modalScope) toast("Link copiado."); },
          () => { if (isCurrentContext(scope) && modal === state.modalScope) toast("Não foi possível copiar automaticamente.", "warning"); });
        break;
      }
      default: break;
    }
  });

  $("switchTenant")?.addEventListener("click", () => {
    try { window.sessionStorage.removeItem(STORAGE_TENANT); } catch (_) { /* noop */ }
    showPicker();
  });

  /* ====================================================== SIDEBAR VISUAL */
  const sidebarToggle = $("sidebarToggle");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const collapsed = workspaceShell.classList.toggle("is-sidebar-collapsed");
      const label = collapsed ? "Expandir menu lateral" : "Recolher menu lateral";
      sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
      sidebarToggle.setAttribute("aria-label", label);
      sidebarToggle.title = label;
    });
    sidebarToggle.hidden = false;
  }

  /* ================================================================ NAV */
  const navLinks = Array.from(document.querySelectorAll(".workspace-nav a"));
  const sections = navLinks
    .map(link => document.getElementById(link.dataset.section))
    .filter(Boolean);

  function setActive(id) {
    navLinks.forEach(link => {
      const active = link.dataset.section === id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
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

  function anchorSection() {
    const id = window.location.hash.slice(1);
    return sections.some(section => section.id === id) ? id : null;
  }
  function syncAnchor() {
    setActive(anchorSection() || "workspace");
  }
  window.addEventListener("hashchange", syncAnchor);
  syncAnchor();

  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(entries => {
      // An explicit URL anchor remains authoritative during async rendering,
      // reload and native smooth scrolling; another visible section cannot win.
      if (anchorSection()) return;
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
  const routexWelcome = routexConversation?.innerHTML || "";
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
    if (!state.context || workspaceShell.hidden) return;
    const scope = captureContext();
    if (userLabel) appendRoutexMessage(`<p>${escapeHtml(userLabel)}</p>`, true);
    const processing = appendRoutexProcessing();
    routexTrigger?.classList.add("routex-is-processing");
    const timer = window.setTimeout(() => {
      pendingUiTimers.delete(timer);
      if (!isCurrentContext(scope)) return;
      processing?.remove();
      renderRoutexAnswer(topic);
      if (!routexConversation?.querySelector(".routex-message-processing")) {
        routexConversation?.setAttribute("aria-busy", "false");
        routexTrigger?.classList.remove("routex-is-processing");
      }
    }, routexReduceMotion ? 80 : 520);
    pendingUiTimers.add(timer);
  }

  function openRoutex() {
    if (!routexPanel || !state.context || workspaceShell.hidden) return;
    const scope = captureContext();
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
    const timer = window.setTimeout(() => {
      pendingUiTimers.delete(timer);
      if (isCurrentContext(scope)) routexQuestion?.focus();
    }, routexReduceMotion ? 0 : 180);
    pendingUiTimers.add(timer);
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
  Core.watchSession?.(async (me) => {
    if (!state.me) return;
    if (me.user.platformRole === "PLATFORM_OWNER" || !me.tenants.some(t => t.id === state.tenantId)) return loadMe();
    const scope = captureContext();
    const context = await api.meContext(scope.tenantId);
    if (!isCurrentContext(scope)) return;
    validateTenantContext(context, scope);
    if (JSON.stringify(context) !== JSON.stringify(state.context)) await loadMe();
  });

  (async function boot() {
    try {
      // /me é a autoridade; sem access, o cliente tenta refresh HttpOnly uma vez.
      await loadMe();
    } catch (error) {
      clearProtected(); transition.invalid(error, false);
    }
  })();
})();
