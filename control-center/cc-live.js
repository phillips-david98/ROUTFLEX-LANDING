/* =============================================================================
   ROUTflex Control Center — console conectado ao Platform Core
   -----------------------------------------------------------------------------
   Camada exclusivamente visual: todo dado exibido vem dos endpoints aprovados
   (window.RoutflexCore). Nenhuma regra de negócio é decidida neste arquivo.
   Lacunas do contrato são exibidas como "indisponível" e registradas — nunca
   preenchidas com dados inventados.
   ============================================================================= */
(() => {
  "use strict";

  const Core = window.RoutflexCore;
  if (!Core) {
    document.getElementById("cc-login-error")?.removeAttribute("hidden");
    return;
  }
  const api = Core.api;
  const LABELS = Core.LABELS;

  /* ── Referências de DOM ────────────────────────────────────────────────── */
  const accessScreen = document.getElementById("access-screen");
  const controlCenter = document.getElementById("control-center");
  const appShell = document.querySelector(".app-shell");
  const viewRoot = document.getElementById("view-root");
  const currentAreaTitle = document.getElementById("current-area-title");
  const loginForm = document.getElementById("cc-login-form");
  const loginEmail = document.getElementById("cc-login-email");
  const loginPassword = document.getElementById("cc-login-password");
  const loginError = document.getElementById("cc-login-error");
  const loginSubmit = document.getElementById("cc-login-submit");
  const accessPill = document.getElementById("cc-access-pill");
  const topbarEnv = document.getElementById("cc-topbar-env");
  const sidebarEnv = document.getElementById("cc-sidebar-env");
  const modalLayer = document.getElementById("modal-layer");
  const modal = document.getElementById("modal");
  const modalKicker = document.getElementById("modal-kicker");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.getElementById("modal-footer");
  const toastRegion = document.getElementById("toast-region");
  const searchInput = document.getElementById("global-search");
  const searchResults = document.getElementById("global-search-results");
  const notificationPopover = document.getElementById("notification-popover");
  const ownerPopover = document.getElementById("owner-popover");

  const viewLabels = {
    overview: "Visão geral",
    companies: "Empresas",
    licenses: "Licenças e módulos",
    users: "Usuários globais",
    environments: "Ambientes",
    onboarding: "Onboarding",
    security: "Segurança e auditoria",
    settings: "Configurações",
  };

  /* ── Estado do console (cache de leitura, nunca fonte de verdade) ─────── */
  const state = {
    user: null,
    authenticationSessionId: null,
    activeView: "overview",
    catalog: null,
    tenants: [],
    tenantsLoading: false,
    tenantsError: null,
    tenantsLoaded: false,
    filters: { status: "all", search: "" },
    selectedTenantId: null,
    companyTab: "summary",
    detail: null,            // adminGetTenant
    detailEntitlements: null, // adminListEntitlements
    detailMemberships: null,
    detailInvitations: null,
    detailLoading: false,
    detailError: null,
    detailAudit: null,
    detailAuditLoading: false,
    licenseTenantId: null,
    licenseData: null,
    licenseLoading: false,
    licenseError: null,
    audit: [],
    auditLoading: false,
    auditError: null,
    auditTenantFilter: "all",
    auditDone: false,
    sidebarCollapsed: false,
  };

  let modalOpener = null;
  let toastTimer = 0;
  let unlockTimer = 0;
  let identityGeneration = 0;
  let contextGeneration = 0;
  let authenticationGeneration = 0;
  let modalGeneration = 0;
  let modalContext = null;
  const requestGenerations = new Map();
  const AUDIT_PAGE = 30;

  // These generations bind visual work to the identity and selection that began it.
  // They are not authority: every administrative operation still belongs to CORE.
  function captureContext(scoped = true) {
    return { identityGeneration, contextGeneration: scoped ? contextGeneration : null,
      userId: state.user?.id, authenticationSessionId: state.authenticationSessionId };
  }

  function contextIsCurrent(context) {
    return Boolean(context && state.user && context.userId === state.user.id
      && context.authenticationSessionId === state.authenticationSessionId
      && context.identityGeneration === identityGeneration
      && (context.contextGeneration === null || context.contextGeneration === contextGeneration));
  }

  function beginRequest(key, scoped = true) {
    const sequence = (requestGenerations.get(key) || 0) + 1;
    requestGenerations.set(key, sequence);
    return { ...captureContext(scoped), key, sequence };
  }

  function requestIsCurrent(request) {
    return contextIsCurrent(request) && requestGenerations.get(request.key) === request.sequence;
  }

  function clearSelectedData() {
    state.selectedTenantId = null;
    state.companyTab = "summary";
    state.detail = state.detailEntitlements = state.detailMemberships = state.detailInvitations = null;
    state.detailAudit = state.detailError = null;
    state.detailLoading = state.detailAuditLoading = false;
    state.licenseTenantId = state.licenseData = state.licenseError = null;
    state.licenseLoading = false;
    state.audit = [];
    state.auditLoading = state.auditDone = false;
    state.auditError = null;
    state.auditTenantFilter = "all";
  }

  function changeContext() {
    document.dispatchEvent(new CustomEvent('routflex:protected-context-cleared'));
    contextGeneration += 1;
    closeModal({ restoreFocus: false });
    clearSelectedData();
    closePopovers();
    searchResults.innerHTML = "";
    searchResults.hidden = true;
    searchInput.value = "";
    searchInput.setAttribute("aria-expanded", "false");
    window.clearTimeout(toastTimer);
    toastRegion.innerHTML = "";
  }

  function clearIdentity() {
    identityGeneration += 1;
    window.clearTimeout(unlockTimer);
    state.user = null;
    state.authenticationSessionId = null;
    changeContext();
    requestGenerations.clear();
    state.catalog = null;
    state.tenants = [];
    state.tenantsLoading = state.tenantsLoaded = false;
    state.tenantsError = null;
    state.filters = { status: "all", search: "" };
    state.activeView = "overview";
    viewRoot.innerHTML = "";
    currentAreaTitle.textContent = "";
    notificationPopover.innerHTML = "";
    ["cc-owner-avatar-side", "cc-owner-avatar-top", "cc-owner-name-side", "cc-owner-role-side",
      "cc-owner-first-name", "cc-owner-name-pop", "cc-owner-role-pop"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = "";
    });
    document.body.classList.remove("is-drawer-open");
    const overlay = document.querySelector(".drawer-overlay");
    if (overlay) overlay.hidden = true;
    if (loginEmail) loginEmail.value = "";
    if (loginPassword) loginPassword.value = "";
  }

  function beginAction(button, tenantId = null) {
    if (!modalContext || modalLayer.hidden || !contextIsCurrent(modalContext)
      || modalContext.generation !== modalGeneration || !button?.isConnected
      || !modal.contains(button) || (tenantId !== null && tenantId !== modalContext.tenantId)) return null;
    return { ...modalContext };
  }

  function actionIsCurrent(action) {
    return contextIsCurrent(action) && action.generation === modalGeneration && !modalLayer.hidden;
  }

  /* ── Utilitários visuais (idênticos à identidade premium existente) ────── */
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slug(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function formatDate(value, includeTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(String(value));
    return new Intl.DateTimeFormat("pt-BR", includeTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", year: "numeric" }
    ).format(date).replace(" de ", " ");
  }

  function statusBadge(label) {
    return `<span class="status-badge status-badge--${slug(label)}"><i></i>${escapeHtml(label)}</span>`;
  }

  const tenantBadge = (status) => statusBadge(LABELS.tenantStatus[status] || status);
  const entBadge = (stateKey) => statusBadge(LABELS.entitlementState[stateKey] || stateKey);
  const inviteBadge = (status) => statusBadge(LABELS.invitationStatus[status] || status);

  function moduleName(moduleKey) {
    const found = state.catalog?.modules?.find((m) => m.key === moduleKey);
    return found ? found.name : (Core.MODULE_META[moduleKey]?.fallbackName || moduleKey);
  }

  function modulePill(moduleKey, active = true) {
    const tone = active ? slug(moduleKey) : "inactive";
    return `<span class="module-pill module-pill--${tone}">${escapeHtml(moduleName(moduleKey))}</span>`;
  }

  function pageHeader(kicker, title, description, actions = "") {
    return `
      <header class="page-header">
        <div>
          <span class="page-kicker">${escapeHtml(kicker)}</span>
          <h1 tabindex="-1">${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
        </div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ""}
      </header>
    `;
  }

  function emptyState(title, description) {
    return `
      <div class="empty-state">
        <span aria-hidden="true">⌕</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(description)}</p>
      </div>
    `;
  }

  /* Painel de lacuna de contrato: estado indisponível registrado, sem invenção */
  function gapPanel(title, description, extra = "") {
    return `
      <section class="panel">
        <header class="panel__header"><div><span>Indisponível no contrato atual</span><h2>${escapeHtml(title)}</h2></div></header>
        <div class="empty-state">
          <span aria-hidden="true">⛔</span>
          <strong>Sem endpoint aprovado para esta visão</strong>
          <p>${escapeHtml(description)}</p>
        </div>
        ${extra}
        <p class="panel-note">Lacuna registrada: esta área só será habilitada quando o Platform Core expor o contrato correspondente. Nenhum dado é simulado no console conectado.</p>
      </section>
    `;
  }

  function errorPanel(error, retryAction) {
    return `
      <section class="panel">
        <div class="empty-state">
          <span aria-hidden="true">!</span>
          <strong>Não foi possível carregar os dados</strong>
          <p>${escapeHtml(Core.friendlyError(error))}</p>
        </div>
        <div class="table-actions" style="justify-content:center;">
          <button class="button button--secondary" type="button" data-action="${escapeHtml(retryAction)}">Tentar novamente</button>
        </div>
      </section>
    `;
  }

  function skeletonPanel(lines = 4) {
    return `
      <section class="panel" aria-busy="true">
        <div class="cc-skeleton">${"<span></span>".repeat(lines)}</div>
      </section>
    `;
  }

  /* ── Modal / toast (mesma mecânica e classes do Control Center) ────────── */
  function openModal({ kicker = "Ação administrativa", title, body, footer = "", size = "medium", tenantId = null }) {
    if (!state.user) return;
    modalGeneration += 1;
    modalContext = { ...captureContext(), generation: modalGeneration, tenantId };
    const opened = modalContext;
    if (modalLayer.hidden) modalOpener = document.activeElement;
    modalKicker.textContent = kicker;
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalFooter.innerHTML = footer;
    modal.dataset.size = size;
    modalLayer.hidden = false;
    document.body.classList.add("has-modal");
    controlCenter.inert = true;
    requestAnimationFrame(() => {
      if (!actionIsCurrent(opened)) return;
      const first = modal.querySelector("[autofocus]")
        || modal.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])");
      (first || modal).focus();
    });
  }

  function closeModal({ restoreFocus = true } = {}) {
    modalGeneration += 1;
    modalContext = null;
    modalLayer.hidden = true;
    document.body.classList.remove("has-modal");
    controlCenter.inert = false;
    modalBody.innerHTML = "";
    modalFooter.innerHTML = "";
    modalKicker.textContent = "";
    modalTitle.textContent = "";
    if (restoreFocus && modalOpener?.isConnected) modalOpener.focus();
    modalOpener = null;
  }

  function showToast(title, tone = "success", description = "Ação registrada no Platform Core.") {
    window.clearTimeout(toastTimer);
    toastRegion.innerHTML = `
      <div class="toast toast--${tone}">
        <span class="toast__icon" aria-hidden="true">${tone === "success" ? "✓" : "!"}</span>
        <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>
        <button type="button" data-action="dismiss-toast" aria-label="Fechar notificação">×</button>
      </div>
    `;
    toastTimer = window.setTimeout(() => { toastRegion.innerHTML = ""; }, 5600);
  }

  function setBusy(button, busy, busyLabel = "Processando…") {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = busyLabel;
      button.disabled = true;
    } else {
      if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
      button.disabled = false;
    }
  }

  function setConnectionState(online, label) {
    const text = label || (online ? "Core conectado" : "Sem conexão com o Core");
    if (topbarEnv) {
      topbarEnv.classList.toggle("is-online", online);
      topbarEnv.classList.toggle("is-offline", !online);
      topbarEnv.querySelector("span").textContent = text;
    }
    if (sidebarEnv) sidebarEnv.innerHTML = `<i></i> ${escapeHtml(online ? "Conectado" : "Offline")}`;
  }

  /* ── Carregadores (somente endpoints aprovados) ────────────────────────── */
  async function loadCatalog() {
    if (!state.user) return;
    const request = beginRequest("catalog", false);
    const catalog = await api.catalog();
    if (requestIsCurrent(request)) state.catalog = catalog;
  }

  async function loadTenants() {
    if (!state.user) return;
    const request = beginRequest("tenants", false);
    state.tenantsLoading = true;
    state.tenantsError = null;
    renderView();
    try {
      const query = {};
      if (state.filters.status !== "all") query.status = state.filters.status;
      if (state.filters.search.trim()) query.search = state.filters.search.trim();
      query.limit = 200;
      const tenants = await api.adminListTenants(query);
      if (!requestIsCurrent(request)) return;
      state.tenants = tenants;
      state.tenantsLoaded = true;
      setConnectionState(true);
    } catch (error) {
      if (!requestIsCurrent(request)) return;
      state.tenantsError = error;
      if (error.code === "NETWORK_UNREACHABLE") setConnectionState(false);
    } finally {
      if (!requestIsCurrent(request)) return;
      state.tenantsLoading = false;
      renderView();
    }
  }

  async function loadTenantDetail(tenantId) {
    if (!state.user || state.selectedTenantId !== tenantId) return;
    const request = beginRequest("detail");
    state.detailLoading = true;
    state.detailError = null;
    state.detail = null;
    state.detailEntitlements = null;
    state.detailMemberships = state.detailInvitations = null;
    state.detailAudit = null;
    state.detailAuditLoading = false;
    requestGenerations.set("detailAudit", (requestGenerations.get("detailAudit") || 0) + 1);
    renderView();
    try {
      const [detail, entitlements, memberships, invitations] = await Promise.all([
        api.adminGetTenant(tenantId),
        api.adminListEntitlements(tenantId),
        api.adminTenantMemberships(tenantId),
        api.adminTenantInvitations(tenantId),
      ]);
      if (!requestIsCurrent(request)) return;
      state.detail = detail;
      state.detailEntitlements = entitlements;
      state.detailMemberships = memberships;
      state.detailInvitations = invitations;
    } catch (error) {
      if (!requestIsCurrent(request)) return;
      state.detailError = error;
    } finally {
      if (!requestIsCurrent(request)) return;
      state.detailLoading = false;
      renderView();
    }
  }

  async function loadDetailAudit(tenantId) {
    if (!state.user || state.selectedTenantId !== tenantId) return;
    const request = beginRequest("detailAudit");
    state.detailAuditLoading = true;
    renderView();
    try {
      const audit = await api.adminListAudit({ tenantId, limit: 15 });
      if (!requestIsCurrent(request)) return;
      state.detailAudit = audit;
    } catch (error) {
      if (!requestIsCurrent(request)) return;
      state.detailAudit = { error };
    } finally {
      if (!requestIsCurrent(request)) return;
      state.detailAuditLoading = false;
      renderView();
    }
  }

  async function loadLicenses(tenantId) {
    if (!state.user) return;
    changeContext();
    const request = beginRequest("licenses");
    state.licenseTenantId = tenantId;
    state.licenseLoading = true;
    state.licenseError = null;
    state.licenseData = null;
    renderView();
    try {
      const entitlements = await api.adminListEntitlements(tenantId);
      if (!requestIsCurrent(request)) return;
      state.licenseData = entitlements;
    } catch (error) {
      if (!requestIsCurrent(request)) return;
      state.licenseError = error;
    } finally {
      if (!requestIsCurrent(request)) return;
      state.licenseLoading = false;
      renderView();
    }
  }

  async function loadAudit({ reset = true } = {}) {
    if (!state.user || (!reset && state.auditLoading)) return;
    const request = beginRequest("audit");
    state.auditLoading = true;
    state.auditError = null;
    if (reset) { state.audit = []; state.auditDone = false; }
    renderView();
    try {
      const query = { limit: AUDIT_PAGE };
      if (state.auditTenantFilter !== "all") query.tenantId = state.auditTenantFilter;
      if (!reset && state.audit.length) query.cursor = state.audit[state.audit.length - 1].id;
      const page = await api.adminListAudit(query);
      if (!requestIsCurrent(request)) return;
      state.audit = reset ? page : state.audit.concat(page);
      if (page.length < AUDIT_PAGE) state.auditDone = true;
    } catch (error) {
      if (!requestIsCurrent(request)) return;
      state.auditError = error;
    } finally {
      if (!requestIsCurrent(request)) return;
      state.auditLoading = false;
      renderView();
    }
  }

  /* ── Views ─────────────────────────────────────────────────────────────── */
  function tenantCountsByStatus() {
    const counts = { PROVISIONING: 0, TRIAL: 0, ACTIVE: 0, SUSPENDED: 0, CANCELLED: 0 };
    state.tenants.forEach((tenant) => { if (counts[tenant.status] !== undefined) counts[tenant.status] += 1; });
    return counts;
  }

  function renderOverview() {
    if (state.tenantsLoading && !state.tenantsLoaded) {
      return pageHeader("Comando executivo", "Visão geral", "Consolidando dados do Platform Core…") + skeletonPanel(5) + skeletonPanel(4);
    }
    if (state.tenantsError && !state.tenantsLoaded) {
      return pageHeader("Comando executivo", "Visão geral", "Leitura consolidada do ecossistema.") + errorPanel(state.tenantsError, "retry-tenants");
    }
    const counts = tenantCountsByStatus();
    const total = state.tenants.length;
    const recent = [...state.tenants]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    const auditPreview = state.audit.slice(0, 8);

    return `
      ${pageHeader(
        "Comando executivo",
        "Visão geral",
        "Leitura consolidada do ecossistema a partir do Platform Core — dados reais, sem simulação.",
        `<button class="button button--primary" type="button" data-action="open-create-tenant">Nova empresa</button>`
      )}

      <section class="metric-grid" aria-label="Indicadores principais">
        ${[
          ["Empresas registradas", total, "Portfólio completo no Core", "neutral"],
          ["Ativas", counts.ACTIVE, "Operação plena", "positive"],
          ["Em trial", counts.TRIAL, "Períodos de avaliação", "violet"],
          ["Provisionando", counts.PROVISIONING, "Setup em andamento", "info"],
          ["Suspensas", counts.SUSPENDED, "Acesso bloqueado pelo Core", counts.SUSPENDED ? "warning" : "positive"],
          ["Canceladas", counts.CANCELLED, "Encerramentos registrados", "neutral"],
        ].map(([label, value, note, tone]) => `
          <article class="metric-card metric-card--${tone}">
            <span>${escapeHtml(label)}</span>
            <strong>${value}</strong>
            <small>${escapeHtml(note)}</small>
          </article>
        `).join("")}
      </section>

      <div class="panel-grid">
        <section class="panel">
          <header class="panel__header"><div><span>Portfólio</span><h2>Empresas recentes</h2></div><button class="text-button" type="button" data-view="companies">Ver empresas</button></header>
          ${recent.length ? `
            <table class="data-table">
              <thead><tr><th scope="col">Empresa</th><th scope="col">Status</th><th scope="col">Criada em</th><th scope="col"></th></tr></thead>
              <tbody>
                ${recent.map((tenant) => `
                  <tr>
                    <td><strong>${escapeHtml(tenant.displayName)}</strong><br><small>${escapeHtml(tenant.slug)}</small></td>
                    <td>${tenantBadge(tenant.status)}</td>
                    <td>${formatDate(tenant.createdAt)}</td>
                    <td><button class="button button--table" type="button" data-action="open-company" data-tenant-id="${tenant.id}">Detalhes</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : emptyState("Nenhuma empresa registrada", "Crie o primeiro tenant para iniciar a operação da plataforma.")}
          ${counts.SUSPENDED ? `<div class="panel-note panel-note--risk">${counts.SUSPENDED} empresa(s) suspensa(s) — acessos bloqueados pelo Core até reativação.</div>` : ""}
        </section>

        <section class="panel">
          <header class="panel__header"><div><span>Atividade</span><h2>Movimentações administrativas</h2></div><button class="text-button" type="button" data-view="security">Abrir auditoria</button></header>
          ${state.auditLoading && !auditPreview.length ? `<div class="cc-skeleton"><span></span><span></span><span></span></div>` : ""}
          ${auditPreview.length ? `
            <ul class="activity-list">
              ${auditPreview.map((event) => `
                <li>
                  <strong>${escapeHtml(event.action)}</strong>
                  <span>${escapeHtml(event.category)} · ${escapeHtml(event.actorType)} · ${statusResultLabel(event.result)}</span>
                  <small>${formatDate(event.occurredAt, true)}</small>
                </li>
              `).join("")}
            </ul>
          ` : (!state.auditLoading ? emptyState("Sem eventos carregados", "A trilha de auditoria aparece aqui assim que houver movimentações.") : "")}
        </section>
      </div>
    `;
  }

  function statusResultLabel(result) {
    const map = { SUCCESS: "Concluído", DENIED: "Negado", FAILURE: "Falha" };
    return escapeHtml(map[result] || result);
  }

  function renderCompanies() {
    const statusOptions = ["all", "PROVISIONING", "TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"].map((value) => {
      const label = value === "all" ? "Todos os status" : (LABELS.tenantStatus[value] || value);
      return `<option value="${value}"${state.filters.status === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");

    let results;
    if (state.tenantsLoading) {
      results = `<div class="cc-skeleton"><span></span><span></span><span></span><span></span></div>`;
    } else if (state.tenantsError) {
      results = errorPanelInline(state.tenantsError, "retry-tenants");
    } else if (!state.tenants.length) {
      results = emptyState("Nenhuma empresa encontrada", "Ajuste os filtros ou crie um novo tenant.");
    } else {
      results = `
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Empresa</th><th scope="col">Status</th><th scope="col">País / Moeda</th>
              <th scope="col">Fuso padrão</th><th scope="col">Criada em</th><th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            ${state.tenants.map((tenant) => `
              <tr>
                <td><strong>${escapeHtml(tenant.displayName)}</strong><br><small>${escapeHtml(tenant.slug)}</small></td>
                <td>${tenantBadge(tenant.status)}</td>
                <td>${escapeHtml(tenant.primaryCountry)} · ${escapeHtml(tenant.defaultCurrency)}</td>
                <td>${escapeHtml(tenant.defaultTimezone)}</td>
                <td>${formatDate(tenant.createdAt)}</td>
                <td><button class="button button--table" type="button" data-action="open-company" data-tenant-id="${tenant.id}">Ver detalhes</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    return `
      ${pageHeader(
        "Portfólio",
        "Empresas",
        "Tenants registrados no Platform Core, com filtros resolvidos pelo servidor.",
        `<button class="button button--primary" type="button" data-action="open-create-tenant">Nova empresa</button>`
      )}
      <section class="panel toolbar" aria-label="Filtros de empresas">
        <form class="filter-grid filter-grid--companies" data-form="company-filters">
          <label>Status
            <select name="status">${statusOptions}</select>
          </label>
          <label>Busca
            <input type="search" name="search" placeholder="Nome ou slug" value="${escapeHtml(state.filters.search)}">
          </label>
          <div class="filter-actions">
            <button class="button button--secondary" type="submit">Aplicar filtros</button>
            <button class="button button--table" type="button" data-action="clear-company-filters">Limpar</button>
          </div>
        </form>
      </section>
      <section class="panel table-panel" aria-label="Lista de empresas">${results}</section>
    `;
  }

  function errorPanelInline(error, retryAction) {
    return `
      <div class="empty-state">
        <span aria-hidden="true">!</span>
        <strong>Não foi possível carregar</strong>
        <p>${escapeHtml(Core.friendlyError(error))}</p>
        <button class="button button--secondary" type="button" data-action="${escapeHtml(retryAction)}">Tentar novamente</button>
      </div>
    `;
  }

  function renderCompanyDetail() {
    if (state.detailLoading) {
      return pageHeader("Empresa", "Carregando…", "Consultando o Platform Core.") + skeletonPanel(6);
    }
    if (state.detailError || !state.detail) {
      return pageHeader("Empresa", "Detalhe indisponível", "O Core não retornou os dados desta empresa.")
        + errorPanel(state.detailError || {}, "retry-company-detail")
        + `<div class="table-actions"><button class="button button--secondary" type="button" data-action="back-to-companies">Voltar para empresas</button></div>`;
    }

    const tenant = state.detail;
    const isSuspended = tenant.status === "SUSPENDED";
    const isCancelled = tenant.status === "CANCELLED";
    const monogram = tenant.displayName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

    const tabs = [
      ["summary", "Resumo"],
      ["modules", "Módulos e licenças"],
      ["invites", "Convites"],
      ["access", "Acessos"],
      ["audit", "Auditoria"],
    ].map(([key, label]) => `<button type="button" data-company-tab="${key}"${state.companyTab === key ? ' aria-current="page"' : ""}>${label}</button>`).join("");

    return `
      <button class="back-button" type="button" data-action="back-to-companies"><span aria-hidden="true">←</span> Voltar para empresas</button>
      <header class="detail-header">
        <div class="detail-header__identity">
          <span class="company-monogram" aria-hidden="true">${escapeHtml(monogram)}</span>
          <div><span class="page-kicker">${escapeHtml(tenant.slug)}</span><h1 tabindex="-1">${escapeHtml(tenant.displayName)}</h1><div>${tenantBadge(tenant.status)}</div></div>
        </div>
        <div class="detail-header__actions">
          <button class="button button--secondary" type="button" data-action="edit-tenant" data-tenant-id="${tenant.id}">Editar empresa</button>
          <button class="button button--secondary" type="button" data-action="open-owner" data-tenant-id="${tenant.id}">Designar OWNER</button>
          ${tenant.status === "PROVISIONING" || tenant.status === "TRIAL" ? `<button class="button button--positive" type="button" data-action="activate-tenant" data-tenant-id="${tenant.id}">Ativar empresa</button>` : ""}
          ${isSuspended
            ? `<button class="button button--positive" type="button" data-action="reactivate-tenant" data-tenant-id="${tenant.id}">Reativar empresa</button>`
            : (!isCancelled ? `<button class="button button--danger-ghost" type="button" data-action="suspend-tenant" data-tenant-id="${tenant.id}">Suspender empresa</button>` : "")}
        </div>
        <dl class="detail-meta">
          <div><dt>Criada em</dt><dd>${formatDate(tenant.createdAt)}</dd></div>
          <div><dt>Usuários</dt><dd>${tenant._count?.memberships ?? "—"}</dd></div>
          <div><dt>Unidades</dt><dd>${tenant._count?.units ?? "—"}</dd></div>
          <div><dt>Fuso</dt><dd>${escapeHtml(tenant.defaultTimezone)}</dd></div>
        </dl>
        ${tenant.suspendedAt ? `<p class="cc-inline-note">Suspensa em ${formatDate(tenant.suspendedAt, true)}${tenant.suspendedReason ? ` — “${escapeHtml(tenant.suspendedReason)}”` : ""}</p>` : ""}
        ${tenant.cancelledAt ? `<p class="cc-inline-note">Cancelada em ${formatDate(tenant.cancelledAt, true)}</p>` : ""}
      </header>
      <nav class="detail-tabs" aria-label="Seções da empresa">${tabs}</nav>
      <div class="detail-content">${renderCompanyTab(tenant)}</div>
    `;
  }

  function renderCompanyTab(tenant) {
    switch (state.companyTab) {
      case "modules": return renderCompanyModules(tenant);
      case "invites": return renderCompanyInvites(tenant);
      case "access": return renderCompanyAccess(tenant);
      case "audit": return renderCompanyAudit(tenant);
      default: return renderCompanySummary(tenant);
    }
  }

  function renderCompanySummary(tenant) {
    const fact = (label, value) => `<div><span>${escapeHtml(label)}</span><strong>${value || "—"}</strong></div>`;
    const entPills = (tenant.entitlements || []).map((ent) => modulePill(ent.moduleKey, ent.state === "ACTIVE" || ent.state === "TRIAL")).join(" ")
      || `<span class="cc-inline-note">Nenhum módulo concedido até o momento.</span>`;
    return `
      <div class="panel-grid">
        <section class="panel">
          <header class="panel__header"><div><span>Dados corporativos</span><h2>Identificação</h2></div></header>
          <div class="info-grid">
            ${fact("Razão social", escapeHtml(tenant.legalName || ""))}
            ${fact("Documento", tenant.taxIdValue ? `${escapeHtml(tenant.taxIdType || "")} ${escapeHtml(tenant.taxIdValue)}` : "")}
            ${fact("País", escapeHtml(tenant.primaryCountry))}
            ${fact("Locale padrão", escapeHtml(tenant.defaultLocale))}
            ${fact("Fuso horário", escapeHtml(tenant.defaultTimezone))}
            ${fact("Moeda", escapeHtml(tenant.defaultCurrency))}
            ${fact("Criada em", formatDate(tenant.createdAt, true))}
            ${fact("Atualizada em", formatDate(tenant.updatedAt, true))}
          </div>
        </section>
        <section class="panel">
          <header class="panel__header"><div><span>Dimensões</span><h2>Estrutura registrada</h2></div></header>
          <div class="metric-grid metric-grid--compact">
            <article class="metric-card metric-card--info"><span>Usuários vinculados</span><strong>${tenant._count?.memberships ?? "—"}</strong><small>Memberships no Core</small></article>
            <article class="metric-card metric-card--neutral"><span>Unidades</span><strong>${tenant._count?.units ?? "—"}</strong><small>Estrutura organizacional</small></article>
          </div>
          <header class="panel__header" style="margin-top:14px;"><div><span>Entitlements</span><h2>Módulos concedidos</h2></div><button class="text-button" type="button" data-company-tab="modules">Configurar</button></header>
          <p>${entPills}</p>
        </section>
      </div>
    `;
  }

  function renderCompanyModules(tenant) {
    const entitlements = state.detailEntitlements || [];
    const byKey = new Map(entitlements.map((ent) => [ent.moduleKey, ent]));
    const allModules = (state.catalog?.modules || []).map((m) => m.key);
    const rows = allModules.map((moduleKey) => {
      const ent = byKey.get(moduleKey);
      const stateKey = ent ? ent.state : "NOT_CONTRACTED";
      const quotas = ent?.seatQuotas?.length
        ? ent.seatQuotas.map((quota) => `<small>${escapeHtml(LABELS.seatType[quota.seatTypeKey] || quota.seatTypeKey)}: ${quota.quantityContracted}${quota.quantityOverageAllowed ? ` (+${quota.quantityOverageAllowed})` : ""}</small>`).join("<br>")
        : "<small>—</small>";
      const canSuspend = ent && (stateKey === "ACTIVE" || stateKey === "TRIAL");
      const canCancel = ent && stateKey !== "CANCELLED" && stateKey !== "NOT_CONTRACTED";
      return `
        <tr>
          <td>${modulePill(moduleKey, stateKey === "ACTIVE" || stateKey === "TRIAL")}</td>
          <td>${entBadge(stateKey)}</td>
          <td>${ent ? formatDate(ent.activatedAt) : "—"}</td>
          <td>${ent?.trialEndsAt ? formatDate(ent.trialEndsAt) : "—"}</td>
          <td>${ent?.expiresAt ? formatDate(ent.expiresAt) : "—"}</td>
          <td>${quotas}</td>
          <td>
            <div class="table-actions">
              <button class="button button--table" type="button" data-action="open-entitlement" data-tenant-id="${tenant.id}" data-module-key="${moduleKey}">${ent ? "Configurar" : "Conceder"}</button>
              ${canSuspend ? `<button class="button button--table" type="button" data-action="suspend-entitlement" data-tenant-id="${tenant.id}" data-module-key="${moduleKey}">Suspender</button>` : ""}
              ${canCancel ? `<button class="button button--danger-ghost button--table" type="button" data-action="cancel-entitlement" data-tenant-id="${tenant.id}" data-module-key="${moduleKey}">Cancelar</button>` : ""}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <section class="panel table-panel">
        <header class="panel__header"><div><span>Entitlements</span><h2>Módulos, estados e licenças contratadas</h2></div></header>
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Módulo</th><th scope="col">Estado</th><th scope="col">Ativado</th>
              <th scope="col">Fim do trial</th><th scope="col">Expira</th><th scope="col">Licenças contratadas</th><th scope="col"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="panel-note">Ocupação de licenças (assentos em uso) é exposta pelo contrato apenas dentro do tenant (/tenants/:id/seats) e exige membership — indisponível para o papel de plataforma. Valores acima refletem o contratado.</p>
      </section>
    `;
  }

  function renderCompanyInvites(tenant) {
    const invites = state.detailInvitations || [];
    return `
      <section class="panel">
        <header class="panel__header">
          <div><span>Acesso inicial</span><h2>Convites da empresa</h2></div>
          <button class="button button--primary" type="button" data-action="open-invite" data-tenant-id="${tenant.id}">Novo convite</button>
        </header>
        ${invites.length ? `
          <table class="data-table">
            <thead><tr><th scope="col">E-mail</th><th scope="col">Status</th><th scope="col">Expira</th><th scope="col">Emitido</th><th scope="col">Ação</th></tr></thead>
            <tbody>
              ${invites.map((inv) => `
                <tr>
                  <td>${escapeHtml(inv.email)}</td>
                  <td>${inviteBadge(inv.status)}</td>
                  <td>${formatDate(inv.expiresAt, true)}</td>
                  <td>${formatDate(inv.createdAt, true)}</td>
                  <td>${inv.status === "PENDING" || (inv.status === "EXPIRED" && inv.hasReservedSeats) ? `<button class="button button--danger-ghost button--table" data-action="revoke-invitation" data-tenant-id="${tenant.id}" data-invitation-id="${escapeHtml(inv.id)}">${inv.status === "EXPIRED" ? "Liberar reserva" : "Revogar"}</button>` : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : emptyState("Nenhum convite registrado", "Designe o OWNER para iniciar o onboarding da empresa.")}
        <p class="panel-note">Estados consultados no CORE. O link de aceite aparece somente na emissão e deve ser entregue por canal seguro. Para corrigir o destinatário ou substituir um link perdido, revogue o convite pendente e emita outro.</p>
      </section>
    `;
  }

  function renderCompanyAccess(tenant) {
    const members = state.detailMemberships || [];
    return `<section class="panel table-panel"><header class="panel__header"><div><span>Administração</span><h2>Usuários e OWNER</h2></div><button class="button button--secondary" data-action="open-owner" data-tenant-id="${tenant.id}">Designar OWNER</button></header>
      ${members.length ? `<table class="data-table"><thead><tr><th>Usuário</th><th>Estado</th><th>Papéis</th><th>Licenças</th></tr></thead><tbody>${members.map((member) => `<tr><td><strong>${escapeHtml(member.user.fullName)}</strong> ${member.isTenantOwner ? statusBadge("OWNER") : ""}<br><small>${escapeHtml(member.user.email)}</small></td><td>${escapeHtml(LABELS.membershipStatus[member.status] || member.status)}</td><td>${escapeHtml(member.roles.map((role) => role.name).join(", ") || "—")}</td><td>${escapeHtml(member.seats.filter((seat) => seat.state === "ACTIVE").map((seat) => seat.moduleKey).join(", ") || "—")}${member.status === "ACTIVE" ? `<br><button class="button button--table" type="button" data-recovery-platform="true" data-recovery-tenant="${escapeHtml(tenant.id)}" data-recovery-member="${escapeHtml(member.membershipId)}">Recuperar acesso</button>` : ""}</td></tr>`).join("")}</tbody></table>` : emptyState("Nenhum membro", "Designe o OWNER para emitir o convite inicial.")}
      <p class="panel-note">Um OWNER por empresa nesta versão. A gestão dos demais membros é realizada no Workspace; transferências de OWNER não estão disponíveis.</p></section>`;
  }

  function renderCompanyAudit(tenant) {
    if (state.detailAudit === null && !state.detailAuditLoading) {
      loadDetailAudit(tenant.id);
      return skeletonPanel(5);
    }
    if (state.detailAuditLoading) return skeletonPanel(5);
    if (state.detailAudit?.error) return errorPanel(state.detailAudit.error, "retry-company-audit");
    const rows = state.detailAudit || [];
    return `
      <section class="panel table-panel">
        <header class="panel__header"><div><span>Trilha imutável</span><h2>Eventos administrativos da empresa</h2></div><button class="text-button" type="button" data-action="retry-company-audit">Atualizar</button></header>
        ${rows.length ? auditTable(rows) : emptyState("Sem eventos", "Nenhuma movimentação registrada para esta empresa.")}
      </section>
    `;
  }

  function auditTable(rows) {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Quando</th><th scope="col">Ação</th><th scope="col">Categoria</th>
            <th scope="col">Ator</th><th scope="col">Resultado</th><th scope="col">Severidade</th><th scope="col">Request</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((event) => `
            <tr>
              <td>${formatDate(event.occurredAt, true)}</td>
              <td><strong>${escapeHtml(event.action)}</strong>${event.targetType ? `<br><small>${escapeHtml(event.targetType)}</small>` : ""}</td>
              <td>${escapeHtml(event.category)}</td>
              <td>${escapeHtml(event.actorType)}</td>
              <td>${statusBadge(event.result === "SUCCESS" ? "Concluído" : event.result === "DENIED" ? "Negado" : "Falha")}</td>
              <td>${escapeHtml(event.severity)}</td>
              <td><small>${escapeHtml(event.requestId || "—")}</small></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderLicenses() {
    const tenantOptions = state.tenants.map((tenant) => (
      `<option value="${tenant.id}"${tenant.id === state.licenseTenantId ? " selected" : ""}>${escapeHtml(tenant.displayName)}</option>`
    )).join("");

    let content;
    if (!state.tenants.length) {
      content = emptyState("Nenhuma empresa registrada", "Crie um tenant para configurar licenças.");
    } else if (state.licenseLoading) {
      content = `<div class="cc-skeleton"><span></span><span></span><span></span></div>`;
    } else if (state.licenseError) {
      content = errorPanelInline(state.licenseError, "retry-licenses");
    } else if (!state.licenseTenantId) {
      content = emptyState("Selecione uma empresa", "Escolha a empresa para visualizar o quadro de módulos e licenças.");
    } else {
      const rows = (state.licenseData || []).map((ent) => `
        <tr>
          <td>${modulePill(ent.moduleKey, ent.state === "ACTIVE" || ent.state === "TRIAL")}</td>
          <td>${entBadge(ent.state)}</td>
          <td>${ent.trialEndsAt ? formatDate(ent.trialEndsAt) : "—"}</td>
          <td>${ent.expiresAt ? formatDate(ent.expiresAt) : "—"}</td>
          <td>${ent.seatQuotas?.length
            ? ent.seatQuotas.map((quota) => `<small>${escapeHtml(LABELS.seatType[quota.seatTypeKey] || quota.seatTypeKey)}: <strong>${quota.quantityContracted}</strong>${quota.quantityOverageAllowed ? ` +${quota.quantityOverageAllowed} tolerância` : ""}</small>`).join("<br>")
            : "<small>—</small>"}</td>
          <td><button class="button button--table" type="button" data-action="open-entitlement" data-tenant-id="${state.licenseTenantId}" data-module-key="${ent.moduleKey}">Configurar</button></td>
        </tr>
      `).join("");
      content = rows
        ? `<table class="data-table"><thead><tr><th scope="col">Módulo</th><th scope="col">Estado</th><th scope="col">Fim do trial</th><th scope="col">Expira</th><th scope="col">Licenças contratadas</th><th scope="col"></th></tr></thead><tbody>${rows}</tbody></table>`
        : emptyState("Nenhum módulo concedido", "Esta empresa ainda não possui entitlements registrados.");
    }

    return `
      ${pageHeader("Entitlements", "Licenças e módulos", "Quadro contratado por empresa, direto do Platform Core.")}
      <section class="panel toolbar">
        <form class="filter-grid filter-grid--compact" data-form="license-tenant">
          <label>Empresa
            <select name="tenantId">
              <option value="">Selecionar…</option>
              ${tenantOptions}
            </select>
          </label>
          <div class="filter-actions"><button class="button button--secondary" type="submit">Carregar quadro</button></div>
        </form>
      </section>
      <section class="panel table-panel">${content}</section>
      <p class="panel-note">Consumo em tempo real (assentos ocupados) pertence ao escopo do tenant e é gerido pelo Tenant Admin no Workspace — o contrato não o expõe à plataforma.</p>
    `;
  }

  function renderUsers() {
    return `
      ${pageHeader("Identidades", "Usuários globais", "Governança de identidades da plataforma.")}
      ${gapPanel(
        "Diretório global de usuários",
        "O contrato atual do Platform Core não expõe listagem global de usuários (não há GET /admin/users). Usuários são visíveis por empresa, via contagem oficial em GET /admin/tenants/:id, e geridos pelo Tenant Admin no Workspace.",
        `<div class="table-actions" style="margin-top:14px;"><button class="button button--secondary" type="button" data-view="companies">Abrir empresas</button></div>`
      )}
    `;
  }

  function renderEnvironments() {
    return `
      ${pageHeader("Infraestrutura", "Ambientes", "Saúde e topologia dos ambientes por empresa.")}
      ${gapPanel(
        "Monitoramento de ambientes",
        "O Platform Core aprovado não possui endpoints de infraestrutura/ambientes. Esta visão permanece indisponível até que o contrato exponha esse domínio."
      )}
    `;
  }

  function renderOnboarding() {
    return `
      ${pageHeader("Implantação", "Onboarding", "Configure a empresa e entregue o primeiro acesso ao responsável.")}
      <section class="panel"><ol><li>Crie a empresa e revise os dados administrativos.</li><li>Configure módulos contratados e quotas em “Módulos e licenças”.</li><li>Use “Designar OWNER” e entregue o link de aceite por canal seguro.</li><li>Confira o aceite em “Convites” e o responsável em “Acessos”.</li><li>Ative a empresa. O OWNER administra membros, papéis e licenças no Workspace.</li></ol><div class="table-actions"><button class="button button--primary" data-action="open-create-tenant">Nova empresa</button><button class="button button--secondary" data-view="companies">Continuar em uma empresa</button></div></section>
    `;
  }

  function renderSecurity() {
    const tenantOptions = [`<option value="all"${state.auditTenantFilter === "all" ? " selected" : ""}>Toda a plataforma</option>`]
      .concat(state.tenants.map((tenant) => `<option value="${tenant.id}"${tenant.id === state.auditTenantFilter ? " selected" : ""}>${escapeHtml(tenant.displayName)}</option>`))
      .join("");

    let content;
    if (state.auditLoading && !state.audit.length) {
      content = `<div class="cc-skeleton"><span></span><span></span><span></span><span></span></div>`;
    } else if (state.auditError && !state.audit.length) {
      content = errorPanelInline(state.auditError, "retry-audit");
    } else if (!state.audit.length) {
      content = emptyState("Sem eventos", "Nenhum evento de auditoria para o filtro selecionado.");
    } else {
      content = auditTable(state.audit) + `
        <div class="table-actions" style="justify-content:center; margin-top:12px;">
          ${state.auditDone
            ? `<span class="cc-inline-note">Fim da trilha carregada.</span>`
            : `<button class="button button--secondary" type="button" data-action="audit-more"${state.auditLoading ? " disabled" : ""}>${state.auditLoading ? "Carregando…" : "Carregar mais"}</button>`}
        </div>
      `;
    }

    return `
      ${pageHeader("Trilha imutável", "Segurança e auditoria", "Eventos administrativos reais registrados pelo Platform Core (INSERT-only).")}
      <section class="panel toolbar">
        <form class="filter-grid filter-grid--compact" data-form="audit-filters">
          <label>Escopo
            <select name="tenantId">${tenantOptions}</select>
          </label>
          <div class="filter-actions"><button class="button button--secondary" type="submit">Aplicar</button></div>
        </form>
      </section>
      <section class="panel table-panel">${content}</section>
    `;
  }

  function renderSettings() {
    return `
      ${pageHeader("Console", "Configurações", "Preferências locais do console conectado — nada aqui altera o Platform Core.")}
      <div class="panel-grid">
        <section class="panel">
          <header class="panel__header"><div><span>Conexão</span><h2>Platform Core</h2></div></header>
          <p class="panel-note">A conexão é definida pela configuração de implantação deste ambiente.</p>
          <button class="button button--table" type="button" data-action="test-connection">Testar conexão</button>
        </section>
        <section class="panel">
          <header class="panel__header"><div><span>Sessão</span><h2>Identidade autenticada</h2></div></header>
          <dl class="fact-grid">
            <div><dt>Nome</dt><dd>${escapeHtml(state.user?.fullName || "—")}</dd></div>
            <div><dt>E-mail</dt><dd>${escapeHtml(state.user?.email || "—")}</dd></div>
            <div><dt>Papel</dt><dd>${escapeHtml(LABELS.platformRole[state.user?.platformRole] || state.user?.platformRole || "—")}</dd></div>
            <div><dt>Sessão</dt><dd>Validada pelo CORE, com renovação automática enquanto autorizada</dd></div>
          </dl>
          <div class="table-actions"><button class="button button--danger-ghost" type="button" data-action="logout">Encerrar sessão</button></div>
        </section>
      </div>
    `;
  }

  function renderView({ focusHeading = false } = {}) {
    if (!state.user) return;
    closePopovers();
    const renderers = {
      overview: renderOverview,
      companies: state.selectedTenantId ? renderCompanyDetail : renderCompanies,
      licenses: renderLicenses,
      users: renderUsers,
      environments: renderEnvironments,
      onboarding: renderOnboarding,
      security: renderSecurity,
      settings: renderSettings,
    };
    const title = state.activeView === "companies" && state.selectedTenantId
      ? (state.detail?.displayName || viewLabels.companies)
      : viewLabels[state.activeView];
    if (currentAreaTitle) currentAreaTitle.textContent = title;
    viewRoot.innerHTML = renderers[state.activeView]();
    document.querySelectorAll(".sidebar-nav [data-view]").forEach((button) => {
      if (button.dataset.view === state.activeView) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (focusHeading) {
      const context = captureContext();
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        if (contextIsCurrent(context)) viewRoot.querySelector("h1")?.focus({ preventScroll: true });
      });
    }
  }

  function navigateTo(view, { focusHeading = true } = {}) {
    if (!state.user || !viewLabels[view]) return;
    changeContext();
    state.activeView = view;
    if (view !== "companies") state.selectedTenantId = null;
    renderView({ focusHeading });
    if (view === "security" || view === "overview") loadAudit();
  }

  function openCompany(tenantId, tab = "summary") {
    if (!state.user) return;
    changeContext();
    state.activeView = "companies";
    state.selectedTenantId = tenantId;
    state.companyTab = tab;
    loadTenantDetail(tenantId);
  }

  /* ── Formulários e ações administrativas ───────────────────────────────── */
  function fieldError(form, message) {
    let line = form.querySelector(".form-error");
    if (!line) {
      line = document.createElement("p");
      line.className = "form-error";
      form.prepend(line);
    }
    line.textContent = message;
    line.hidden = !message;
  }

  function openCreateTenantModal() {
    openModal({
      kicker: "Provisionamento",
      title: "Nova empresa",
      size: "wide",
      body: `
        <form class="form-grid" data-form="create-tenant" novalidate>
          <label class="form-field">Slug (identificador único)
            <input name="slug" required pattern="^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$" placeholder="minha-empresa">
            <small class="form-hint">Minúsculas, números e hífen · 3 a 60 caracteres (regra do contrato).</small>
          </label>
          <label class="form-field">Nome de exibição
            <input name="displayName" required minlength="2" maxlength="160" placeholder="Minha Empresa Ltda">
          </label>
          <label class="form-field">Razão social (opcional)
            <input name="legalName" maxlength="200">
          </label>
          <label class="form-field">Tipo de documento (opcional)
            <input name="taxIdType" maxlength="16" placeholder="CNPJ">
          </label>
          <label class="form-field">Documento (opcional)
            <input name="taxIdValue" maxlength="32" placeholder="00.000.000/0001-00">
          </label>
          <label class="form-field">País
            <input name="primaryCountry" maxlength="2" value="BR">
          </label>
          <label class="form-field">Locale padrão
            <input name="defaultLocale" value="pt-BR">
          </label>
          <label class="form-field">Fuso horário
            <input name="defaultTimezone" value="America/Sao_Paulo">
          </label>
          <label class="form-field">Moeda
            <input name="defaultCurrency" maxlength="3" value="BRL">
          </label>
          <label class="form-field">Status inicial
            <select name="status">
              <option value="PROVISIONING" selected>Provisionando</option>
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Ativa</option>
            </select>
          </label>
          <p class="form-disclaimer">A criação é executada pelo Platform Core e registrada em auditoria.</p>
        </form>
      `,
      footer: `
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--primary" type="button" data-action="submit-create-tenant">Criar empresa</button>
      `,
    });
  }

  async function submitCreateTenant(button) {
    const form = modalBody.querySelector('[data-form="create-tenant"]');
    if (!form || !form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = { slug: data.slug.trim(), displayName: data.displayName.trim(), status: data.status };
    ["legalName", "taxIdType", "taxIdValue"].forEach((key) => { if (data[key]?.trim()) payload[key] = data[key].trim(); });
    ["primaryCountry", "defaultLocale", "defaultTimezone", "defaultCurrency"].forEach((key) => { if (data[key]?.trim()) payload[key] = data[key].trim(); });
    const action = beginAction(button, null);
    if (!action) return;
    setBusy(button, true);
    try {
      const tenant = await api.adminCreateTenant(payload);
      if (!actionIsCurrent(action)) return;
      closeModal();
      const completionGeneration = modalGeneration;
      showToast("Empresa criada", "success", `${tenant.displayName} registrada no Platform Core.`);
      await loadTenants();
      if (!contextIsCurrent(action) || completionGeneration !== modalGeneration) return;
      openCompany(tenant.id);
    } catch (error) {
      if (!actionIsCurrent(action)) return;
      fieldError(form, Core.friendlyError(error));
      setBusy(button, false);
    }
  }

  function openEditTenantModal(tenantId) {
    const tenant = state.detail;
    if (!tenant || tenant.id !== tenantId) return;
    const fields = [
      ["displayName", "Nome de exibição", 160, true], ["legalName", "Razão social", 200],
      ["taxIdType", "Tipo de documento", 16], ["taxIdValue", "Documento", 32],
      ["primaryCountry", "País", 2, true], ["defaultLocale", "Idioma padrão", 16, true],
      ["defaultTimezone", "Fuso horário", 64, true], ["defaultCurrency", "Moeda", 3, true],
    ];
    openModal({ tenantId, title: "Editar empresa", body: `<form class="form-grid" data-form="edit-tenant" data-tenant-id="${tenant.id}">${fields.map(([name, label, max, required]) => `<label class="form-field">${label}<input name="${name}" maxlength="${max}" value="${escapeHtml(tenant[name] || "")}"${required ? " required" : ""}></label>`).join("")}<p class="form-disclaimer">Identificador da empresa: ${escapeHtml(tenant.slug)}. Alterações registradas em auditoria.</p></form>`, footer: `<button class="button button--secondary" data-action="close-modal">Cancelar</button><button class="button button--primary" data-action="submit-edit-tenant">Salvar empresa</button>` });
  }

  async function submitEditTenant(button) {
    const form = modalBody.querySelector('[data-form="edit-tenant"]');
    if (!form || !form.reportValidity()) return;
    const fields = ["displayName", "legalName", "taxIdType", "taxIdValue", "primaryCountry", "defaultLocale", "defaultTimezone", "defaultCurrency"];
    const payload = Object.fromEntries(fields.map((key) => [key, form.elements[key].value.trim()]));
    ["legalName", "taxIdType", "taxIdValue"].forEach((key) => { if (!payload[key]) payload[key] = null; });
    const action = beginAction(button, form.dataset.tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      await api.adminUpdateTenant(form.dataset.tenantId, payload);
      if (!actionIsCurrent(action)) return;
      closeModal();
      showToast("Empresa atualizada", "success", "Dados administrativos salvos.");
      await Promise.all([loadTenants(), loadTenantDetail(form.dataset.tenantId)]);
    } catch (error) {
      if (!actionIsCurrent(action)) return; fieldError(form, Core.friendlyError(error)); setBusy(button, false); }
  }

  function openActivateTenantModal(tenantId) {
    openModal({ tenantId, title: "Ativar empresa", body: `<p>A empresa passará a operar como ativa. Módulos e licenças continuam sujeitos à contratação configurada.</p>`, footer: `<button class="button button--secondary" data-action="close-modal">Cancelar</button><button class="button button--positive" data-action="execute-activate-tenant" data-tenant-id="${tenantId}">Ativar</button>` });
  }

  async function executeActivateTenant(tenantId, button) {
    const action = beginAction(button, tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      await api.adminActivateTenant(tenantId);
      if (!actionIsCurrent(action)) return;
      closeModal();
      showToast("Empresa ativa", "success", "Ativação registrada no CORE.");
      await Promise.all([loadTenants(), loadTenantDetail(tenantId)]);
    } catch (error) {
      if (!actionIsCurrent(action)) return; showToast("Não foi possível ativar", "error", Core.friendlyError(error)); setBusy(button, false); }
  }

  function openOwnerModal(tenantId) {
    const owner = (state.detailMemberships || []).find((member) => member.isTenantOwner);
    openModal({ tenantId, title: "Designar OWNER", body: `<form class="form-grid" data-form="owner" data-tenant-id="${tenantId}"><label class="form-field form-field--wide">E-mail do responsável<input name="email" type="email" required value="${escapeHtml(owner?.user.email || "")}"></label><p class="form-disclaimer">${owner ? "Esta empresa já possui um OWNER. Informar o mesmo responsável confirma o estado atual; transferência não está disponível." : "Um membro ativo existente será designado. Para um novo membro, o CORE emitirá convite e concluirá a designação no aceite."} O papel administrativo é definido pelo servidor e vale somente nesta empresa.</p></form>`, footer: `<button class="button button--secondary" data-action="close-modal">Cancelar</button><button class="button button--primary" data-action="submit-owner">Designar OWNER</button>` });
  }

  function showInvitationLink(result, tenantId) {
    if (!result.token) {
      openModal({ tenantId, kicker: "Convite existente", title: "OWNER aguardando aceite", body: `<p>O convite para <strong>${escapeHtml(result.invitation.email)}</strong> já está registrado como OWNER. Use o link entregue anteriormente.</p><p>O segredo não pode ser recuperado. Se o link foi perdido, revogue o convite em “Convites” e designe o OWNER novamente para emitir outro.</p>`, footer: `<button class="button button--primary" data-action="close-modal">Concluir</button>` });
      return;
    }
    openModal({ tenantId, kicker: "Convite emitido", title: "Link de aceite — exibido uma única vez", body: `<p>Copie e entregue este link ao responsável por canal seguro.</p><div class="cc-token-box"><code id="cc-invite-token">${escapeHtml(Core.invitationUrl(result.token, tenantId))}</code><button class="button button--secondary" data-action="copy-invite-token">Copiar link</button></div><p>Convite para <strong>${escapeHtml(result.invitation.email)}</strong> · expira em ${formatDate(result.invitation.expiresAt, true)}.</p>`, footer: `<button class="button button--primary" data-action="close-modal">Concluir</button>` });
  }

  async function submitOwner(button) {
    const form = modalBody.querySelector('[data-form="owner"]');
    if (!form || !form.reportValidity()) return;
    const tenantId = form.dataset.tenantId;
    const action = beginAction(button, tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      const result = await api.adminDesignateOwner(tenantId, form.elements.email.value.trim());
      if (!actionIsCurrent(action)) return;
      if (result.status === "INVITED") showInvitationLink(result, tenantId);
      else { closeModal(); showToast("OWNER confirmado", "success", result.status === "ALREADY_OWNER" ? "O responsável já era OWNER desta empresa." : "Responsável designado com autoridade administrativa nesta empresa."); }
      await loadTenantDetail(tenantId);
    } catch (error) {
      if (!actionIsCurrent(action)) return; fieldError(form, Core.friendlyError(error)); setBusy(button, false); }
  }

  function openRevokeInvitationModal(tenantId, invitationId) {
    const invite = (state.detailInvitations || []).find((item) => item.id === invitationId);
    if (!invite) return;
    const expired = invite.status === "EXPIRED";
    openModal({ tenantId, title: expired ? "Liberar reserva de convite expirado" : "Revogar convite", body: `<p>${expired ? "As licenças reservadas serão devolvidas à empresa. O convite permanece expirado." : `O link enviado para <strong>${escapeHtml(invite.email)}</strong> deixará de funcionar. Depois você poderá emitir um novo convite.`}</p>`, footer: `<button class="button button--secondary" data-action="close-modal">Cancelar</button><button class="button button--danger" data-action="execute-revoke-invitation" data-tenant-id="${tenantId}" data-invitation-id="${invitationId}">${expired ? "Liberar reserva" : "Revogar convite"}</button>` });
  }

  async function executeRevokeInvitation(tenantId, invitationId, button) {
    const action = beginAction(button, tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      await api.adminRevokeInvitation(tenantId, invitationId);
      if (!actionIsCurrent(action)) return;
      closeModal();
      showToast("Convite encerrado", "success", "O link anterior não pode ser utilizado e eventuais reservas foram liberadas.");
      await loadTenantDetail(tenantId);
    } catch (error) {
      if (!actionIsCurrent(action)) return; showToast("Falha ao revogar convite", "error", Core.friendlyError(error)); setBusy(button, false); }
  }

  function openSuspendTenantModal(tenantId) {
    const tenant = state.detail?.id === tenantId ? state.detail : state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return;
    openModal({ tenantId,
      kicker: "Ação crítica — etapa 1 de 2",
      title: `Suspender ${tenant.displayName}`,
      body: `
        <form class="form-grid" data-form="suspend-tenant" novalidate>
          <p>Todos os acessos da empresa serão bloqueados pelo Core imediatamente. Dados são preservados e a reativação é possível a qualquer momento.</p>
          <label class="form-field form-field--wide">Motivo (obrigatório, mínimo 3 caracteres)
            <textarea name="reason" required minlength="3" maxlength="500" rows="3" placeholder="Ex.: inadimplência contratual"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--danger" type="button" data-action="suspend-tenant-step2" data-tenant-id="${tenant.id}">Continuar</button>
      `,
    });
  }

  function openSuspendTenantConfirm(tenantId) {
    const form = modalBody.querySelector('[data-form="suspend-tenant"]');
    if (!form || !form.reportValidity()) return;
    const reason = new FormData(form).get("reason").trim();
    const tenant = state.detail?.id === tenantId ? state.detail : state.tenants.find((t) => t.id === tenantId);
    openModal({ tenantId,
      kicker: "Ação crítica — confirmação explícita",
      title: `Confirmar suspensão de ${tenant.displayName}`,
      body: `
        <p>Motivo registrado: “${escapeHtml(reason)}”.</p>
        <label class="form-field form-field--wide">Digite o slug <strong>${escapeHtml(tenant.slug)}</strong> para confirmar
          <input id="cc-critical-confirm" autocomplete="off" placeholder="${escapeHtml(tenant.slug)}">
        </label>
      `,
      footer: `
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--danger" type="button" data-action="execute-suspend-tenant" data-tenant-id="${tenant.id}" data-reason="${escapeHtml(reason)}" data-expected="${escapeHtml(tenant.slug)}" disabled>Suspender agora</button>
      `,
    });
  }

  async function executeSuspendTenant(button) {
    const action = beginAction(button, button.dataset.tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      await api.adminSuspendTenant(button.dataset.tenantId, button.dataset.reason);
      if (!actionIsCurrent(action)) return;
      closeModal();
      const completionGeneration = modalGeneration;
      showToast("Empresa suspensa", "warning", "Bloqueio aplicado pelo Core e registrado em auditoria.");
      await loadTenants();
      if (!contextIsCurrent(action) || completionGeneration !== modalGeneration) return;
      if (state.selectedTenantId) loadTenantDetail(state.selectedTenantId);
    } catch (error) {
      if (!actionIsCurrent(action)) return;
      closeModal();
      showToast("Falha ao suspender", "danger", Core.friendlyError(error));
    }
  }

  function openReactivateTenantModal(tenantId) {
    const tenant = state.detail?.id === tenantId ? state.detail : state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return;
    openModal({ tenantId,
      kicker: "Ação administrativa",
      title: `Reativar ${tenant.displayName}`,
      body: `<p>A empresa voltará ao estado ativo e os acessos serão restabelecidos conforme licenças vigentes.</p>`,
      footer: `
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--positive" type="button" data-action="execute-reactivate-tenant" data-tenant-id="${tenant.id}">Reativar</button>
      `,
    });
  }

  async function executeReactivateTenant(button) {
    const action = beginAction(button, button.dataset.tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      await api.adminReactivateTenant(button.dataset.tenantId);
      if (!actionIsCurrent(action)) return;
      closeModal();
      const completionGeneration = modalGeneration;
      showToast("Empresa reativada", "success", "Estado atualizado pelo Platform Core.");
      await loadTenants();
      if (!contextIsCurrent(action) || completionGeneration !== modalGeneration) return;
      if (state.selectedTenantId) loadTenantDetail(state.selectedTenantId);
    } catch (error) {
      if (!actionIsCurrent(action)) return;
      closeModal();
      showToast("Falha ao reativar", "danger", Core.friendlyError(error));
    }
  }

  function openEntitlementModal(tenantId, moduleKey) {
    const existing = (state.detail?.id === tenantId ? state.detailEntitlements : state.licenseData)?.find((ent) => ent.moduleKey === moduleKey) || null;
    const seatTypes = state.catalog?.seatTypes || [];
    const stateOptions = ["ACTIVE", "TRIAL", "NOT_CONTRACTED", "SUSPENDED", "EXPIRED", "CANCELLED"].map((value) => (
      `<option value="${value}"${(existing?.state || "ACTIVE") === value ? " selected" : ""}>${escapeHtml(LABELS.entitlementState[value])}</option>`
    )).join("");
    const toDateInput = (value) => (value ? String(value).slice(0, 10) : "");
    const quotaRow = (quota = {}) => `
      <div class="quota-row">
        <select name="seatTypeKey">
          ${seatTypes.map((seatType) => `<option value="${escapeHtml(seatType.key)}"${quota.seatTypeKey === seatType.key ? " selected" : ""}>${escapeHtml(LABELS.seatType[seatType.key] || seatType.name || seatType.key)}</option>`).join("")}
        </select>
        <input type="number" name="quantityContracted" min="0" max="100000" value="${quota.quantityContracted ?? 1}" aria-label="Quantidade contratada">
        <input type="number" name="quantityOverageAllowed" min="0" max="100000" value="${quota.quantityOverageAllowed ?? 0}" aria-label="Tolerância de excedente">
        <button class="button button--table" type="button" data-action="remove-quota-row">Remover</button>
      </div>
    `;
    const quotas = existing?.seatQuotas?.length ? existing.seatQuotas.map(quotaRow).join("") : quotaRow();

    openModal({ tenantId,
      kicker: existing ? "Atualização de entitlement" : "Concessão de módulo",
      title: `${moduleName(moduleKey)} — licenciamento`,
      size: "wide",
      body: `
        <form class="form-grid" data-form="entitlement" data-tenant-id="${tenantId}" data-module-key="${moduleKey}" novalidate>
          <label class="form-field">Estado
            <select name="state">${stateOptions}</select>
          </label>
          <label class="form-field">Fim do trial (opcional)
            <input type="date" name="trialEndsAt" value="${toDateInput(existing?.trialEndsAt)}">
          </label>
          <label class="form-field">Expira em (opcional)
            <input type="date" name="expiresAt" value="${toDateInput(existing?.expiresAt)}">
          </label>
          <div class="form-field form-field--wide">
            <span>Licenças contratadas por tipo</span>
            <div class="quota-rows" id="cc-quota-rows">${quotas}</div>
            <button class="button button--table" type="button" data-action="add-quota-row">Adicionar tipo de licença</button>
            <small class="form-hint">Tipos, quantidades e tolerâncias seguem o contrato — a aplicação dos limites é feita exclusivamente pelo Core.</small>
          </div>
          <p class="form-disclaimer">A alteração é executada pelo Platform Core e registrada em auditoria.</p>
        </form>
      `,
      footer: `
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--primary" type="button" data-action="submit-entitlement">Salvar entitlement</button>
      `,
    });
  }

  async function submitEntitlement(button) {
    const form = modalBody.querySelector('[data-form="entitlement"]');
    if (!form || !form.reportValidity()) return;
    const tenantId = form.dataset.tenantId;
    const moduleKey = form.dataset.moduleKey;
    const stateValue = form.querySelector('[name="state"]').value;
    const trialEndsAt = form.querySelector('[name="trialEndsAt"]').value;
    const expiresAt = form.querySelector('[name="expiresAt"]').value;
    const seatQuotas = [...form.querySelectorAll(".quota-row")].map((row) => {
      const quota = {
        seatTypeKey: row.querySelector('[name="seatTypeKey"]').value,
        quantityContracted: Number(row.querySelector('[name="quantityContracted"]').value || 0),
      };
      const overage = Number(row.querySelector('[name="quantityOverageAllowed"]').value || 0);
      if (overage > 0) quota.quantityOverageAllowed = overage;
      return quota;
    });
    const payload = { state: stateValue, seatQuotas };
    if (trialEndsAt) payload.trialEndsAt = new Date(`${trialEndsAt}T23:59:59-03:00`).toISOString();
    if (expiresAt) payload.expiresAt = new Date(`${expiresAt}T23:59:59-03:00`).toISOString();
    const action = beginAction(button, tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      await api.adminGrantEntitlement(tenantId, moduleKey, payload);
      if (!actionIsCurrent(action)) return;
      closeModal();
      showToast("Entitlement atualizado", "success", `${moduleName(moduleKey)} — estado ${LABELS.entitlementState[stateValue]}.`);
      if (state.selectedTenantId === tenantId) loadTenantDetail(tenantId);
      if (state.licenseTenantId === tenantId) loadLicenses(tenantId);
    } catch (error) {
      if (!actionIsCurrent(action)) return;
      fieldError(form, Core.friendlyError(error));
      setBusy(button, false);
    }
  }

  function openSuspendEntitlementModal(tenantId, moduleKey) {
    openModal({ tenantId,
      kicker: "Ação crítica",
      title: `Suspender ${moduleName(moduleKey)}`,
      body: `
        <form class="form-grid" data-form="suspend-entitlement" data-tenant-id="${tenantId}" data-module-key="${moduleKey}" novalidate>
          <p>O módulo ficará indisponível para a empresa até nova decisão administrativa. Dados são preservados pelo Core.</p>
          <label class="form-field form-field--wide">Motivo (obrigatório)
            <textarea name="reason" required minlength="3" maxlength="500" rows="3"></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--danger" type="button" data-action="execute-suspend-entitlement">Suspender módulo</button>
      `,
    });
  }

  async function executeSuspendEntitlement(button) {
    const form = modalBody.querySelector('[data-form="suspend-entitlement"]');
    if (!form || !form.reportValidity()) return;
    const reason = new FormData(form).get("reason").trim();
    const action = beginAction(button, form.dataset.tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      await api.adminSuspendEntitlement(form.dataset.tenantId, form.dataset.moduleKey, reason);
      if (!actionIsCurrent(action)) return;
      closeModal();
      showToast("Módulo suspenso", "warning", "Estado aplicado pelo Core e registrado em auditoria.");
      loadTenantDetail(form.dataset.tenantId);
    } catch (error) {
      if (!actionIsCurrent(action)) return;
      fieldError(form, Core.friendlyError(error));
      setBusy(button, false);
    }
  }

  function openCancelEntitlementModal(tenantId, moduleKey) {
    openModal({ tenantId,
      kicker: "Ação crítica — confirmação explícita",
      title: `Cancelar ${moduleName(moduleKey)}`,
      body: `
        <form class="form-grid" data-form="cancel-entitlement" data-tenant-id="${tenantId}" data-module-key="${moduleKey}" novalidate>
          <p>O cancelamento encerra o contrato do módulo. O Core preserva os dados pelo período de retenção informado.</p>
          <label class="form-field">Retenção de dados (dias, opcional)
            <input type="number" name="retentionDays" min="0" max="3650" placeholder="90">
          </label>
          <label class="form-field form-field--wide">Digite <strong>${escapeHtml(moduleKey)}</strong> para confirmar
            <input id="cc-critical-confirm" autocomplete="off" placeholder="${escapeHtml(moduleKey)}">
          </label>
        </form>
      `,
      footer: `
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--danger" type="button" data-action="execute-cancel-entitlement" data-expected="${escapeHtml(moduleKey)}" disabled>Cancelar módulo</button>
      `,
    });
  }

  async function executeCancelEntitlement(button) {
    const form = modalBody.querySelector('[data-form="cancel-entitlement"]');
    if (!form) return;
    const retention = form.querySelector('[name="retentionDays"]').value;
    const payload = retention ? { retentionDays: Number(retention) } : {};
    const action = beginAction(button, form.dataset.tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      await api.adminCancelEntitlement(form.dataset.tenantId, form.dataset.moduleKey, payload);
      if (!actionIsCurrent(action)) return;
      closeModal();
      showToast("Módulo cancelado", "warning", "Encerramento registrado pelo Platform Core.");
      loadTenantDetail(form.dataset.tenantId);
    } catch (error) {
      if (!actionIsCurrent(action)) return;
      fieldError(form, Core.friendlyError(error));
      setBusy(button, false);
    }
  }

  async function openInviteModal(tenantId) {
    const tenant = state.detail?.id === tenantId ? state.detail : state.tenants.find((t) => t.id === tenantId);
    openModal({ tenantId,
      kicker: "Primeiro acesso",
      title: `Convidar membro — ${tenant ? tenant.displayName : ""}`,
      size: "wide",
      body: `<div class="cc-skeleton"><span></span><span></span><span></span></div>`,
      footer: "",
    });

    const opened = modalContext;
    let rolesField;
    try {
      const roles = await api.adminTenantRoles(tenantId);
      if (!actionIsCurrent(opened)) return;
      rolesField = `
        <div class="form-field form-field--wide">
          <span>Papéis iniciais</span>
          ${roles.map((role) => `
            <label class="cc-check"><input type="checkbox" name="roleId" value="${escapeHtml(role.id)}"${role.key === "TENANT_ADMIN" ? " checked" : ""}> ${escapeHtml(role.name)}</label>
          `).join("")}
        </div>
      `;
    } catch (error) {
      if (!actionIsCurrent(opened)) return;
      modalBody.innerHTML = `<p class="form-error">${escapeHtml(Core.friendlyError(error))}</p>`;
      modalFooter.innerHTML = `<button class="button button--secondary" data-action="close-modal">Fechar</button>`;
      return;
    }

    modalBody.innerHTML = `
      <form class="form-grid" data-form="invite" data-tenant-id="${tenantId}" novalidate>
        <label class="form-field form-field--wide">E-mail do convidado
          <input type="email" name="email" required placeholder="admin@empresa.com.br">
        </label>
        ${rolesField}
        <p class="form-disclaimer">O convite é emitido pelo Platform Core. O link aparece uma única vez — copie e entregue por canal seguro. Para designar o responsável da empresa, use “Designar OWNER”.</p>
      </form>
    `;
    modalFooter.innerHTML = `
      <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
      <button class="button button--primary" type="button" data-action="submit-invite">Emitir convite</button>
    `;
  }

  async function submitInvite(button) {
    const form = modalBody.querySelector('[data-form="invite"]');
    if (!form || !form.reportValidity()) return;
    const email = form.querySelector('[name="email"]').value.trim();
    const roleIds = [...form.querySelectorAll('[name="roleId"]:checked')].map((input) => input.value);
    if (!roleIds.length) {
      fieldError(form, "Informe pelo menos um papel inicial.");
      return;
    }
    const action = beginAction(button, form.dataset.tenantId);
    if (!action) return;
    setBusy(button, true);
    try {
      const result = await api.adminCreateInvitation(form.dataset.tenantId, { email, intendedRoleIds: roleIds });
      if (!actionIsCurrent(action)) return;
      showInvitationLink(result, form.dataset.tenantId);
      showToast("Convite emitido", "success", `Convite registrado para ${result.invitation.email}.`);
      if (state.selectedTenantId === form.dataset.tenantId) await loadTenantDetail(form.dataset.tenantId);
    } catch (error) {
      if (!actionIsCurrent(action)) return;
      fieldError(form, Core.friendlyError(error));
      setBusy(button, false);
    }
  }

  /* ── Popovers / busca / shell ──────────────────────────────────────────── */
  function closePopovers() {
    if (notificationPopover) notificationPopover.hidden = true;
    if (ownerPopover) ownerPopover.hidden = true;
    document.querySelectorAll('[data-action="toggle-notifications"], [data-action="toggle-owner-menu"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
  }

  function renderSearchResults(term) {
    if (!term || term.length < 2 || !state.tenants.length) {
      searchResults.hidden = true;
      searchInput.setAttribute("aria-expanded", "false");
      return;
    }
    const lower = term.toLowerCase();
    const matches = state.tenants.filter((tenant) => tenant.displayName.toLowerCase().includes(lower) || tenant.slug.includes(lower)).slice(0, 6);
    searchResults.innerHTML = matches.length
      ? `<span class="search-group-label">Empresas</span>` + matches.map((tenant) => `
          <button type="button" role="option" data-action="open-company" data-tenant-id="${tenant.id}">
            <span class="company-monogram company-monogram--tiny">${escapeHtml(tenant.displayName.slice(0, 2).toUpperCase())}</span>
            <span><strong>${escapeHtml(tenant.displayName)}</strong><small>${escapeHtml(tenant.slug)} · ${escapeHtml(LABELS.tenantStatus[tenant.status] || tenant.status)}</small></span>
          </button>
        `).join("")
      : `<p class="search-empty">Nenhuma empresa corresponde à busca.</p>`;
    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  /* ── Autenticação ──────────────────────────────────────────────────────── */
  function showLoginError(message) {
    if (!loginError) return;
    loginError.textContent = message;
    loginError.hidden = !message;
  }

  function fillIdentity(user) {
    const initials = (user.fullName || user.email).split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
    const roleLabel = LABELS.platformRole[user.platformRole] || user.platformRole;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("cc-owner-avatar-side", initials);
    set("cc-owner-avatar-top", initials);
    set("cc-owner-name-side", user.fullName || user.email);
    set("cc-owner-role-side", roleLabel);
    set("cc-owner-first-name", (user.fullName || user.email).split(/\s+/)[0]);
    set("cc-owner-name-pop", user.fullName || user.email);
    set("cc-owner-role-pop", roleLabel);
  }

  async function unlock(user, authenticationSessionId) {
    clearIdentity();
    state.user = user;
    state.authenticationSessionId = authenticationSessionId;
    const context = captureContext(false);
    fillIdentity(user);
    document.body.classList.remove("is-access-locked");
    accessScreen.hidden = true;
    transition.set('valid');
    controlCenter.hidden = false;
    requestAnimationFrame(() => {
      if (contextIsCurrent(context)) controlCenter.classList.add("is-entered");
    });
    setConnectionState(true);
    renderView({ focusHeading: true });
    try { await loadCatalog(); } catch (_) { /* catálogo é enriquecimento visual */ }
    if (!contextIsCurrent(context)) return;
    await loadTenants();
    if (!contextIsCurrent(context)) return;
    loadAudit();
  }

  function relock(message) {
    authenticationGeneration += 1;
    clearIdentity();
    controlCenter.hidden = true;
    controlCenter.classList.remove("is-entered");
    accessScreen.hidden = true;
    accessScreen.classList.remove("is-leaving");
    document.body.classList.add("is-access-locked");
    transition.set("invalid", message || "Não foi possível confirmar sua sessão.", () => window.location.reload());
  }

  function handleLogin(event) {
    event.preventDefault();
    authenticationGeneration += 1;
    relock("");
    window.location.replace("/?returnTo=/control-center/index.html");
  }

  const transition = window.RoutflexTransition.create({
    intent: '/control-center/index.html', render: window.RoutflexTransition.panel(),
  });
  function clearProtected() {
    authenticationGeneration++; clearIdentity(); controlCenter.hidden = true;
    controlCenter.classList.remove('is-entered'); accessScreen.hidden = true;
    document.body.classList.add('is-access-locked');
  }
  let loginPending = false;
  let logoutPending = false;
  async function logout() {
    if (logoutPending) return;
    logoutPending = true;
    try { await transition.logout(Core, clearProtected); }
    finally { logoutPending = false; }
  }

  Core.onUnauthenticated(error => {
    const wasValid = Boolean(state.user);
    clearProtected(); transition.invalid(error, wasValid);
  });

  /* ── Eventos globais ───────────────────────────────────────────────────── */
  loginForm?.addEventListener("submit", handleLogin);

  document.addEventListener("input", (event) => {
    if (!state.user || !event.target.isConnected) return;
    if (event.target.id === "cc-critical-confirm") {
      const executeButton = modalFooter.querySelector("[data-expected]");
      if (executeButton) executeButton.disabled = event.target.value.trim() !== executeButton.dataset.expected;
    }
    if (event.target === searchInput) renderSearchResults(searchInput.value.trim());
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-form]");
    if (!state.user || !form || !form.isConnected || form === loginForm) return;
    event.preventDefault();
    const handlers = {
      "company-filters": () => {
        const data = new FormData(form);
        state.filters.status = data.get("status");
        state.filters.search = data.get("search") || "";
        loadTenants();
      },
      "license-tenant": () => {
        const tenantId = new FormData(form).get("tenantId");
        if (tenantId) loadLicenses(tenantId);
      },
      "audit-filters": () => {
        changeContext();
        state.auditTenantFilter = new FormData(form).get("tenantId");
        loadAudit({ reset: true });
      },

    };
    handlers[form.dataset.form]?.();
  });

  document.addEventListener("click", (event) => {
    if (!state.user || !event.target.isConnected) return;
    const viewButton = event.target.closest("[data-view]");
    if (viewButton && state.user) {
      closePopovers();
      navigateTo(viewButton.dataset.view);
      return;
    }

    const tabButton = event.target.closest("[data-company-tab]");
    if (tabButton) {
      closeModal({ restoreFocus: false });
      state.companyTab = tabButton.dataset.companyTab;
      renderView();
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      if (!event.target.closest(".topbar-popover") && !event.target.closest(".global-search")) closePopovers();
      if (!event.target.closest(".global-search")) { searchResults.hidden = true; }
      return;
    }
    if (actionButton.disabled) return;
    const action = actionButton.dataset.action;

    switch (action) {
      /* shell */
      case "toggle-sidebar":
        state.sidebarCollapsed = !state.sidebarCollapsed;
        controlCenter.classList.toggle("is-sidebar-collapsed", state.sidebarCollapsed);
        actionButton.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
        break;
      case "open-drawer":
        document.body.classList.add("is-drawer-open");
        document.querySelector(".drawer-overlay").hidden = false;
        break;
      case "close-drawer":
        document.body.classList.remove("is-drawer-open");
        document.querySelector(".drawer-overlay").hidden = true;
        break;
      case "toggle-notifications": {
        const willOpen = notificationPopover.hidden;
        closePopovers();
        if (willOpen) {
          notificationPopover.innerHTML = `<strong>Notificações</strong><span>O contrato atual do Core não expõe um canal de notificações. A trilha de auditoria é a fonte oficial de eventos.</span><hr><button type="button" data-view="security">Abrir auditoria</button>`;
          notificationPopover.hidden = false;
          actionButton.setAttribute("aria-expanded", "true");
        }
        break;
      }
      case "toggle-owner-menu": {
        const willOpen = ownerPopover.hidden;
        closePopovers();
        if (willOpen) {
          ownerPopover.hidden = false;
          actionButton.setAttribute("aria-expanded", "true");
        }
        break;
      }
      case "dismiss-toast": toastRegion.innerHTML = ""; break;
      case "close-modal": closeModal(); break;
      case "logout": logout(); break;

      /* navegação de dados */
      case "open-company":
        closePopovers();
        searchResults.hidden = true;
        if (searchInput) searchInput.value = "";
        openCompany(actionButton.dataset.tenantId);
        break;
      case "back-to-companies":
        navigateTo("companies");
        break;
      case "retry-tenants": loadTenants(); break;
      case "retry-company-detail": if (state.selectedTenantId) loadTenantDetail(state.selectedTenantId); break;
      case "retry-company-audit": if (state.selectedTenantId) loadDetailAudit(state.selectedTenantId); break;
      case "retry-licenses": if (state.licenseTenantId) loadLicenses(state.licenseTenantId); break;
      case "retry-audit": loadAudit({ reset: true }); break;
      case "audit-more": loadAudit({ reset: false }); break;
      case "clear-company-filters":
        state.filters = { status: "all", search: "" };
        loadTenants();
        break;
      case "test-connection": {
        const request = beginRequest("connection");
        setBusy(actionButton, true, "Testando…");
        api.catalog()
          .then(() => { if (!requestIsCurrent(request)) return; setConnectionState(true); showToast("Conexão saudável", "success", `Core acessível em ${Core.apiBase()}.`); })
          .catch((error) => { if (!requestIsCurrent(request)) return; setConnectionState(false); showToast("Falha de conexão", "danger", Core.friendlyError(error)); })
          .finally(() => { if (requestIsCurrent(request)) setBusy(actionButton, false); });
        break;
      }

      /* ações administrativas */
      case "open-create-tenant": openCreateTenantModal(); break;
      case "submit-create-tenant": submitCreateTenant(actionButton); break;
      case "edit-tenant": openEditTenantModal(actionButton.dataset.tenantId); break;
      case "submit-edit-tenant": submitEditTenant(actionButton); break;
      case "activate-tenant": openActivateTenantModal(actionButton.dataset.tenantId); break;
      case "execute-activate-tenant": executeActivateTenant(actionButton.dataset.tenantId, actionButton); break;
      case "open-owner": openOwnerModal(actionButton.dataset.tenantId); break;
      case "submit-owner": submitOwner(actionButton); break;
      case "revoke-invitation": openRevokeInvitationModal(actionButton.dataset.tenantId, actionButton.dataset.invitationId); break;
      case "execute-revoke-invitation": executeRevokeInvitation(actionButton.dataset.tenantId, actionButton.dataset.invitationId, actionButton); break;
      case "suspend-tenant": openSuspendTenantModal(actionButton.dataset.tenantId); break;
      case "suspend-tenant-step2": openSuspendTenantConfirm(actionButton.dataset.tenantId); break;
      case "execute-suspend-tenant": executeSuspendTenant(actionButton); break;
      case "reactivate-tenant": openReactivateTenantModal(actionButton.dataset.tenantId); break;
      case "execute-reactivate-tenant": executeReactivateTenant(actionButton); break;
      case "open-entitlement": openEntitlementModal(actionButton.dataset.tenantId, actionButton.dataset.moduleKey); break;
      case "submit-entitlement": submitEntitlement(actionButton); break;
      case "suspend-entitlement": openSuspendEntitlementModal(actionButton.dataset.tenantId, actionButton.dataset.moduleKey); break;
      case "execute-suspend-entitlement": executeSuspendEntitlement(actionButton); break;
      case "cancel-entitlement": openCancelEntitlementModal(actionButton.dataset.tenantId, actionButton.dataset.moduleKey); break;
      case "execute-cancel-entitlement": executeCancelEntitlement(actionButton); break;
      case "open-invite": openInviteModal(actionButton.dataset.tenantId); break;
      case "submit-invite": submitInvite(actionButton); break;
      case "add-quota-row": {
        const rows = document.getElementById("cc-quota-rows");
        if (rows) {
          const template = rows.querySelector(".quota-row");
          const clone = template.cloneNode(true);
          clone.querySelectorAll("input").forEach((input) => { input.value = input.name === "quantityContracted" ? 1 : 0; });
          rows.appendChild(clone);
        }
        break;
      }
      case "remove-quota-row": {
        const rows = document.getElementById("cc-quota-rows");
        if (rows && rows.querySelectorAll(".quota-row").length > 1) actionButton.closest(".quota-row").remove();
        break;
      }
      case "copy-invite-token": {
        const action = beginAction(actionButton);
        if (!action) return;
        const token = document.getElementById("cc-invite-token")?.textContent || "";
        navigator.clipboard?.writeText(token).then(
          () => { if (actionIsCurrent(action)) showToast("Link copiado", "success", "Entregue por canal seguro — não será exibido novamente."); },
          () => { if (actionIsCurrent(action)) showToast("Copie manualmente", "warning", "Seu navegador bloqueou a cópia automática."); }
        );
        break;
      }
      default: break;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!modalLayer.hidden) { closeModal(); return; }
    closePopovers();
    searchResults.hidden = true;
  });

  Core.watchSession?.(me => {
    if (state.user && me.user.platformRole !== "PLATFORM_OWNER") {
      clearProtected(); transition.entry(false, false);
    }
  });

  /* ── Boot ──────────────────────────────────────────────────────────────── */
  (async function boot() {
    const attempt = authenticationGeneration;
    try {
      const me = await api.me();
      if (attempt !== authenticationGeneration) return;
      if (me.user.platformRole !== "PLATFORM_OWNER") {
        const destination = await window.RoutflexDestination.resolve(Core, { me });
        if (attempt !== authenticationGeneration) return;
        clearProtected();
        if (destination.href) transition.navigate(destination.href);
        else transition.entry(false, false);
        return;
      }
      await unlock(me.user, me.authenticationSessionId);
    } catch (error) {
      if (attempt !== authenticationGeneration) return;
      if (error.code === "NETWORK_UNREACHABLE") setConnectionState(false);
      clearProtected(); transition.invalid(error, false);
    }
  })();
})();
