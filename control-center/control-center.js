(function initControlCenter() {
  "use strict";

  const sourceSeed = window.CONTROL_CENTER_MOCK_DATA;
  if (!sourceSeed) {
    throw new Error("Dados demonstrativos do Control Center não foram carregados.");
  }

  const companyStatusLabels = {
    active: "Ativa",
    onboarding: "Onboarding",
    trial: "Teste",
    suspended: "Suspensa",
    attention: "Atenção",
  };
  const planLabels = {
    enterprise: "Enterprise",
    professional: "Professional",
    starter: "Starter",
    trial: "Teste assistido",
  };
  const hostingModelLabels = {
    "shared-cloud": "ROUTflex Cloud compartilhada",
    "trial-cloud": "ROUTflex Cloud compartilhada",
    "dedicated-cloud": "Instância dedicada",
    "external-database": "Banco externo",
    "on-premises": "On-premises",
  };
  const healthLabels = {
    healthy: "Saudável",
    provisioning: "Provisionando",
    degraded: "Atenção",
    locked: "Atenção",
    maintenance: "Manutenção",
  };
  const userStatusLabels = {
    active: "Ativo",
    invited: "Convite pendente",
    blocked: "Bloqueado",
  };
  const userRoleLabels = {
    company_admin: "Administrador principal",
    operator: "Operador",
    viewer: "Visualizador",
  };
  const twoFactorLabels = {
    enabled: "Ativo",
    pending: "Pendente",
    disabled: "Desabilitado",
  };
  const onboardingStatusLabels = {
    completed: "Concluído",
    in_progress: "Em andamento",
    blocked: "Bloqueado",
    pending: "Planejado",
  };
  const auditActionLabels = {
    "auth.login": "Login administrativo",
    "company.created": "Empresa criada",
    "company.trial_created": "Empresa de teste criada",
    "company.suspended": "Empresa suspensa",
    "company.plan_changed": "Plano alterado",
    "company.plan_updated": "Plano alterado",
    "plan.changed": "Plano alterado",
    "entitlement.activated": "Módulo ativado",
    "entitlement.trial_started": "Período de teste iniciado",
    "entitlement.disabled": "Módulo removido",
    "limit.changed": "Limite alterado",
    "limit.updated": "Limite alterado",
    "company.limit_changed": "Limite alterado",
    "user.invited": "Convite enviado",
    "user.blocked": "Usuário bloqueado",
    "user.module_role_changed": "Permissão individual alterada",
    "onboarding.step_completed": "Etapa de onboarding concluída",
    "environment.degraded": "Ambiente com atenção",
    "environment.provision_requested": "Provisionamento solicitado",
    "sessions.revoked_all": "Sessões encerradas",
    "trial.expiration_warning": "Aviso de vencimento de teste",
    "settings.security_updated": "Configuração crítica alterada",
    "settings.critical_updated": "Configuração crítica alterada",
  };
  const featureLabels = {
    "scenario-planning": "Planejamento de cenários",
    "capacity-forecast": "Previsão de capacidade",
    "route-optimization": "Otimização de rotas",
    "live-dispatch": "Despacho operacional",
    "occurrence-center": "Central de ocorrências",
    "sla-monitoring": "Monitoramento de SLA",
    "mobile-routes": "Rotas em campo",
    "proof-of-delivery": "Comprovante de entrega",
    "offline-mode": "Modo offline",
    "sales-pipeline": "Pipeline comercial",
    "customer-portfolio": "Carteira de clientes",
    "proposal-management": "Gestão de propostas",
  };

  function friendlyCode(value) {
    return String(value || "")
      .split(/[._-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function normalizeSeed(source) {
    const rawEnvironments = source.environments || [];
    const rawCompanies = source.companies || [];
    const moduleNames = (source.catalogs?.modules || []).map(module => typeof module === "string" ? module : module.key);
    const onboardingCatalog = source.catalogs?.onboardingSteps || [];
    const onboardingByKey = new Map(onboardingCatalog.map(step => [step.key, step]));
    const environmentNameById = new Map(rawEnvironments.map(environment => [environment.id, environment.name]));
    const rawCompanyById = new Map(rawCompanies.map(company => [company.id, company]));

    const companies = rawCompanies.map(company => {
      const relatedEnvironment = rawEnvironments.find(environment => environment.companyId === company.id);
      const modules = Object.fromEntries(moduleNames.map(name => {
        const module = company.modules?.[name] || {};
        return [name, {
          active: Boolean(module.active),
          activatedAt: module.activatedAt || null,
          license: module.license === "trial" ? "Teste" : module.active ? "Contratada" : "Contratada",
          features: (module.features || []).map(feature => featureLabels[feature] || friendlyCode(feature)),
          environment: environmentNameById.get(module.environment) || module.environment || "",
          notes: module.active
            ? module.notes || "Sem observações administrativas."
            : "Disponível para configuração neste cenário demonstrativo.",
          trialEndsAt: module.trialEndsAt || null,
        }];
      }));
      return {
        ...company,
        status: companyStatusLabels[company.status] || company.status,
        plan: planLabels[company.plan] || company.plan,
        responsible: company.responsible?.name || company.responsible || "Não definido",
        hosting: {
          ...company.hosting,
          model: hostingModelLabels[company.hosting?.model] || friendlyCode(company.hosting?.model),
          status: healthLabels[company.hosting?.status] || friendlyCode(company.hosting?.status),
          lastSync: relatedEnvironment?.lastHealthCheck || null,
          database: company.hosting?.model === "external-database" ? "Banco externo demonstrativo" : "Dados gerenciados no cenário mock",
          notes: `Configuração declarativa; nenhuma conexão é executada. Backup fictício: ${company.hosting?.backupFrequency || "não definido"}.`,
        },
        modules,
        units: (company.units || []).map(unit => typeof unit === "string" ? unit : `${unit.name} · ${unit.city}/${unit.state}`),
        alerts: (company.alerts || []).map(alert => typeof alert === "string" ? alert : `${alert.title}: ${alert.message}`),
        history: (company.history || []).map(event => ({
          ...event,
          at: event.at || event.date,
          tone: event.tone || event.type || "info",
        })),
      };
    });

    const users = (source.users || []).map(user => ({
      ...user,
      role: userRoleLabels[user.role] || friendlyCode(user.role),
      modules: Array.isArray(user.modules)
        ? user.modules
        : Object.entries(user.modules || {}).filter(([, access]) => access.enabled).map(([name]) => name),
      modulePermissions: Array.isArray(user.modules) ? {} : user.modules,
      status: userStatusLabels[user.status] || friendlyCode(user.status),
      twoFactor: twoFactorLabels[user.twoFactor] || friendlyCode(user.twoFactor),
      inviteOrigin: user.inviteOrigin === "platform_owner" ? "Proprietário da plataforma" : user.inviteOrigin === "company_admin" ? "Administrador da empresa" : friendlyCode(user.inviteOrigin),
      sessionDetails: Array.isArray(user.sessions) ? user.sessions : [],
      sessions: Array.isArray(user.sessions) ? user.sessions.filter(session => session.status === "active").length : Number(user.sessions || 0),
    }));

    const environments = rawEnvironments.map(environment => {
      const company = rawCompanyById.get(environment.companyId);
      const status = healthLabels[environment.status] || friendlyCode(environment.status);
      const hasAttention = !["healthy", "provisioning"].includes(environment.status);
      return {
        ...environment,
        model: hostingModelLabels[company?.hosting?.model] || friendlyCode(company?.hosting?.model),
        status,
        version: environment.version || "Provisionamento pendente",
        lastSync: environment.lastHealthCheck || null,
        lastCheck: environment.lastHealthCheck || null,
        alerts: hasAttention ? [`${status} declarado no conjunto de dados demonstrativo.`] : [],
      };
    });

    const onboardings = (source.onboardings || source.onboarding || []).map(item => {
      const steps = (item.steps || []).map(step => {
        const catalogStep = onboardingByKey.get(step.key) || {};
        const label = catalogStep.label || friendlyCode(step.key);
        const complete = step.complete ?? step.status === "completed";
        const statusDescription = step.status === "blocked"
          ? "Requer atenção antes de avançar."
          : complete ? "Etapa demonstrativa concluída." : "Etapa demonstrativa pendente.";
        return { ...step, label, description: statusDescription, complete };
      });
      const currentStage = steps.find(step => !step.complete)?.label || "Liberação concluída";
      return {
        ...item,
        status: onboardingStatusLabels[item.status] || friendlyCode(item.status),
        owner: source.owner?.name || "Proprietário da plataforma",
        currentStage,
        steps,
      };
    });

    const auditEvents = (source.auditEvents || []).map(event => ({
      ...event,
      at: event.at || event.timestamp,
      actor: event.actor?.name || event.actor || "Sistema Demo",
      action: auditActionLabels[event.action] || friendlyCode(event.action),
      result: event.result === "denied" ? "Negado" : event.result === "success" ? "Concluído" : friendlyCode(event.result),
      severity: event.severity === "critical" ? "Crítica" : event.severity === "warning" ? "Atenção" : "Informativa",
      origin: event.actor?.type === "system" ? "Automação demonstrativa" : "Control Center mock",
    }));

    const notificationViews = {
      "open-company": "companies",
      "open-licenses": "licenses",
      "open-user": "users",
      "open-users": "users",
      "open-environment": "environments",
      "open-onboarding": "onboarding",
      "open-audit": "security",
    };
    const notifications = (source.notifications || []).map(item => ({
      ...item,
      tone: item.tone || (item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "info"),
      description: item.description || item.message,
      at: item.at || item.createdAt,
      view: item.view || notificationViews[item.action] || "security",
    }));

    const activities = (source.activities || []).map(activity => ({
      ...activity,
      tone: activity.tone || activity.type || "info",
      at: activity.at || activity.occurredAt,
    }));

    return {
      ...source,
      meta: { ...source.meta, asOf: source.meta?.generatedAt || source.meta?.referenceDate },
      catalogs: {
        ...source.catalogs,
        modules: moduleNames,
        onboardingSteps: onboardingCatalog.map(step => typeof step === "string" ? step : step.label),
      },
      companies,
      users,
      environments,
      onboardings,
      auditEvents,
      notifications,
      activities,
      settings: {
        controlCenterName: source.settings?.general?.productName || source.settings?.controlCenterName || "ROUTflex Control Center",
        companyNoun: source.settings?.companyNoun || "Empresa",
        requireTwoFactor: source.settings?.security?.requireAdminTwoFactor ?? source.settings?.requireTwoFactor ?? true,
        trialDays: source.settings?.trialDays || 30,
        inviteDays: source.settings?.inviteDays || 5,
        notifyCritical: source.settings?.notifications?.notifyCriticalImmediately ?? source.settings?.notifyCritical ?? true,
        notifyOnboarding: source.settings?.notifications?.notifyOnboardingDelay ?? source.settings?.notifyOnboarding ?? true,
      },
    };
  }

  const seed = normalizeSeed(sourceSeed);

  const cloneSeed = () => JSON.parse(JSON.stringify(seed));
  let data = cloneSeed();

  const accessScreen = document.getElementById("access-screen");
  const controlCenter = document.getElementById("control-center");
  const sidebar = document.getElementById("sidebar");
  const appShell = document.querySelector(".app-shell");
  const drawerOverlay = document.querySelector(".drawer-overlay");
  const mainContent = document.getElementById("main-content");
  const viewRoot = document.getElementById("view-root");
  const currentAreaTitle = document.getElementById("current-area-title");
  const globalSearch = document.getElementById("global-search");
  const globalSearchResults = document.getElementById("global-search-results");
  const notificationPopover = document.getElementById("notification-popover");
  const ownerPopover = document.getElementById("owner-popover");
  const modalLayer = document.getElementById("modal-layer");
  const modal = document.getElementById("modal");
  const modalKicker = document.getElementById("modal-kicker");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.getElementById("modal-footer");
  const toastRegion = document.getElementById("toast-region");

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

  const state = {
    entered: false,
    activeView: "overview",
    selectedCompanyId: null,
    companyTab: "summary",
    sidebarCollapsed: false,
    drawerOpen: false,
    companyFilters: { query: "", status: "all", plan: "all", module: "all", hosting: "all" },
    licenseFilters: { module: "all", missing: false },
    userFilters: { company: "all", role: "all", status: "all", module: "all", twoFactor: "all" },
    environmentFilters: { model: "all", status: "all" },
    auditFilters: { company: "all", actor: "all", action: "all", result: "all", severity: "all", period: "all" },
  };

  let modalContext = null;
  let modalOpener = null;
  let toastTimer = null;

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
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat("pt-BR", includeTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", year: "numeric" }
    ).format(date).replace(" de ", " ");
  }

  function statusBadge(status, label = status) {
    return `<span class="status-badge status-badge--${slug(status)}"><i></i>${escapeHtml(label)}</span>`;
  }

  function moduleBadge(name, active = true, trial = false) {
    const tone = active ? slug(name) : "inactive";
    const suffix = trial ? " · teste" : "";
    return `<span class="module-pill module-pill--${tone}">${escapeHtml(name)}${suffix}</span>`;
  }

  function moduleCatalog() {
    return data.catalogs?.modules || ["Planning", "OPS", "Palm", "Sales"];
  }

  function activeModules(company) {
    return moduleCatalog().filter(name => company.modules?.[name]?.active);
  }

  function companyById(companyId) {
    return data.companies.find(company => company.id === companyId);
  }

  function companyUsers(companyId) {
    return data.users.filter(user => user.companyId === companyId);
  }

  function companyEnvironments(companyId) {
    return data.environments.filter(environment => environment.companyId === companyId);
  }

  function percent(used, contracted) {
    if (!contracted) return 0;
    return Math.max(0, Math.round((used / contracted) * 100));
  }

  function progressTone(value) {
    if (value >= 100) return "danger";
    if (value >= 85) return "warning";
    return "positive";
  }

  function options(values, selected, allLabel = "Todos") {
    const unique = [...new Set(values.filter(Boolean))];
    return [`<option value="all">${escapeHtml(allLabel)}</option>`, ...unique.map(value => (
      `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`
    ))].join("");
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

  function renderOverview() {
    const activeCompanies = data.companies.filter(company => company.status === "Ativa").length;
    const onboardingCompanies = data.companies.filter(company => company.status === "Onboarding").length;
    const trialCompanies = data.companies.filter(company => company.status === "Teste").length;
    const suspendedCompanies = data.companies.filter(company => company.status === "Suspensa").length;
    const activeUsers = data.users.filter(user => user.status === "Ativo").length;
    const activeModuleCount = data.companies.reduce((total, company) => total + activeModules(company).length, 0);
    const attentionEnvironments = data.environments.filter(environment => environment.status !== "Saudável").length;
    const securityAlerts = data.auditEvents.filter(event => event.severity === "Crítica" || event.result === "Negado").length;
    const companyStatusCounts = ["Ativa", "Onboarding", "Teste", "Suspensa", "Atenção"].map(status => ({
      status,
      count: data.companies.filter(company => company.status === status).length,
    }));
    const moduleCounts = moduleCatalog().map(name => ({
      name,
      count: data.companies.filter(company => company.modules?.[name]?.active).length,
    }));
    const maxModuleCount = Math.max(...moduleCounts.map(item => item.count), 1);
    const attentionCompanies = data.companies.filter(company => company.status === "Atenção" || company.status === "Suspensa");

    return `
      ${pageHeader(
        "Comando executivo",
        "Visão geral",
        "Leitura consolidada do ecossistema e das operações administrativas simuladas.",
        `<button class="button button--secondary" type="button" data-action="open-global-invite">Convidar administrador</button>`
      )}

      <section class="metric-grid" aria-label="Indicadores principais">
        ${[
          ["Empresas ativas", activeCompanies, `${data.companies.length} empresas monitoradas`, "positive"],
          ["Em onboarding", onboardingCompanies, "Pipeline administrativo", "info"],
          ["Em período de teste", trialCompanies, "Vencimentos acompanhados", "violet"],
          ["Usuários globais", data.users.length, `${activeUsers} ativos`, "neutral"],
          ["Módulos ativos", activeModuleCount, "Entitlements de empresas", "info"],
          ["Ambientes com atenção", attentionEnvironments, `${securityAlerts} alertas de segurança`, attentionEnvironments ? "warning" : "positive"],
        ].map(([label, value, note, tone]) => `
          <article class="metric-card metric-card--${tone}">
            <span>${label}</span>
            <strong>${value}</strong>
            <small>${note}</small>
          </article>
        `).join("")}
      </section>

      <div class="dashboard-grid dashboard-grid--wide">
        <section class="panel">
          <header class="panel__header"><div><span>Portfólio</span><h2>Empresas por situação</h2></div><button class="text-button" type="button" data-view="companies">Ver empresas</button></header>
          <div class="status-distribution" aria-label="Distribuição de empresas por status">
            <div class="status-distribution__bar">
              ${companyStatusCounts.map(item => `<i class="status-segment status-segment--${slug(item.status)}" style="--segment:${item.count}" title="${escapeHtml(item.status)}: ${item.count}"></i>`).join("")}
            </div>
            <div class="status-distribution__legend">
              ${companyStatusCounts.map(item => `<span><i class="legend-dot legend-dot--${slug(item.status)}"></i>${item.status}<strong>${item.count}</strong></span>`).join("")}
            </div>
          </div>
          <div class="panel-note ${suspendedCompanies ? "panel-note--risk" : ""}">
            <strong>${suspendedCompanies}</strong>
            <span>empresa${suspendedCompanies === 1 ? "" : "s"} suspensa${suspendedCompanies === 1 ? "" : "s"} exige${suspendedCompanies === 1 ? "" : "m"} revisão administrativa.</span>
          </div>
        </section>

        <section class="panel">
          <header class="panel__header"><div><span>Entitlements</span><h2>Distribuição de módulos</h2></div><button class="text-button" type="button" data-view="licenses">Ver licenças</button></header>
          <div class="module-distribution">
            ${moduleCounts.map(item => `
              <div class="distribution-row">
                <span>${moduleBadge(item.name)}</span>
                <div class="progress" aria-label="${item.count} empresas com ${escapeHtml(item.name)}"><i style="width:${(item.count / maxModuleCount) * 100}%"></i></div>
                <strong>${item.count}</strong>
              </div>
            `).join("")}
          </div>
          <p class="semantic-note"><strong>Licença da empresa</strong> define o módulo contratado. Acesso individual é configurado separadamente por usuário.</p>
        </section>
      </div>

      <div class="dashboard-grid dashboard-grid--three">
        <section class="panel">
          <header class="panel__header"><div><span>Onboarding</span><h2>Implantações em andamento</h2></div><button class="text-button" type="button" data-view="onboarding">Abrir pipeline</button></header>
          <div class="compact-list">
            ${data.onboardings.filter(item => item.status !== "Concluído").slice(0, 3).map(item => {
              const company = companyById(item.companyId);
              const complete = item.steps.filter(step => step.complete).length;
              return `<button type="button" data-action="open-onboarding" data-company-id="${item.companyId}"><span><strong>${escapeHtml(company?.name)}</strong><small>${escapeHtml(item.currentStage)}</small></span><b>${complete}/${item.steps.length}</b></button>`;
            }).join("") || `<p class="muted-copy">Nenhum onboarding em andamento.</p>`}
          </div>
        </section>

        <section class="panel">
          <header class="panel__header"><div><span>Prioridades</span><h2>Empresas que exigem atenção</h2></div></header>
          <div class="compact-list">
            ${attentionCompanies.map(company => `<button type="button" data-action="open-company" data-company-id="${company.id}"><span><strong>${escapeHtml(company.name)}</strong><small>${escapeHtml(company.alerts?.[0] || "Revisão administrativa pendente")}</small></span>${statusBadge(company.status)}</button>`).join("") || `<p class="muted-copy">Nenhuma empresa exige atenção imediata.</p>`}
          </div>
        </section>

        <section class="panel">
          <header class="panel__header"><div><span>Infraestrutura</span><h2>Saúde dos ambientes</h2></div><button class="text-button" type="button" data-view="environments">Ver ambientes</button></header>
          <div class="health-summary">
            ${["Saudável", "Atenção", "Provisionando", "Manutenção"].map(status => {
              const count = data.environments.filter(environment => environment.status === status).length;
              return `<div><span>${statusBadge(status)}</span><strong>${count}</strong></div>`;
            }).join("")}
          </div>
        </section>
      </div>

      <div class="dashboard-grid dashboard-grid--wide">
        <section class="panel">
          <header class="panel__header"><div><span>Atividade</span><h2>Movimentações administrativas recentes</h2></div><button class="text-button" type="button" data-view="security">Abrir auditoria</button></header>
          <ol class="activity-list">
            ${data.activities.slice(0, 6).map(activity => `<li><span class="activity-icon activity-icon--${slug(activity.tone)}" aria-hidden="true"></span><div><strong>${escapeHtml(activity.title)}</strong><p>${escapeHtml(activity.description)}</p></div><time>${formatDate(activity.at, true)}</time></li>`).join("")}
          </ol>
        </section>

        <aside class="authority-card">
          <span>ROUTEX Insights</span>
          <h2>Em planejamento</h2>
          <p>Uma futura camada de leitura administrativa, sem interação nesta versão do mock.</p>
          <small>Nenhuma automação está ativa.</small>
        </aside>
      </div>
    `;
  }

  function filteredCompanies() {
    const filters = state.companyFilters;
    const query = filters.query.trim().toLocaleLowerCase("pt-BR");
    return data.companies.filter(company => {
      const matchesQuery = !query || `${company.name} ${company.identifier}`.toLocaleLowerCase("pt-BR").includes(query);
      const matchesStatus = filters.status === "all" || company.status === filters.status;
      const matchesPlan = filters.plan === "all" || company.plan === filters.plan;
      const matchesModule = filters.module === "all" || company.modules?.[filters.module]?.active;
      const matchesHosting = filters.hosting === "all" || company.hosting?.model === filters.hosting;
      return matchesQuery && matchesStatus && matchesPlan && matchesModule && matchesHosting;
    });
  }

  function companiesResultsHtml() {
    const companies = filteredCompanies();
    if (!companies.length) return emptyState("Nenhuma empresa encontrada", "Ajuste a pesquisa ou remova alguns filtros.");
    return `
      <div class="results-meta"><strong>${companies.length}</strong><span>empresa${companies.length === 1 ? "" : "s"} encontrada${companies.length === 1 ? "" : "s"}</span></div>
      <div class="responsive-table">
        <table class="data-table">
          <thead><tr><th>Empresa</th><th>Plano</th><th>Status</th><th>Módulos ativos</th><th>Usuários</th><th>Hospedagem</th><th>Última atividade</th><th><span class="sr-only">Ação</span></th></tr></thead>
          <tbody>
            ${companies.map(company => {
              const users = companyUsers(company.id);
              return `
                <tr>
                  <td data-label="Empresa"><strong>${escapeHtml(company.name)}</strong><small>${escapeHtml(company.identifier)}</small></td>
                  <td data-label="Plano">${escapeHtml(company.plan)}</td>
                  <td data-label="Status">${statusBadge(company.status)}</td>
                  <td data-label="Módulos"><div class="module-pill-row">${activeModules(company).map(name => moduleBadge(name, true, company.modules[name].license === "Teste")).join("") || moduleBadge("Nenhum", false)}</div></td>
                  <td data-label="Usuários">${users.filter(user => user.status === "Ativo").length} de ${company.limits.find(limit => limit.key === "users")?.contracted || users.length}</td>
                  <td data-label="Hospedagem"><span>${escapeHtml(company.hosting?.model)}</span><small>${escapeHtml(company.hosting?.region)}</small></td>
                  <td data-label="Última atividade">${formatDate(company.lastActivity, true)}</td>
                  <td data-label="Ação"><button class="button button--table" type="button" data-action="open-company" data-company-id="${company.id}">Abrir detalhes</button></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCompanies() {
    return `
      ${pageHeader(
        "Gestão de tenants",
        "Empresas",
        "Administre o ciclo demonstrativo das organizações e seus ambientes.",
        `<button class="button button--primary" type="button" data-action="open-global-invite">Convidar administrador</button>`
      )}
      <section class="panel toolbar" aria-label="Filtros de empresas">
        <div class="filter-grid filter-grid--companies">
          <label class="form-field form-field--search"><span>Pesquisar</span><input type="search" data-company-filter="query" value="${escapeHtml(state.companyFilters.query)}" placeholder="Nome ou identificador"></label>
          <label class="form-field"><span>Status</span><select data-company-filter="status">${options(data.companies.map(company => company.status), state.companyFilters.status, "Todos os status")}</select></label>
          <label class="form-field"><span>Plano</span><select data-company-filter="plan">${options(data.companies.map(company => company.plan), state.companyFilters.plan, "Todos os planos")}</select></label>
          <label class="form-field"><span>Módulo</span><select data-company-filter="module">${options(moduleCatalog(), state.companyFilters.module, "Todos os módulos")}</select></label>
          <label class="form-field"><span>Hospedagem</span><select data-company-filter="hosting">${options(data.companies.map(company => company.hosting?.model), state.companyFilters.hosting, "Todos os modelos")}</select></label>
        </div>
      </section>
      <section class="panel table-panel" id="companies-results" aria-label="Lista de empresas">${companiesResultsHtml()}</section>
    `;
  }

  function renderCompanySummary(company) {
    const users = companyUsers(company.id);
    const activeUserCount = users.filter(user => user.status === "Ativo").length;
    const limitsAtRisk = company.limits.filter(limit => percent(limit.used, limit.contracted) >= 85).length;
    return `
      <div class="detail-summary-grid">
        <section class="panel">
          <header class="panel__header"><div><span>Situação geral</span><h2>Visão operacional</h2></div></header>
          <div class="info-grid info-grid--four">
            <div><span>Status</span>${statusBadge(company.status)}</div>
            <div><span>Módulos ativos</span><strong>${activeModules(company).length} de ${moduleCatalog().length}</strong></div>
            <div><span>Usuários</span><strong>${activeUserCount} ativos</strong></div>
            <div><span>Limites em atenção</span><strong>${limitsAtRisk}</strong></div>
          </div>
          <div class="module-overview">
            ${moduleCatalog().map(name => {
              const module = company.modules[name];
              return `<div class="module-overview__item"><span class="module-symbol module-symbol--${slug(name)}">${name.slice(0, 1)}</span><div><strong>${name}</strong><small>${module.active ? module.license : "Não contratado"}</small></div>${statusBadge(module.active ? (module.license === "Teste" ? "Teste" : "Ativo") : "Inativo")}</div>`;
            }).join("")}
          </div>
        </section>

        <section class="panel">
          <header class="panel__header"><div><span>Uso contratado</span><h2>Limites prioritários</h2></div><button class="text-button" type="button" data-company-tab="limits">Ver todos</button></header>
          <div class="limit-list limit-list--compact">
            ${company.limits.slice(0, 5).map(limit => {
              const usage = percent(limit.used, limit.contracted);
              return `<div class="limit-row"><div><span>${escapeHtml(limit.label)}</span><strong>${escapeHtml(limit.used.toLocaleString("pt-BR"))} de ${escapeHtml(limit.contracted.toLocaleString("pt-BR"))} ${escapeHtml(limit.unit || "")}</strong></div><div class="progress progress--${progressTone(usage)}" aria-label="${usage}% utilizado"><i style="width:${Math.min(usage, 100)}%"></i></div><b>${usage}%</b></div>`;
            }).join("")}
          </div>
        </section>
      </div>

      <div class="dashboard-grid dashboard-grid--three">
        <section class="panel">
          <header class="panel__header"><div><span>Usuários</span><h2>Acesso da empresa</h2></div><button class="text-button" type="button" data-company-tab="users">Gerenciar</button></header>
          <div class="key-value-list">
            <div><span>Administrador principal</span><strong>${escapeHtml(users.find(user => user.role.includes("Administrador"))?.name || company.responsible)}</strong></div>
            <div><span>Usuários ativos</span><strong>${activeUserCount}</strong></div>
            <div><span>Convites pendentes</span><strong>${users.filter(user => user.status === "Convite pendente").length}</strong></div>
            <div><span>Usuários bloqueados</span><strong>${users.filter(user => user.status === "Bloqueado").length}</strong></div>
          </div>
        </section>

        <section class="panel">
          <header class="panel__header"><div><span>Unidades</span><h2>Estrutura organizacional</h2></div></header>
          <div class="tag-list">${(company.units || []).map(unit => `<span>${escapeHtml(unit)}</span>`).join("") || `<span>Nenhuma unidade cadastrada</span>`}</div>
          <p class="muted-copy">${company.units?.length || 0} unidade${company.units?.length === 1 ? "" : "s"} no cenário demonstrativo.</p>
        </section>

        <section class="panel">
          <header class="panel__header"><div><span>Alertas</span><h2>Pontos de atenção</h2></div></header>
          <ul class="alert-list">
            ${(company.alerts || []).map(alert => `<li><span aria-hidden="true">!</span>${escapeHtml(alert)}</li>`).join("") || `<li class="alert-list__empty"><span aria-hidden="true">✓</span>Nenhum alerta aberto.</li>`}
          </ul>
        </section>
      </div>

      <section class="panel">
        <header class="panel__header"><div><span>Última atividade</span><h2>Histórico recente</h2></div><button class="text-button" type="button" data-company-tab="history">Histórico completo</button></header>
        <ol class="activity-list activity-list--compact">
          ${(company.history || []).slice(0, 4).map(event => `<li><span class="activity-icon activity-icon--${slug(event.tone || "info")}" aria-hidden="true"></span><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.description)}</p></div><time>${formatDate(event.at, true)}</time></li>`).join("")}
        </ol>
      </section>
    `;
  }

  function renderCompanyModules(company) {
    return `
      <section class="module-grid" aria-label="Módulos da empresa">
        ${moduleCatalog().map(name => {
          const module = company.modules[name];
          return `
            <article class="module-card module-card--${module.active ? "active" : "inactive"}">
              <header><span class="module-symbol module-symbol--${slug(name)}">${name.slice(0, 1)}</span><div><h2>${name}</h2><p>${module.active ? escapeHtml(module.license) : "Não contratado"}</p></div>${statusBadge(module.active ? (module.license === "Teste" ? "Teste" : "Ativo") : "Inativo")}</header>
              <dl>
                <div><dt>Ativação</dt><dd>${module.active ? formatDate(module.activatedAt) : "—"}</dd></div>
                <div><dt>Ambiente</dt><dd>${escapeHtml(module.environment || "Não definido")}</dd></div>
                <div><dt>Vencimento</dt><dd>${module.trialEndsAt ? formatDate(module.trialEndsAt) : "Sem vencimento"}</dd></div>
              </dl>
              <div class="tag-list">${(module.features || []).map(feature => `<span>${escapeHtml(feature)}</span>`).join("") || `<span>Recursos não configurados</span>`}</div>
              <p class="module-card__note">${escapeHtml(module.notes || "Sem observações administrativas.")}</p>
              <button class="button button--secondary" type="button" data-action="edit-module" data-company-id="${company.id}" data-module="${name}">Editar configuração</button>
            </article>
          `;
        }).join("")}
      </section>
      <p class="semantic-note semantic-note--wide"><strong>Conceito:</strong> ativar um módulo para a empresa não concede automaticamente acesso a nenhum usuário. As permissões individuais permanecem na área de usuários.</p>
    `;
  }

  function renderCompanyLimits(company) {
    return `
      <section class="panel">
        <header class="panel__header"><div><span>Capacidade contratada</span><h2>Limites operacionais</h2></div><small>Alterações permanecem somente em memória</small></header>
        <div class="limit-list">
          ${company.limits.map(limit => {
            const usage = percent(limit.used, limit.contracted);
            return `
              <div class="limit-row limit-row--editable">
                <div><span>${escapeHtml(limit.label)}</span><strong>${escapeHtml(limit.used.toLocaleString("pt-BR"))} utilizado de ${escapeHtml(limit.contracted.toLocaleString("pt-BR"))} ${escapeHtml(limit.unit || "")}</strong></div>
                <div class="progress progress--${progressTone(usage)}" aria-label="${usage}% utilizado"><i style="width:${Math.min(usage, 100)}%"></i></div>
                <b>${usage}%</b>
                <span>${statusBadge(usage >= 100 ? "Excedido" : usage >= 85 ? "Atenção" : "Saudável")}</span>
                <button class="button button--table" type="button" data-action="edit-limit" data-company-id="${company.id}" data-limit-key="${limit.key}">Alterar limite</button>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderCompanyUsers(company) {
    const users = companyUsers(company.id);
    return `
      <section class="panel table-panel">
        <header class="panel__header"><div><span>Acessos individuais</span><h2>Usuários da empresa</h2></div><button class="button button--primary" type="button" data-action="invite-admin" data-company-id="${company.id}">Convidar administrador</button></header>
        ${users.length ? `
          <div class="responsive-table">
            <table class="data-table">
              <thead><tr><th>Usuário</th><th>Papel</th><th>Permissões de módulo</th><th>Status</th><th>2FA</th><th>Último acesso</th><th><span class="sr-only">Ação</span></th></tr></thead>
              <tbody>${users.map(user => `
                <tr>
                  <td data-label="Usuário"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></td>
                  <td data-label="Papel">${escapeHtml(user.role)}</td>
                  <td data-label="Permissões"><div class="module-pill-row">${(user.modules || []).map(name => moduleBadge(name)).join("") || moduleBadge("Sem acesso", false)}</div></td>
                  <td data-label="Status">${statusBadge(user.status)}</td>
                  <td data-label="2FA">${statusBadge(user.twoFactor, user.twoFactor)}</td>
                  <td data-label="Último acesso">${formatDate(user.lastAccess, true)}</td>
                  <td data-label="Ação"><button class="button button--table" type="button" data-action="view-user" data-user-id="${user.id}">Ver perfil</button></td>
                </tr>
              `).join("")}</tbody>
            </table>
          </div>
        ` : emptyState("Nenhum usuário", "Convide o primeiro administrador para esta empresa demonstrativa.")}
      </section>
    `;
  }

  function renderCompanyInfrastructure(company) {
    const environments = companyEnvironments(company.id);
    return `
      <section class="panel">
        <header class="panel__header"><div><span>Modelo de hospedagem</span><h2>${escapeHtml(company.hosting.model)}</h2></div>${statusBadge(company.hosting.status)}</header>
        <div class="info-grid info-grid--four">
          <div><span>Região</span><strong>${escapeHtml(company.hosting.region)}</strong></div>
          <div><span>Última sincronização</span><strong>${formatDate(company.hosting.lastSync, true)}</strong></div>
          <div><span>Banco</span><strong>${escapeHtml(company.hosting.database)}</strong></div>
          <div><span>Observação</span><strong>${escapeHtml(company.hosting.notes)}</strong></div>
        </div>
      </section>
      <section class="environment-grid">
        ${environments.map(environment => renderEnvironmentCard(environment)).join("") || emptyState("Nenhum ambiente", "Nenhum ambiente demonstrativo foi vinculado a esta empresa.")}
      </section>
    `;
  }

  function renderCompanyHistory(company) {
    return `
      <section class="panel">
        <header class="panel__header"><div><span>Registro administrativo</span><h2>Histórico da empresa</h2></div><small>Eventos totalmente fictícios</small></header>
        <ol class="timeline-list">
          ${(company.history || []).map(event => `<li><span class="timeline-marker timeline-marker--${slug(event.tone || "info")}"></span><div><time>${formatDate(event.at, true)}</time><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.description)}</p></div></li>`).join("")}
        </ol>
      </section>
    `;
  }

  function renderCompanyDetail() {
    const company = companyById(state.selectedCompanyId);
    if (!company) {
      state.selectedCompanyId = null;
      return renderCompanies();
    }

    const tabs = [
      ["summary", "Resumo"],
      ["modules", "Módulos"],
      ["limits", "Limites"],
      ["users", "Usuários"],
      ["infrastructure", "Infraestrutura"],
      ["history", "Histórico"],
    ];
    const content = {
      summary: renderCompanySummary,
      modules: renderCompanyModules,
      limits: renderCompanyLimits,
      users: renderCompanyUsers,
      infrastructure: renderCompanyInfrastructure,
      history: renderCompanyHistory,
    }[state.companyTab](company);

    return `
      <button class="back-button" type="button" data-action="back-to-companies"><span aria-hidden="true">←</span> Voltar para empresas</button>
      <header class="detail-header">
        <div class="detail-header__identity">
          <span class="company-monogram" aria-hidden="true">${escapeHtml(company.name.split(/\s+/).slice(0, 2).map(word => word[0]).join(""))}</span>
          <div><span class="page-kicker">${escapeHtml(company.identifier)}</span><h1 tabindex="-1">${escapeHtml(company.name)}</h1><div>${statusBadge(company.status)}<span class="detail-plan">Plano ${escapeHtml(company.plan)}</span></div></div>
        </div>
        <div class="detail-header__actions">
          <button class="button button--secondary" type="button" data-action="invite-admin" data-company-id="${company.id}">Convidar administrador</button>
          <button class="button ${company.status === "Suspensa" ? "button--positive" : "button--danger-ghost"}" type="button" data-action="toggle-company-status" data-company-id="${company.id}">${company.status === "Suspensa" ? "Reativar empresa" : "Suspender empresa"}</button>
        </div>
        <dl class="detail-meta">
          <div><dt>Responsável</dt><dd>${escapeHtml(company.responsible)}</dd></div>
          <div><dt>Ambiente</dt><dd>${escapeHtml(company.hosting.model)}</dd></div>
          <div><dt>Data de início</dt><dd>${formatDate(company.startDate)}</dd></div>
          <div><dt>Última atividade</dt><dd>${formatDate(company.lastActivity, true)}</dd></div>
        </dl>
      </header>
      <nav class="detail-tabs" aria-label="Detalhes da empresa">
        ${tabs.map(([id, label]) => `<button type="button" data-company-tab="${id}"${state.companyTab === id ? ' aria-current="page"' : ""}>${label}</button>`).join("")}
      </nav>
      <div class="detail-content">${content}</div>
    `;
  }

  function filteredLicenses() {
    return data.companies.filter(company => {
      const moduleName = state.licenseFilters.module;
      if (moduleName === "all") return true;
      const isActive = Boolean(company.modules?.[moduleName]?.active);
      return state.licenseFilters.missing ? !isActive : isActive;
    });
  }

  function renderLicenses() {
    const companies = filteredLicenses();
    return `
      ${pageHeader("Entitlements globais", "Licenças e módulos", "Controle demonstrativo dos módulos contratados por cada empresa.")}
      <section class="concept-banner">
        <div><span>01</span><strong>Módulo contratado pela empresa</strong><p>Define o entitlement organizacional.</p></div>
        <i aria-hidden="true">≠</i>
        <div><span>02</span><strong>Permissão individual do usuário</strong><p>Define quem pode acessar dentro da empresa.</p></div>
      </section>
      <section class="panel toolbar" aria-label="Filtros de licenças">
        <div class="filter-grid filter-grid--compact">
          <label class="form-field"><span>Módulo</span><select data-license-filter="module">${options(moduleCatalog(), state.licenseFilters.module, "Todos os módulos")}</select></label>
          <label class="check-field"><input type="checkbox" data-license-filter="missing"${state.licenseFilters.missing ? " checked" : ""}><span>Mostrar empresas sem o módulo selecionado</span></label>
        </div>
      </section>
      <section class="panel table-panel">
        ${companies.length ? `
          <div class="responsive-table">
            <table class="data-table entitlement-table">
              <thead><tr><th>Empresa</th>${moduleCatalog().map(name => `<th>${name}</th>`).join("")}<th>Plano</th><th>Status</th><th><span class="sr-only">Ação</span></th></tr></thead>
              <tbody>${companies.map(company => `
                <tr>
                  <td data-label="Empresa"><strong>${escapeHtml(company.name)}</strong><small>${escapeHtml(company.identifier)}</small></td>
                  ${moduleCatalog().map(name => {
                    const module = company.modules[name];
                    return `<td data-label="${name}">${module.active ? statusBadge(module.license === "Teste" ? "Teste" : "Ativo", module.license === "Teste" ? "Teste" : "Contratado") : statusBadge("Inativo", "Não contratado")}</td>`;
                  }).join("")}
                  <td data-label="Plano">${escapeHtml(company.plan)}</td>
                  <td data-label="Status">${statusBadge(company.status)}</td>
                  <td data-label="Ação"><button class="button button--table" type="button" data-action="open-company-tab" data-company-id="${company.id}" data-tab="modules">Configurar</button></td>
                </tr>
              `).join("")}</tbody>
            </table>
          </div>
        ` : emptyState("Nenhum entitlement encontrado", "Altere o filtro de módulo para visualizar outras empresas.")}
      </section>
    `;
  }

  function filteredUsers() {
    const filters = state.userFilters;
    return data.users.filter(user => (
      (filters.company === "all" || user.companyId === filters.company) &&
      (filters.role === "all" || user.role === filters.role) &&
      (filters.status === "all" || user.status === filters.status) &&
      (filters.module === "all" || user.modules?.includes(filters.module)) &&
      (filters.twoFactor === "all" || user.twoFactor === filters.twoFactor)
    ));
  }

  function usersResultsHtml() {
    const users = filteredUsers();
    if (!users.length) return emptyState("Nenhum usuário encontrado", "Ajuste os filtros para ampliar os resultados.");
    return `
      <div class="results-meta"><strong>${users.length}</strong><span>usuário${users.length === 1 ? "" : "s"}</span></div>
      <div class="responsive-table">
        <table class="data-table">
          <thead><tr><th>Usuário</th><th>Empresa</th><th>Papel</th><th>Permissões individuais</th><th>Status</th><th>2FA</th><th>Último acesso</th><th>Origem</th><th><span class="sr-only">Ação</span></th></tr></thead>
          <tbody>${users.map(user => `
            <tr>
              <td data-label="Usuário"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></td>
              <td data-label="Empresa">${escapeHtml(companyById(user.companyId)?.name || "Plataforma")}</td>
              <td data-label="Papel">${escapeHtml(user.role)}</td>
              <td data-label="Permissões"><div class="module-pill-row">${(user.modules || []).map(name => moduleBadge(name)).join("") || moduleBadge("Sem acesso", false)}</div></td>
              <td data-label="Status">${statusBadge(user.status)}</td>
              <td data-label="2FA">${statusBadge(user.twoFactor)}</td>
              <td data-label="Último acesso">${formatDate(user.lastAccess, true)}</td>
              <td data-label="Origem">${escapeHtml(user.inviteOrigin)}</td>
              <td data-label="Ação"><button class="button button--table" type="button" data-action="view-user" data-user-id="${user.id}">Ver perfil</button></td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderUsers() {
    return `
      ${pageHeader("Diretório administrativo", "Usuários globais", "Identidades e permissões individuais em todo o ecossistema demonstrativo.", `<button class="button button--primary" type="button" data-action="open-global-invite">Convidar administrador</button>`)}
      <section class="panel toolbar" aria-label="Filtros de usuários">
        <div class="filter-grid">
          <label class="form-field"><span>Empresa</span><select data-user-filter="company">${companySelectOptions(state.userFilters.company, "Todas as empresas")}</select></label>
          <label class="form-field"><span>Papel</span><select data-user-filter="role">${options(data.users.map(user => user.role), state.userFilters.role, "Todos os papéis")}</select></label>
          <label class="form-field"><span>Status</span><select data-user-filter="status">${options(data.users.map(user => user.status), state.userFilters.status, "Todos os status")}</select></label>
          <label class="form-field"><span>Módulo</span><select data-user-filter="module">${options(moduleCatalog(), state.userFilters.module, "Todos os módulos")}</select></label>
          <label class="form-field"><span>2FA</span><select data-user-filter="twoFactor">${options(data.users.map(user => user.twoFactor), state.userFilters.twoFactor, "Todos os estados")}</select></label>
        </div>
      </section>
      <section class="panel table-panel" id="users-results">${usersResultsHtml()}</section>
      <p class="semantic-note semantic-note--wide"><strong>Suporte assistido:</strong> disponível apenas em arquitetura futura com auditoria obrigatória. Nenhuma impersonação está ativa neste mock.</p>
    `;
  }

  function filteredEnvironments() {
    const filters = state.environmentFilters;
    return data.environments.filter(environment => (
      (filters.model === "all" || environment.model === filters.model) &&
      (filters.status === "all" || environment.status === filters.status)
    ));
  }

  function renderEnvironmentCard(environment) {
    const company = companyById(environment.companyId);
    return `
      <article class="environment-card">
        <header><div><span>${escapeHtml(environment.region)}</span><h2>${escapeHtml(environment.name)}</h2></div>${statusBadge(environment.status)}</header>
        <p>${escapeHtml(company?.name || "Ambiente da plataforma")}</p>
        <dl>
          <div><dt>Modelo</dt><dd>${escapeHtml(environment.model)}</dd></div>
          <div><dt>Módulos</dt><dd>${escapeHtml((environment.modules || []).join(", ") || "Nenhum")}</dd></div>
          <div><dt>Versão</dt><dd>${escapeHtml(environment.version)}</dd></div>
          <div><dt>Sincronização</dt><dd>${formatDate(environment.lastSync, true)}</dd></div>
        </dl>
        <div class="environment-card__footer"><span>${environment.alerts?.length ? `${environment.alerts.length} alerta(s)` : "Sem alertas"}</span><button class="button button--secondary" type="button" data-action="view-environment" data-environment-id="${environment.id}">Ver detalhes</button></div>
      </article>
    `;
  }

  function renderEnvironments() {
    const environments = filteredEnvironments();
    return `
      ${pageHeader("Infraestrutura simulada", "Ambientes", "Visão administrativa dos modelos de hospedagem e sua saúde declarada.")}
      <section class="environment-summary" aria-label="Resumo dos ambientes">
        ${["ROUTflex Cloud compartilhada", "Instância dedicada", "Banco externo", "On-premises"].map(model => `<div><span>${escapeHtml(model)}</span><strong>${data.environments.filter(environment => environment.model === model).length}</strong></div>`).join("")}
      </section>
      <section class="panel toolbar" aria-label="Filtros de ambientes">
        <div class="filter-grid filter-grid--compact">
          <label class="form-field"><span>Modelo</span><select data-environment-filter="model">${options(data.environments.map(environment => environment.model), state.environmentFilters.model, "Todos os modelos")}</select></label>
          <label class="form-field"><span>Status</span><select data-environment-filter="status">${options(data.environments.map(environment => environment.status), state.environmentFilters.status, "Todos os status")}</select></label>
        </div>
      </section>
      <section class="environment-grid">${environments.map(renderEnvironmentCard).join("") || emptyState("Nenhum ambiente encontrado", "Altere os filtros para visualizar outros modelos.")}</section>
      <p class="semantic-note semantic-note--wide"><strong>Ambientes demonstrativos:</strong> nenhuma conexão, sincronização ou verificação real é executada.</p>
    `;
  }

  function renderOnboarding() {
    const stepsCatalog = data.catalogs?.onboardingSteps || [];
    return `
      ${pageHeader("Implantação administrativa", "Onboarding", "Pipeline demonstrativo da contratação até a liberação do ambiente.")}
      <section class="pipeline-legend" aria-label="Etapas do onboarding">
        ${stepsCatalog.map((step, index) => `<span><i>${String(index + 1).padStart(2, "0")}</i>${escapeHtml(step)}</span>`).join("")}
      </section>
      <section class="onboarding-board">
        ${data.onboardings.map(item => {
          const company = companyById(item.companyId);
          const complete = item.steps.filter(step => step.complete).length;
          const completion = Math.round((complete / item.steps.length) * 100);
          return `
            <article class="onboarding-card">
              <header><div><span>${escapeHtml(company?.identifier)}</span><h2>${escapeHtml(company?.name)}</h2></div>${statusBadge(item.status)}</header>
              <div class="onboarding-card__meta"><span>Etapa atual</span><strong>${escapeHtml(item.currentStage)}</strong><small>Responsável: ${escapeHtml(item.owner)}</small></div>
              <div class="progress progress--${item.blocker ? "warning" : "info"}" aria-label="${completion}% concluído"><i style="width:${completion}%"></i></div>
              <div class="onboarding-card__progress"><span>${complete} de ${item.steps.length} etapas</span><strong>${completion}%</strong></div>
              ${item.blocker ? `<p class="onboarding-blocker"><strong>Bloqueio:</strong> ${escapeHtml(item.blocker)}</p>` : ""}
              <button class="button button--secondary" type="button" data-action="open-onboarding" data-company-id="${item.companyId}">Abrir checklist</button>
            </article>
          `;
        }).join("")}
      </section>
    `;
  }

  function filteredAuditEvents() {
    const filters = state.auditFilters;
    const now = new Date(data.meta?.asOf || Date.now());
    return data.auditEvents.filter(event => {
      const eventDate = new Date(event.at);
      const ageDays = Math.floor((now - eventDate) / 86400000);
      const matchesPeriod = filters.period === "all" || ageDays <= Number(filters.period);
      return (
        (filters.company === "all" || event.companyId === filters.company) &&
        (filters.actor === "all" || event.actor === filters.actor) &&
        (filters.action === "all" || event.action === filters.action) &&
        (filters.result === "all" || event.result === filters.result) &&
        (filters.severity === "all" || event.severity === filters.severity) &&
        matchesPeriod
      );
    });
  }

  function renderSecurity() {
    const events = filteredAuditEvents();
    return `
      ${pageHeader("Rastreabilidade", "Segurança e auditoria", "Eventos administrativos fictícios com origem e criticidade declaradas.")}
      <section class="security-summary" aria-label="Resumo de segurança">
        <div><span>Eventos registrados</span><strong>${data.auditEvents.length}</strong></div>
        <div><span>Resultados negados</span><strong>${data.auditEvents.filter(event => event.result === "Negado").length}</strong></div>
        <div><span>Criticidade alta</span><strong>${data.auditEvents.filter(event => event.severity === "Crítica").length}</strong></div>
        <div><span>2FA habilitado</span><strong>${data.users.filter(user => user.twoFactor === "Ativo").length}/${data.users.length}</strong></div>
      </section>
      <section class="panel toolbar" aria-label="Filtros de auditoria">
        <div class="filter-grid filter-grid--audit">
          <label class="form-field"><span>Empresa</span><select data-audit-filter="company">${companySelectOptions(state.auditFilters.company, "Todas as empresas")}</select></label>
          <label class="form-field"><span>Ator</span><select data-audit-filter="actor">${options(data.auditEvents.map(event => event.actor), state.auditFilters.actor, "Todos os usuários")}</select></label>
          <label class="form-field"><span>Ação</span><select data-audit-filter="action">${options(data.auditEvents.map(event => event.action), state.auditFilters.action, "Todas as ações")}</select></label>
          <label class="form-field"><span>Resultado</span><select data-audit-filter="result">${options(data.auditEvents.map(event => event.result), state.auditFilters.result, "Todos os resultados")}</select></label>
          <label class="form-field"><span>Criticidade</span><select data-audit-filter="severity">${options(data.auditEvents.map(event => event.severity), state.auditFilters.severity, "Todas as criticidades")}</select></label>
          <label class="form-field"><span>Período</span><select data-audit-filter="period"><option value="all">Todo o período</option><option value="1"${state.auditFilters.period === "1" ? " selected" : ""}>Últimas 24 horas</option><option value="7"${state.auditFilters.period === "7" ? " selected" : ""}>Últimos 7 dias</option><option value="30"${state.auditFilters.period === "30" ? " selected" : ""}>Últimos 30 dias</option></select></label>
        </div>
      </section>
      <section class="panel table-panel">
        ${events.length ? `
          <div class="responsive-table">
            <table class="data-table audit-table">
              <thead><tr><th>Data e horário</th><th>Ator</th><th>Empresa</th><th>Ação</th><th>Resultado</th><th>Origem</th><th>Criticidade</th></tr></thead>
              <tbody>${events.map(event => `
                <tr>
                  <td data-label="Data">${formatDate(event.at, true)}</td>
                  <td data-label="Ator"><strong>${escapeHtml(event.actor)}</strong></td>
                  <td data-label="Empresa">${escapeHtml(companyById(event.companyId)?.name || "Plataforma")}</td>
                  <td data-label="Ação"><strong>${escapeHtml(event.action)}</strong><small>${escapeHtml(event.description)}</small></td>
                  <td data-label="Resultado">${statusBadge(event.result)}</td>
                  <td data-label="Origem">${escapeHtml(event.origin)}</td>
                  <td data-label="Criticidade">${statusBadge(event.severity)}</td>
                </tr>
              `).join("")}</tbody>
            </table>
          </div>
        ` : emptyState("Nenhum evento encontrado", "Ajuste os filtros de auditoria.")}
      </section>
      <p class="semantic-note semantic-note--wide"><strong>Auditoria demonstrativa:</strong> origens e eventos são fictícios; nenhum IP real é exibido.</p>
    `;
  }

  function renderSettings() {
    return `
      ${pageHeader("Preferências conceituais", "Configurações", "Padrões administrativos do mock, sem segredos ou infraestrutura real.")}
      <form class="settings-form" data-form="settings">
        <section class="setting-section">
          <header><span>Identidade</span><h2>Control Center</h2><p>Como o ambiente administrativo é apresentado.</p></header>
          <div class="setting-fields">
            <label class="form-field"><span>Nome do ambiente</span><input name="controlCenterName" value="${escapeHtml(data.settings.controlCenterName)}"></label>
            <label class="form-field"><span>Nomenclatura de empresa</span><select name="companyNoun"><option${data.settings.companyNoun === "Empresa" ? " selected" : ""}>Empresa</option><option${data.settings.companyNoun === "Organização" ? " selected" : ""}>Organização</option><option${data.settings.companyNoun === "Conta" ? " selected" : ""}>Conta</option></select></label>
          </div>
        </section>

        <section class="setting-section">
          <header><span>Políticas padrão</span><h2>Acesso administrativo</h2><p>Regras conceituais aplicadas a novos cenários.</p></header>
          <div class="setting-fields">
            <label class="setting-toggle"><span><strong>Exigir 2FA</strong><small>Para novos administradores de empresa.</small></span><input type="checkbox" name="requireTwoFactor"${data.settings.requireTwoFactor ? " checked" : ""}><i aria-hidden="true"></i></label>
            <label class="form-field"><span>Duração padrão do teste</span><select name="trialDays"><option value="7"${data.settings.trialDays === 7 ? " selected" : ""}>7 dias</option><option value="14"${data.settings.trialDays === 14 ? " selected" : ""}>14 dias</option><option value="30"${data.settings.trialDays === 30 ? " selected" : ""}>30 dias</option></select></label>
            <label class="form-field"><span>Validade padrão do convite</span><select name="inviteDays"><option value="2"${data.settings.inviteDays === 2 ? " selected" : ""}>2 dias</option><option value="5"${data.settings.inviteDays === 5 ? " selected" : ""}>5 dias</option><option value="7"${data.settings.inviteDays === 7 ? " selected" : ""}>7 dias</option></select></label>
          </div>
        </section>

        <section class="setting-section">
          <header><span>Notificações</span><h2>Preferências do proprietário</h2><p>Alertas exibidos somente nesta execução.</p></header>
          <div class="setting-fields">
            <label class="setting-toggle"><span><strong>Alertas críticos</strong><small>Suspensão, acesso negado e ambiente degradado.</small></span><input type="checkbox" name="notifyCritical"${data.settings.notifyCritical ? " checked" : ""}><i aria-hidden="true"></i></label>
            <label class="setting-toggle"><span><strong>Resumo de onboarding</strong><small>Acompanhamento de etapas pendentes.</small></span><input type="checkbox" name="notifyOnboarding"${data.settings.notifyOnboarding ? " checked" : ""}><i aria-hidden="true"></i></label>
          </div>
        </section>

        <div class="settings-actions"><button class="button button--primary" type="submit">Salvar preferências simuladas</button><span>As alterações serão descartadas ao atualizar a página.</span></div>
      </form>

      <section class="danger-zone">
        <div><span>Dados demonstrativos</span><h2>Resetar Control Center</h2><p>Restaura empresas, usuários, licenças e limites ao estado inicial do mock.</p></div>
        <button class="button button--danger-ghost" type="button" data-action="reset-demo">Resetar demonstração</button>
      </section>

      <section class="restricted-settings">
        <h2>Configurações deliberadamente indisponíveis</h2>
        <div class="tag-list"><span>Segredos</span><span>Tokens</span><span>Banco de dados</span><span>Endpoints</span><span>CORS</span><span>Variáveis de ambiente</span></div>
        <p>Este mock não oferece qualquer acesso a configurações técnicas reais.</p>
      </section>
    `;
  }

  function companySelectOptions(selected, allLabel = null) {
    const all = allLabel === null ? "" : `<option value="all">${escapeHtml(allLabel)}</option>`;
    return all + data.companies.map(company => `<option value="${company.id}"${company.id === selected ? " selected" : ""}>${escapeHtml(company.name)}</option>`).join("");
  }

  function renderView({ focusHeading = false } = {}) {
    closePopovers();
    const renderers = {
      overview: renderOverview,
      companies: state.selectedCompanyId ? renderCompanyDetail : renderCompanies,
      licenses: renderLicenses,
      users: renderUsers,
      environments: renderEnvironments,
      onboarding: renderOnboarding,
      security: renderSecurity,
      settings: renderSettings,
    };
    const title = state.activeView === "companies" && state.selectedCompanyId
      ? companyById(state.selectedCompanyId)?.name || viewLabels.companies
      : viewLabels[state.activeView];
    currentAreaTitle.textContent = title;
    viewRoot.innerHTML = renderers[state.activeView]();
    document.querySelectorAll("[data-view]").forEach(button => {
      if (button.closest(".sidebar-nav")) {
        if (button.dataset.view === state.activeView) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    if (focusHeading) {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => viewRoot.querySelector("h1")?.focus({ preventScroll: true }));
    }
  }

  function openModal({ kicker = "Ação simulada", title, body, footer = "", context = null, size = "medium" }) {
    if (modalLayer.hidden) modalOpener = document.activeElement;
    modalContext = context;
    modalKicker.textContent = kicker;
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalFooter.innerHTML = footer;
    modal.dataset.size = size;
    modalLayer.hidden = false;
    document.body.classList.add("has-modal");
    controlCenter.inert = true;
    requestAnimationFrame(() => {
      const first = modal.querySelector("[autofocus]")
        || modal.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])");
      (first || modal).focus();
    });
  }

  function closeModal({ restoreFocus = true } = {}) {
    if (modalLayer.hidden) return;
    modalLayer.hidden = true;
    document.body.classList.remove("has-modal");
    controlCenter.inert = false;
    modalContext = null;
    modalBody.innerHTML = "";
    modalFooter.innerHTML = "";
    if (restoreFocus && modalOpener?.isConnected) modalOpener.focus();
    modalOpener = null;
  }

  function showToast(title, tone = "success") {
    window.clearTimeout(toastTimer);
    toastRegion.innerHTML = `
      <div class="toast toast--${tone}">
        <span class="toast__icon" aria-hidden="true">${tone === "warning" ? "!" : "✓"}</span>
        <div><strong>${escapeHtml(title)}</strong><p>Simulação concluída — nenhum sistema real foi alterado.</p></div>
        <button type="button" data-action="dismiss-toast" aria-label="Fechar notificação">×</button>
      </div>
    `;
    toastTimer = window.setTimeout(() => { toastRegion.innerHTML = ""; }, 5200);
  }

  function appendAudit({ companyId = null, action, description, result = "Concluído", severity = "Informativa" }) {
    data.auditEvents.unshift({
      id: `AUD-MOCK-${Date.now()}`,
      at: new Date().toISOString(),
      actor: data.owner.name,
      companyId,
      action,
      description,
      result,
      origin: "Control Center mock",
      severity,
    });
  }

  function openCriticalAction({ title, summary, details = [], confirmLabel, onConfirm }) {
    const context = { type: "critical", step: 1, title, summary, details, confirmLabel, onConfirm };
    renderCriticalModal(context);
  }

  function renderCriticalModal(context) {
    const isConfirmation = context.step === 2;
    openModal({
      kicker: isConfirmation ? "Confirmação explícita" : "Resumo da ação crítica",
      title: context.title,
      size: "small",
      context,
      body: isConfirmation ? `
        <div class="confirmation confirmation--critical">
          <span class="confirmation__icon" aria-hidden="true">!</span>
          <h3>Confirme a simulação</h3>
          <p>${escapeHtml(context.summary)}</p>
          <label class="check-field check-field--confirm"><input type="checkbox" data-critical-acknowledgement><span>Entendo que esta ação altera apenas os dados temporários deste mock.</span></label>
        </div>
      ` : `
        <div class="confirmation">
          <span class="confirmation__icon" aria-hidden="true">i</span>
          <h3>Revise o impacto demonstrativo</h3>
          <p>${escapeHtml(context.summary)}</p>
          ${context.details.length ? `<ul>${context.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}
          <small>Nenhum sistema real será acessado ou alterado.</small>
        </div>
      `,
      footer: isConfirmation ? `
        <button class="button button--secondary" type="button" data-action="critical-back">Voltar</button>
        <button class="button button--danger" type="button" data-action="execute-critical" disabled>${escapeHtml(context.confirmLabel)}</button>
      ` : `
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--danger-ghost" type="button" data-action="critical-next">Continuar para confirmação</button>
      `,
    });
  }

  function openInviteModal(preselectedCompanyId = "") {
    openModal({
      kicker: "Convite demonstrativo",
      title: "Convidar administrador",
      context: { type: "invite" },
      body: `
        <form id="invite-admin-form" data-form="invite-admin">
          <div class="form-grid">
            <label class="form-field"><span>Empresa</span><select name="companyId" required autofocus><option value="">Selecione uma empresa</option>${companySelectOptions(preselectedCompanyId)}</select></label>
            <label class="form-field"><span>Nome demonstrativo</span><input name="name" value="Novo Administrador Demo" required maxlength="70"></label>
            <label class="form-field form-field--wide"><span>E-mail fictício</span><input name="email" type="email" value="novo.admin@example.com" required></label>
            <label class="form-field"><span>Papel</span><select name="role"><option>Administrador principal</option><option>Administrador de empresa</option><option>Gestor operacional</option></select></label>
          </div>
          <p class="form-disclaimer">O convite não será enviado. O usuário existirá somente até a página ser atualizada.</p>
        </form>
      `,
      footer: `<button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit" form="invite-admin-form">Simular convite</button>`,
    });
  }

  function openModuleModal(companyId, moduleName) {
    const company = companyById(companyId);
    const module = company?.modules?.[moduleName];
    if (!company || !module) return;
    openModal({
      kicker: "Entitlement da empresa",
      title: `${moduleName} · ${company.name}`,
      size: "medium",
      context: { type: "module", companyId, moduleName },
      body: `
        <form id="module-form" data-form="module">
          <input type="hidden" name="companyId" value="${companyId}">
          <input type="hidden" name="moduleName" value="${moduleName}">
          <div class="module-editor-heading"><span class="module-symbol module-symbol--${slug(moduleName)}">${moduleName.slice(0, 1)}</span><div><strong>${moduleName}</strong><small>${module.active ? "Módulo contratado" : "Módulo não contratado"}</small></div>${statusBadge(module.active ? "Ativo" : "Inativo")}</div>
          <div class="form-grid">
            <label class="setting-toggle form-field--wide"><span><strong>Módulo ativo para a empresa</strong><small>Não concede permissão individual automaticamente.</small></span><input type="checkbox" name="active"${module.active ? " checked" : ""}><i aria-hidden="true"></i></label>
            <label class="form-field"><span>Tipo de licença</span><select name="license"><option${module.license === "Contratada" ? " selected" : ""}>Contratada</option><option${module.license === "Teste" ? " selected" : ""}>Teste</option><option${module.license === "Cortesia" ? " selected" : ""}>Cortesia</option></select></label>
            <label class="form-field"><span>Ambiente</span><select name="environment">${options(data.environments.filter(environment => environment.companyId === companyId).map(environment => environment.name), module.environment, "Selecione")}</select></label>
            <label class="form-field form-field--wide"><span>Observações</span><textarea name="notes" rows="3">${escapeHtml(module.notes)}</textarea></label>
          </div>
        </form>
      `,
      footer: `${module.active && module.license === "Teste" ? `<button class="button button--danger-ghost" type="button" data-action="cancel-trial" data-company-id="${companyId}" data-module="${moduleName}">Cancelar teste</button>` : ""}<button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit" form="module-form">Salvar simulação</button>`,
    });
  }

  function openLimitModal(companyId, limitKey) {
    const company = companyById(companyId);
    const limit = company?.limits.find(item => item.key === limitKey);
    if (!company || !limit) return;
    openModal({
      kicker: "Capacidade contratada",
      title: `Alterar limite · ${limit.label}`,
      size: "small",
      context: { type: "limit", companyId, limitKey },
      body: `
        <form id="limit-form" data-form="limit">
          <input type="hidden" name="companyId" value="${companyId}">
          <input type="hidden" name="limitKey" value="${limitKey}">
          <div class="current-limit"><span>Empresa</span><strong>${escapeHtml(company.name)}</strong><small>Uso atual: ${limit.used.toLocaleString("pt-BR")} de ${limit.contracted.toLocaleString("pt-BR")} ${escapeHtml(limit.unit || "")}</small></div>
          <label class="form-field"><span>Novo limite contratado</span><input type="number" name="contracted" min="0" step="1" value="${limit.contracted}" required autofocus></label>
          <p class="form-disclaimer">Reduções de limite exigem confirmação em duas etapas.</p>
        </form>
      `,
      footer: `<button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit" form="limit-form">Revisar alteração</button>`,
    });
  }

  function openUserModal(userId) {
    const user = data.users.find(item => item.id === userId);
    if (!user) return;
    const company = companyById(user.companyId);
    openModal({
      kicker: "Identidade global",
      title: user.name,
      size: "medium",
      context: { type: "user", userId },
      body: `
        <div class="profile-hero"><span class="owner-avatar">${escapeHtml(user.name.split(/\s+/).slice(0, 2).map(word => word[0]).join(""))}</span><div><strong>${escapeHtml(user.email)}</strong><span>${escapeHtml(company?.name || "Plataforma")}</span></div>${statusBadge(user.status)}</div>
        <div class="info-grid info-grid--three">
          <div><span>Papel</span><strong>${escapeHtml(user.role)}</strong></div>
          <div><span>2FA</span><strong>${escapeHtml(user.twoFactor)}</strong></div>
          <div><span>Último acesso</span><strong>${formatDate(user.lastAccess, true)}</strong></div>
          <div><span>Origem do convite</span><strong>${escapeHtml(user.inviteOrigin)}</strong></div>
          <div><span>Sessões</span><strong>${user.sessions || 0} ativa(s)</strong></div>
          <div><span>Permissões individuais</span><div class="module-pill-row">${(user.modules || []).map(name => moduleBadge(name)).join("") || moduleBadge("Sem acesso", false)}</div></div>
        </div>
        <div class="future-action"><strong>Suporte assistido</strong><span>Disponível apenas em arquitetura futura com auditoria obrigatória.</span><button class="button button--secondary" type="button" disabled>Indisponível</button></div>
      `,
      footer: `
        <button class="button button--secondary" type="button" data-action="close-modal">Fechar</button>
        <button class="button button--secondary" type="button" data-action="view-sessions" data-user-id="${user.id}">Visualizar sessões</button>
        ${user.status === "Convite pendente" ? `<button class="button button--secondary" type="button" data-action="resend-invite" data-user-id="${user.id}">Reenviar convite</button>` : ""}
        <button class="button button--secondary" type="button" data-action="request-reset" data-user-id="${user.id}">Solicitar redefinição</button>
        <button class="button ${user.status === "Bloqueado" ? "button--positive" : "button--danger-ghost"}" type="button" data-action="toggle-user-block" data-user-id="${user.id}">${user.status === "Bloqueado" ? "Desbloquear" : "Bloquear usuário"}</button>
      `,
    });
  }

  function openSessionsModal(userId) {
    const user = data.users.find(item => item.id === userId);
    if (!user) return;
    const sessions = user.sessionDetails || [];
    openModal({
      kicker: "Sessões demonstrativas",
      title: `Sessões · ${user.name}`,
      size: "medium",
      context: { type: "sessions", userId },
      body: sessions.length ? `
        <ol class="activity-list activity-list--compact">
          ${sessions.map(session => `
            <li>
              <span class="activity-icon activity-icon--${session.current ? "positive" : "info"}" aria-hidden="true"></span>
              <div>
                <strong>${escapeHtml(session.device || "Dispositivo demonstrativo")} · ${escapeHtml(session.browser || "Navegador")}</strong>
                <p>${escapeHtml(session.location || "Localização fictícia")} · ${session.current ? "Sessão atual" : "Sessão registrada"}</p>
              </div>
              <time>${formatDate(session.lastSeenAt, true)}</time>
            </li>
          `).join("")}
        </ol>
        <p class="semantic-note"><strong>Somente leitura:</strong> nenhuma sessão real é consultada ou encerrada.</p>
      ` : emptyState("Nenhuma sessão ativa", "Este usuário não possui sessões no cenário demonstrativo."),
      footer: `<button class="button button--secondary" type="button" data-action="view-user" data-user-id="${user.id}">Voltar ao perfil</button><button class="button button--primary" type="button" data-action="close-modal">Concluir leitura</button>`,
    });
  }

  function openEnvironmentModal(environmentId) {
    const environment = data.environments.find(item => item.id === environmentId);
    if (!environment) return;
    const company = companyById(environment.companyId);
    openModal({
      kicker: "Ambiente demonstrativo",
      title: environment.name,
      context: { type: "environment", environmentId },
      body: `
        <div class="profile-hero profile-hero--environment"><span class="environment-glyph" aria-hidden="true">DB</span><div><strong>${escapeHtml(company?.name)}</strong><span>${escapeHtml(environment.model)}</span></div>${statusBadge(environment.status)}</div>
        <div class="info-grid info-grid--three">
          <div><span>Região</span><strong>${escapeHtml(environment.region)}</strong></div>
          <div><span>Versão</span><strong>${escapeHtml(environment.version)}</strong></div>
          <div><span>Última verificação</span><strong>${formatDate(environment.lastCheck, true)}</strong></div>
          <div><span>Sincronização</span><strong>${formatDate(environment.lastSync, true)}</strong></div>
          <div><span>Módulos</span><strong>${escapeHtml((environment.modules || []).join(", "))}</strong></div>
          <div><span>Alertas</span><strong>${environment.alerts?.length || 0}</strong></div>
        </div>
        ${(environment.alerts || []).length ? `<ul class="alert-list">${environment.alerts.map(alert => `<li><span aria-hidden="true">!</span>${escapeHtml(alert)}</li>`).join("")}</ul>` : `<p class="form-disclaimer">Nenhum alerta demonstrativo neste ambiente.</p>`}
        <p class="semantic-note"><strong>Sem conectividade:</strong> esta tela não testa ou acessa nenhum servidor.</p>
      `,
      footer: `<button class="button button--primary" type="button" data-action="close-modal">Concluir leitura</button>`,
    });
  }

  function openOnboardingModal(companyId) {
    const item = data.onboardings.find(onboarding => onboarding.companyId === companyId);
    const company = companyById(companyId);
    if (!item || !company) return;
    openModal({
      kicker: "Checklist demonstrativo",
      title: `Onboarding · ${company.name}`,
      size: "large",
      context: { type: "onboarding", companyId },
      body: `
        <form id="onboarding-form" data-form="onboarding">
          <input type="hidden" name="companyId" value="${companyId}">
          <div class="onboarding-modal-meta"><div><span>Responsável</span><strong>${escapeHtml(item.owner)}</strong></div><div><span>Etapa atual</span><strong>${escapeHtml(item.currentStage)}</strong></div><div><span>Status</span>${statusBadge(item.status)}</div></div>
          <ol class="checklist">
            ${item.steps.map((step, index) => `<li><label><input type="checkbox" name="step-${index}"${step.complete ? " checked" : ""}><span><i>${String(index + 1).padStart(2, "0")}</i><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.description)}</small></span></label></li>`).join("")}
          </ol>
          ${item.blocker ? `<p class="onboarding-blocker"><strong>Bloqueio atual:</strong> ${escapeHtml(item.blocker)}</p>` : ""}
        </form>
      `,
      footer: `<button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit" form="onboarding-form">Salvar checklist</button>`,
    });
  }

  function updateCompaniesResults() {
    const results = document.getElementById("companies-results");
    if (results) results.innerHTML = companiesResultsHtml();
  }

  function updateUsersResults() {
    const results = document.getElementById("users-results");
    if (results) results.innerHTML = usersResultsHtml();
  }

  function updateNotifications() {
    const notifications = data.notifications || [];
    document.getElementById("notification-count").textContent = String(notifications.filter(item => !item.read).length);
    notificationPopover.innerHTML = `
      <header><div><span>Central administrativa</span><strong>Notificações</strong></div><small>${notifications.filter(item => !item.read).length} nova(s)</small></header>
      <div class="popover-list">
        ${notifications.map(item => `<button type="button" data-action="open-notification" data-notification-id="${item.id}"><i class="popover-dot popover-dot--${slug(item.tone)}"></i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span><time>${formatDate(item.at, true)}</time></button>`).join("")}
      </div>
    `;
  }

  function closePopovers() {
    notificationPopover.hidden = true;
    ownerPopover.hidden = true;
    document.querySelectorAll('[data-action="toggle-notifications"], [data-action="toggle-owner-menu"]').forEach(button => button.setAttribute("aria-expanded", "false"));
  }

  function togglePopover(popover, actionName) {
    const shouldOpen = popover.hidden;
    closePopovers();
    popover.hidden = !shouldOpen;
    document.querySelectorAll(`[data-action="${actionName}"]`).forEach(button => button.setAttribute("aria-expanded", String(shouldOpen)));
    if (shouldOpen) requestAnimationFrame(() => popover.querySelector("button")?.focus());
  }

  function openDrawer() {
    state.drawerOpen = true;
    document.body.classList.add("is-drawer-open");
    drawerOverlay.hidden = false;
    appShell.inert = true;
    document.querySelector(".mobile-menu")?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => sidebar.querySelector("button")?.focus());
  }

  function closeDrawer({ restoreFocus = false } = {}) {
    if (!state.drawerOpen) return;
    state.drawerOpen = false;
    document.body.classList.remove("is-drawer-open");
    drawerOverlay.hidden = true;
    appShell.inert = false;
    const trigger = document.querySelector(".mobile-menu");
    trigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger?.focus();
  }

  function enterControlCenter() {
    state.entered = true;
    document.body.classList.remove("is-access-locked");
    accessScreen.classList.add("is-leaving");
    const reveal = () => {
      accessScreen.hidden = true;
      controlCenter.hidden = false;
      controlCenter.classList.add("is-entered");
      renderView();
      window.scrollTo(0, 0);
      mainContent.focus({ preventScroll: true });
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) reveal();
    else window.setTimeout(reveal, 240);
  }

  function navigateTo(view, { focusHeading = true } = {}) {
    if (!viewLabels[view]) return;
    state.activeView = view;
    if (view !== "companies") {
      state.selectedCompanyId = null;
      state.companyTab = "summary";
    }
    closeDrawer();
    renderView({ focusHeading });
  }

  function openCompany(companyId, tab = "summary") {
    if (!companyById(companyId)) return;
    state.activeView = "companies";
    state.selectedCompanyId = companyId;
    state.companyTab = tab;
    closeDrawer();
    renderView({ focusHeading: true });
  }

  function applyCompanyStatus(companyId) {
    const company = companyById(companyId);
    if (!company) return;
    const reactivating = company.status === "Suspensa";
    const nextStatus = reactivating ? (company.previousStatus || "Ativa") : "Suspensa";
    if (!reactivating) company.previousStatus = company.status;
    company.status = nextStatus;
    company.lastActivity = new Date().toISOString();
    company.history.unshift({
      at: new Date().toISOString(),
      title: reactivating ? "Empresa reativada" : "Empresa suspensa",
      description: "Alteração executada somente no estado temporário do mock.",
      tone: reactivating ? "positive" : "danger",
    });
    appendAudit({
      companyId,
      action: reactivating ? "Empresa reativada" : "Empresa suspensa",
      description: `${company.name} teve o status alterado no mock.`,
      severity: reactivating ? "Atenção" : "Crítica",
    });
    closeModal({ restoreFocus: false });
    renderView();
    showToast(reactivating ? "Empresa reativada no mock" : "Empresa suspensa no mock", reactivating ? "success" : "warning");
  }

  function requestCompanyStatusChange(companyId) {
    const company = companyById(companyId);
    if (!company) return;
    const reactivating = company.status === "Suspensa";
    openCriticalAction({
      title: reactivating ? "Reativar empresa" : "Suspender empresa",
      summary: `${reactivating ? "Reativar" : "Suspender"} ${company.name} no estado temporário do Control Center.`,
      details: reactivating
        ? ["A empresa voltará ao status anterior.", "Licenças preservadas serão novamente visíveis."]
        : ["O acesso demonstrativo será marcado como suspenso.", "Licenças e permissões serão preservadas, sem exclusão."],
      confirmLabel: reactivating ? "Confirmar reativação" : "Confirmar suspensão",
      onConfirm: () => applyCompanyStatus(companyId),
    });
  }

  function applyUserBlock(userId) {
    const user = data.users.find(item => item.id === userId);
    if (!user) return;
    const unblocking = user.status === "Bloqueado";
    user.status = unblocking ? "Ativo" : "Bloqueado";
    appendAudit({ companyId: user.companyId, action: unblocking ? "Usuário desbloqueado" : "Usuário bloqueado", description: `${user.name} teve o estado alterado no mock.`, severity: unblocking ? "Atenção" : "Crítica" });
    closeModal({ restoreFocus: false });
    renderView();
    showToast(unblocking ? "Usuário desbloqueado no mock" : "Usuário bloqueado no mock", unblocking ? "success" : "warning");
  }

  function requestUserBlock(userId) {
    const user = data.users.find(item => item.id === userId);
    if (!user) return;
    if (user.status === "Bloqueado") {
      applyUserBlock(userId);
      return;
    }
    openCriticalAction({
      title: "Bloquear usuário global",
      summary: `Bloquear ${user.name} somente no diretório demonstrativo.`,
      details: ["As permissões individuais serão preservadas.", "Nenhuma sessão ou identidade real será acessada."],
      confirmLabel: "Confirmar bloqueio",
      onConfirm: () => applyUserBlock(userId),
    });
  }

  function cancelTrial(companyId, moduleName) {
    const company = companyById(companyId);
    const module = company?.modules?.[moduleName];
    if (!company || !module) return;
    openCriticalAction({
      title: `Cancelar teste de ${moduleName}`,
      summary: `Encerrar o período de teste de ${moduleName} para ${company.name}.`,
      details: ["O módulo ficará inativo apenas no mock.", "Permissões individuais associadas serão preservadas."],
      confirmLabel: "Confirmar cancelamento",
      onConfirm: () => {
        module.active = false;
        module.trialEndsAt = null;
        appendAudit({ companyId, action: "Período de teste cancelado", description: `${moduleName} foi desativado no mock.`, severity: "Crítica" });
        closeModal({ restoreFocus: false });
        renderView();
        showToast("Período de teste cancelado no mock", "warning");
      },
    });
  }

  function resetDemo() {
    openCriticalAction({
      title: "Resetar demonstração",
      summary: "Restaurar todos os dados temporários ao cenário inicial.",
      details: ["Alterações simuladas em empresas, módulos, limites e usuários serão descartadas.", "Arquivos e sistemas reais permanecerão intocados."],
      confirmLabel: "Confirmar reset do mock",
      onConfirm: () => {
        data = cloneSeed();
        state.selectedCompanyId = null;
        state.companyTab = "summary";
        state.companyFilters = { query: "", status: "all", plan: "all", module: "all", hosting: "all" };
        state.licenseFilters = { module: "all", missing: false };
        state.userFilters = { company: "all", role: "all", status: "all", module: "all", twoFactor: "all" };
        state.environmentFilters = { model: "all", status: "all" };
        state.auditFilters = { company: "all", actor: "all", action: "all", result: "all", severity: "all", period: "all" };
        closeModal({ restoreFocus: false });
        updateNotifications();
        renderView();
        showToast("Demonstração restaurada");
      },
    });
  }

  function handleModuleSubmit(form) {
    const formData = new FormData(form);
    const companyId = formData.get("companyId");
    const moduleName = formData.get("moduleName");
    const company = companyById(companyId);
    const module = company?.modules?.[moduleName];
    if (!company || !module) return;
    const desiredActive = formData.has("active");
    const apply = () => {
      const wasActive = module.active;
      module.active = desiredActive;
      module.license = formData.get("license");
      module.environment = formData.get("environment") === "all" ? "" : formData.get("environment");
      module.notes = formData.get("notes").trim();
      if (!wasActive && desiredActive) module.activatedAt = new Date().toISOString();
      if (desiredActive && module.license === "Teste" && !module.trialEndsAt) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + Number(data.settings.trialDays || 14));
        module.trialEndsAt = trialEnd.toISOString();
      }
      if (module.license !== "Teste") module.trialEndsAt = null;
      appendAudit({ companyId, action: desiredActive ? "Módulo configurado" : "Módulo removido", description: `${moduleName} foi ${desiredActive ? "configurado" : "desativado"} para ${company.name}.`, severity: desiredActive ? "Informativa" : "Crítica" });
      closeModal({ restoreFocus: false });
      renderView();
      showToast(desiredActive ? "Configuração de módulo atualizada" : "Módulo removido do mock", desiredActive ? "success" : "warning");
    };
    if (module.active && !desiredActive) {
      const affected = companyUsers(companyId).filter(user => user.modules?.includes(moduleName)).length;
      openCriticalAction({
        title: `Remover ${moduleName}`,
        summary: `Desativar ${moduleName} para ${company.name} somente neste mock.`,
        details: [`${affected} usuário(s) possuem permissão individual associada.`, "Essas permissões serão preservadas, mas ficarão sem entitlement da empresa."],
        confirmLabel: "Confirmar remoção",
        onConfirm: apply,
      });
    } else {
      apply();
    }
  }

  function handleLimitSubmit(form) {
    const formData = new FormData(form);
    const companyId = formData.get("companyId");
    const company = companyById(companyId);
    const limit = company?.limits.find(item => item.key === formData.get("limitKey"));
    const nextValue = Number(formData.get("contracted"));
    if (!company || !limit || !Number.isFinite(nextValue) || nextValue < 0) return;
    const apply = () => {
      const previous = limit.contracted;
      limit.contracted = nextValue;
      appendAudit({ companyId, action: "Limite alterado", description: `${limit.label}: ${previous} → ${nextValue}.`, severity: nextValue < previous ? "Crítica" : "Informativa" });
      closeModal({ restoreFocus: false });
      renderView();
      showToast("Limite atualizado no mock", nextValue < previous ? "warning" : "success");
    };
    if (nextValue < limit.contracted) {
      openCriticalAction({
        title: `Reduzir limite de ${limit.label}`,
        summary: `Reduzir o contratado de ${limit.contracted.toLocaleString("pt-BR")} para ${nextValue.toLocaleString("pt-BR")} ${limit.unit || ""}.`,
        details: [`Uso atual: ${limit.used.toLocaleString("pt-BR")}.`, nextValue < limit.used ? "O novo limite ficará abaixo do uso demonstrativo atual." : "O uso atual permanecerá dentro do novo limite."],
        confirmLabel: "Confirmar redução",
        onConfirm: apply,
      });
    } else {
      apply();
    }
  }

  function handleInviteSubmit(form) {
    const formData = new FormData(form);
    const companyId = formData.get("companyId");
    const company = companyById(companyId);
    if (!company) return;
    const user = {
      id: `USR-MOCK-${Date.now()}`,
      companyId,
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      role: formData.get("role"),
      modules: [],
      status: "Convite pendente",
      twoFactor: "Pendente",
      lastAccess: null,
      inviteOrigin: "Control Center mock",
      sessions: 0,
    };
    data.users.unshift(user);
    appendAudit({ companyId, action: "Convite enviado", description: `Convite demonstrativo criado para ${user.name}.` });
    closeModal({ restoreFocus: false });
    renderView();
    showToast("Convite administrativo criado");
  }

  function handleOnboardingSubmit(form) {
    const formData = new FormData(form);
    const companyId = formData.get("companyId");
    const item = data.onboardings.find(onboarding => onboarding.companyId === companyId);
    if (!item) return;
    item.steps.forEach((step, index) => { step.complete = formData.has(`step-${index}`); });
    const firstPending = item.steps.find(step => !step.complete);
    item.currentStage = firstPending?.label || "Liberação concluída";
    item.status = firstPending ? "Em andamento" : "Concluído";
    appendAudit({ companyId, action: "Checklist de onboarding alterado", description: "Etapas demonstrativas atualizadas." });
    closeModal({ restoreFocus: false });
    renderView();
    showToast("Checklist de onboarding atualizado");
  }

  function handleSettingsSubmit(form) {
    const formData = new FormData(form);
    data.settings.controlCenterName = formData.get("controlCenterName").trim();
    data.settings.companyNoun = formData.get("companyNoun");
    data.settings.requireTwoFactor = formData.has("requireTwoFactor");
    data.settings.trialDays = Number(formData.get("trialDays"));
    data.settings.inviteDays = Number(formData.get("inviteDays"));
    data.settings.notifyCritical = formData.has("notifyCritical");
    data.settings.notifyOnboarding = formData.has("notifyOnboarding");
    appendAudit({ action: "Configuração administrativa alterada", description: "Preferências do mock foram atualizadas." });
    showToast("Preferências do mock salvas");
  }

  function renderGlobalSearchResults(query) {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (normalized.length < 2) {
      globalSearchResults.hidden = true;
      globalSearch.setAttribute("aria-expanded", "false");
      globalSearchResults.innerHTML = "";
      return;
    }
    const companies = data.companies.filter(company => `${company.name} ${company.identifier}`.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 4);
    const users = data.users.filter(user => `${user.name} ${user.email}`.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 4);
    globalSearchResults.innerHTML = `
      ${companies.length ? `<span class="search-group-label">Empresas</span>${companies.map(company => `<button type="button" role="option" data-action="search-company" data-company-id="${company.id}"><span class="company-monogram company-monogram--tiny">${escapeHtml(company.name.slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(company.name)}</strong><small>${escapeHtml(company.identifier)}</small></span></button>`).join("")}` : ""}
      ${users.length ? `<span class="search-group-label">Usuários</span>${users.map(user => `<button type="button" role="option" data-action="search-user" data-user-id="${user.id}"><span class="owner-avatar owner-avatar--tiny">${escapeHtml(user.name.split(/\s+/).slice(0, 2).map(word => word[0]).join(""))}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(companyById(user.companyId)?.name)}</small></span></button>`).join("")}` : ""}
      ${!companies.length && !users.length ? `<p>Nenhum resultado demonstrativo.</p>` : ""}
    `;
    globalSearchResults.hidden = false;
    globalSearch.setAttribute("aria-expanded", "true");
  }

  function handleClick(event) {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      navigateTo(viewButton.dataset.view);
      return;
    }

    const tabButton = event.target.closest("[data-company-tab]");
    if (tabButton && state.selectedCompanyId) {
      state.companyTab = tabButton.dataset.companyTab;
      renderView({ focusHeading: false });
      requestAnimationFrame(() => document.querySelector(`[data-company-tab="${state.companyTab}"]`)?.focus());
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      if (!event.target.closest(".global-search")) {
        globalSearchResults.hidden = true;
        globalSearch.setAttribute("aria-expanded", "false");
      }
      if (!event.target.closest(".topbar-popover, [data-action='toggle-notifications'], [data-action='toggle-owner-menu']")) closePopovers();
      return;
    }

    const action = actionButton.dataset.action;
    switch (action) {
      case "enter-control-center":
        enterControlCenter();
        break;
      case "toggle-sidebar":
        if (window.matchMedia("(max-width: 900px)").matches) {
          closeDrawer({ restoreFocus: true });
        } else {
          state.sidebarCollapsed = !state.sidebarCollapsed;
          controlCenter.classList.toggle("is-sidebar-collapsed", state.sidebarCollapsed);
          actionButton.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
          actionButton.setAttribute("aria-label", state.sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar");
        }
        break;
      case "open-drawer":
        openDrawer();
        break;
      case "close-drawer":
        closeDrawer({ restoreFocus: true });
        break;
      case "toggle-notifications":
        updateNotifications();
        togglePopover(notificationPopover, "toggle-notifications");
        break;
      case "toggle-owner-menu":
        togglePopover(ownerPopover, "toggle-owner-menu");
        break;
      case "open-company":
        openCompany(actionButton.dataset.companyId);
        break;
      case "open-company-tab":
        openCompany(actionButton.dataset.companyId, actionButton.dataset.tab || "summary");
        break;
      case "back-to-companies":
        state.selectedCompanyId = null;
        state.companyTab = "summary";
        renderView({ focusHeading: true });
        break;
      case "open-global-invite":
        openInviteModal();
        break;
      case "invite-admin":
        openInviteModal(actionButton.dataset.companyId);
        break;
      case "edit-module":
        openModuleModal(actionButton.dataset.companyId, actionButton.dataset.module);
        break;
      case "edit-limit":
        openLimitModal(actionButton.dataset.companyId, actionButton.dataset.limitKey);
        break;
      case "view-user":
        openUserModal(actionButton.dataset.userId);
        break;
      case "view-sessions":
        openSessionsModal(actionButton.dataset.userId);
        break;
      case "view-environment":
        openEnvironmentModal(actionButton.dataset.environmentId);
        break;
      case "open-onboarding":
        openOnboardingModal(actionButton.dataset.companyId);
        break;
      case "toggle-company-status":
        requestCompanyStatusChange(actionButton.dataset.companyId);
        break;
      case "toggle-user-block":
        requestUserBlock(actionButton.dataset.userId);
        break;
      case "cancel-trial":
        cancelTrial(actionButton.dataset.companyId, actionButton.dataset.module);
        break;
      case "resend-invite": {
        const user = data.users.find(item => item.id === actionButton.dataset.userId);
        if (!user) break;
        appendAudit({ companyId: user.companyId, action: "Convite reenviado", description: `Reenvio demonstrativo para ${user.name}.` });
        closeModal({ restoreFocus: false });
        showToast("Reenvio de convite simulado");
        break;
      }
      case "request-reset": {
        const user = data.users.find(item => item.id === actionButton.dataset.userId);
        if (!user) break;
        appendAudit({ companyId: user.companyId, action: "Redefinição solicitada", description: `Solicitação demonstrativa para ${user.name}.` });
        closeModal({ restoreFocus: false });
        showToast("Solicitação de redefinição registrada");
        break;
      }
      case "open-notification": {
        const notification = data.notifications.find(item => item.id === actionButton.dataset.notificationId);
        if (!notification) break;
        notification.read = true;
        updateNotifications();
        closePopovers();
        if (notification.companyId) openCompany(notification.companyId);
        else navigateTo(notification.view || "security");
        break;
      }
      case "search-company":
        globalSearch.value = "";
        globalSearchResults.hidden = true;
        globalSearch.setAttribute("aria-expanded", "false");
        openCompany(actionButton.dataset.companyId);
        break;
      case "search-user":
        globalSearch.value = "";
        globalSearchResults.hidden = true;
        globalSearch.setAttribute("aria-expanded", "false");
        navigateTo("users", { focusHeading: false });
        openUserModal(actionButton.dataset.userId);
        break;
      case "reset-demo":
        closePopovers();
        resetDemo();
        break;
      case "critical-next":
        if (modalContext?.type === "critical") {
          modalContext.step = 2;
          renderCriticalModal(modalContext);
        }
        break;
      case "critical-back":
        if (modalContext?.type === "critical") {
          modalContext.step = 1;
          renderCriticalModal(modalContext);
        }
        break;
      case "execute-critical":
        if (modalContext?.type === "critical" && !actionButton.disabled) modalContext.onConfirm();
        break;
      case "close-modal":
        closeModal();
        break;
      case "dismiss-toast":
        window.clearTimeout(toastTimer);
        toastRegion.innerHTML = "";
        break;
      default:
        break;
    }
  }

  function handleInput(event) {
    if (event.target === globalSearch) {
      renderGlobalSearchResults(globalSearch.value);
      return;
    }
    if (event.target.matches("[data-company-filter='query']")) {
      state.companyFilters.query = event.target.value;
      updateCompaniesResults();
    }
  }

  function handleChange(event) {
    const companyFilter = event.target.dataset.companyFilter;
    if (companyFilter) {
      state.companyFilters[companyFilter] = event.target.value;
      updateCompaniesResults();
      return;
    }
    const licenseFilter = event.target.dataset.licenseFilter;
    if (licenseFilter) {
      state.licenseFilters[licenseFilter] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      renderView();
      return;
    }
    const userFilter = event.target.dataset.userFilter;
    if (userFilter) {
      state.userFilters[userFilter] = event.target.value;
      updateUsersResults();
      return;
    }
    const environmentFilter = event.target.dataset.environmentFilter;
    if (environmentFilter) {
      state.environmentFilters[environmentFilter] = event.target.value;
      renderView();
      return;
    }
    const auditFilter = event.target.dataset.auditFilter;
    if (auditFilter) {
      state.auditFilters[auditFilter] = event.target.value;
      renderView();
      return;
    }
    if (event.target.matches("[data-critical-acknowledgement]")) {
      const confirmButton = modalFooter.querySelector('[data-action="execute-critical"]');
      if (confirmButton) confirmButton.disabled = !event.target.checked;
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    const handlers = {
      module: handleModuleSubmit,
      limit: handleLimitSubmit,
      "invite-admin": handleInviteSubmit,
      onboarding: handleOnboardingSubmit,
      settings: handleSettingsSubmit,
    };
    handlers[form.dataset.form]?.(form);
  }

  function trapModalFocus(event) {
    const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      modal.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function trapDrawerFocus(event) {
    const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      if (!modalLayer.hidden) {
        closeModal();
        return;
      }
      if (!globalSearchResults.hidden) {
        globalSearchResults.hidden = true;
        globalSearch.setAttribute("aria-expanded", "false");
        globalSearch.focus();
        return;
      }
      if (!notificationPopover.hidden || !ownerPopover.hidden) {
        closePopovers();
        return;
      }
      if (state.drawerOpen) closeDrawer({ restoreFocus: true });
      return;
    }
    if (event.key === "Tab" && !modalLayer.hidden) trapModalFocus(event);
    else if (event.key === "Tab" && state.drawerOpen) trapDrawerFocus(event);
    if (event.key === "ArrowDown" && document.activeElement === globalSearch && !globalSearchResults.hidden) {
      event.preventDefault();
      globalSearchResults.querySelector("button")?.focus();
    }
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 900px)").matches) closeDrawer();
  });

  updateNotifications();
  renderView();
  document.documentElement.dataset.controlCenterReady = "true";
})();
