/* =============================================================================
   ROUTflex Platform Core — cliente HTTP compartilhado (Workspace + Control Center)
   -----------------------------------------------------------------------------
   - Consome EXCLUSIVAMENTE os contratos aprovados do serviço Core
     (http://localhost:3100/core por padrão; configurável sem alterar contratos).
   - Nenhuma regra de negócio é decidida aqui: este arquivo apenas transporta
     requisições, tokens e mapeia o envelope de erro { error: { code, message } }.
   - Destinos vêm apenas da configuração revisada de implantação.
   - Access fica em memória; reload restaura a sessão pelo cookie HttpOnly no CORE.
   ============================================================================= */
(function initRoutflexCoreClient() {
  "use strict";

  const STORAGE_TOKEN = "routflex.core.accessToken";
  const STORAGE_API_BASE = "routflex.core.apiBase";
  const STORAGE_LOGOUT_PENDING = "routflex.core.logoutPending";
  const STORAGE_MODULE_LINKS = "routflex.workspace.moduleLinks";
  const DEFAULT_API_BASE = "http://localhost:3100/core";
  const STORAGE_SESSION_CHANGED = "routflex.core.sessionChanged";
  const pageUrl = new URL(window.location.href);
  const localPage = ["localhost", "127.0.0.1", "[::1]"].includes(pageUrl.hostname);
  const config = window.RoutflexAuthConfig || {};
  const configuredBase = new URL(config.apiBase || (localPage ? DEFAULT_API_BASE : new URL("/core", pageUrl.origin).href));
  function safeDestination(url) {
    return !url.username && !url.password && !url.search && !url.hash &&
      (url.protocol === "https:" || (localPage && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  }
  if (!safeDestination(configuredBase) || configuredBase.pathname.replace(/\/+$/, "") !== "/core") throw new Error("Invalid CORE deployment configuration");
  const trustedBase = configuredBase.href.replace(/\/+$/, "");

  /* --- Configuração de conexão (deploy), não é regra de negócio --------------- */
  function apiBase() {
    return trustedBase;
  }

  function setApiBase(url) {
    if (String(url).replace(/\/+$/, "") !== trustedBase) throw new CoreApiError({ code: "DEPLOYMENT_CONFIG_LOCKED", status: 400 });
  }

  /* --- Sessão ------------------------------------------------------------------ */
  let accessToken = null;
  // Remove obsolete transport configuration and persisted access from this origin.
  for (const key of [STORAGE_TOKEN, STORAGE_API_BASE, STORAGE_MODULE_LINKS]) {
    for (const storage of ["sessionStorage", "localStorage"]) {
      try { window[storage].removeItem(key); } catch (_) { /* unavailable storage */ }
    }
  }
  function getToken() { return accessToken; }
  let sessionEpoch = 0;
  let refreshInFlight = null;
  let logoutInFlight = null;
  let loggingOut = false;
  let logoutBlocked = false;
  let sessionEndedLocally = false;
  let principal = null;

  function hasPendingLogout() {
    if (logoutBlocked) return true;
    try { if (window.localStorage.getItem(STORAGE_LOGOUT_PENDING) === "1") return true; } catch (_) { /* noop */ }
    try { return window.sessionStorage.getItem(STORAGE_LOGOUT_PENDING) === "1"; } catch (_) { return false; }
  }
  function markPendingLogout() {
    logoutBlocked = true;
    try { window.localStorage.setItem(STORAGE_LOGOUT_PENDING, "1"); } catch (_) { /* noop */ }
    try { window.sessionStorage.setItem(STORAGE_LOGOUT_PENDING, "1"); } catch (_) { /* noop */ }
  }
  function clearPendingLogout() {
    logoutBlocked = false;
    try { window.localStorage.removeItem(STORAGE_LOGOUT_PENDING); } catch (_) { /* noop */ }
    try { window.sessionStorage.removeItem(STORAGE_LOGOUT_PENDING); } catch (_) { /* noop */ }
  }

  function storeToken(token) {
    accessToken = typeof token === "string" && token ? token : null;
  }
  function setToken(token) {
    const replacingSession = Boolean(principal || getToken());
    sessionEpoch += 1;
    principal = null;
    sessionEndedLocally = false;
    storeToken(token);
    try { window.localStorage.setItem(STORAGE_SESSION_CHANGED, `${Date.now()}-${Math.random()}`); } catch (_) { /* hint only */ }
    if (replacingSession) notifyUnauthenticated(sessionEnded("replacement"));
  }
  function clearSession() {
    sessionEpoch += 1;
    principal = null;
    sessionEndedLocally = true;
    storeToken(null);
    try { window.sessionStorage.removeItem("routflex.core.tenantId"); } catch (_) { /* noop */ }
  }

  /* Compatibility queries: the official client never enables demonstration. */
  function demoRequested() {
    return false;
  }
  function demoActive() {
    return false;
  }

  /* --- Erro padronizado ---------------------------------------------------------- */
  class CoreApiError extends Error {
    constructor({ code, message, details, requestId, status }) {
      super(message || code || "Erro na comunicação com o Platform Core.");
      this.name = "CoreApiError";
      this.code = code || "UNKNOWN_ERROR";
      this.details = details || null;
      this.requestId = requestId || null;
      this.status = status || 0;
    }
  }

  const ERROR_MESSAGES = {
    NETWORK_UNREACHABLE: "Não foi possível alcançar o Platform Core. Verifique se o serviço está em execução e se o CORS (CORE_CORS_ORIGINS) inclui esta origem.",
    UNAUTHENTICATED: "Sessão expirada ou inválida. Autentique-se novamente.",
    INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
    USER_NOT_ACTIVE: "Este usuário não está ativo na plataforma.",
    PLATFORM_ROLE_REQUIRED: "Esta área exige papel de plataforma (Platform Owner).",
    MEMBERSHIP_NOT_FOUND: "Vínculo não encontrado para esta organização.",
    TENANT_NOT_ACTIVE: "A organização está suspensa ou indisponível no momento.",
    MEMBERSHIP_NOT_ACTIVE: "Seu vínculo com esta organização está suspenso.",
    PERMISSION_DENIED: "Você não possui permissão para esta ação.",
    SEAT_QUOTA_EXCEEDED: "Limite de licenças atingido para este módulo.",
    SEAT_ALREADY_ASSIGNED: "Este usuário já possui licença deste módulo.",
    INVITATION_ALREADY_PENDING: "Já existe convite pendente para este e-mail.",
    ALREADY_MEMBER: "Este e-mail já é membro da organização.",
    VALIDATION_FAILED: "Dados inválidos. Revise os campos informados.",
    PASSWORD_REQUIRED: "Novo usuário requer senha com no mínimo 12 caracteres.",
    INVITATION_NOT_FOUND: "Convite inválido. Confira o link recebido.",
    INVITATION_NOT_PENDING: "Este convite já foi aceito, revogado ou expirou.",
    INVITATION_EXPIRED: "Este convite expirou. Solicite um novo convite à empresa.",
    CROSS_TENANT_REFERENCE: "Este convite ou recurso não pertence à empresa informada.",
    INVALID_REFRESH_TOKEN: "Sessão expirada. Autentique-se novamente.",
    AUTHENTICATION_SESSION_REVOKED: "Sessão encerrada. Autentique-se novamente.",
    REFRESH_TOKEN_REPLAY_DETECTED: "Sessão encerrada. Autentique-se novamente.",
  };

  function friendlyError(error) {
    if (!(error instanceof CoreApiError)) return "Falha inesperada na comunicação com o Platform Core.";
    return ERROR_MESSAGES[error.code] || error.message || "Erro no Platform Core.";
  }

  /* --- Núcleo de requisições ------------------------------------------------------ */
  const authListeners = new Set();
  function onUnauthenticated(listener) { authListeners.add(listener); return () => authListeners.delete(listener); }

  function notifyUnauthenticated(error) {
    authListeners.forEach((listener) => { try { listener(error); } catch (_) { /* noop */ } });
  }

  function invalidateSession(error) {
    const alreadyEnded = sessionEndedLocally;
    clearSession();
    if (!alreadyEnded) notifyUnauthenticated(error);
  }

  function sessionEnded(presentationReason) {
    const error = new CoreApiError({ code: "UNAUTHENTICATED", message: ERROR_MESSAGES.UNAUTHENTICATED, status: 401 });
    if (presentationReason) error.presentationReason = presentationReason;
    return error;
  }

  // This is a continuity check of a CORE response, never browser authorization.
  // The pin is document-local; persisted token contents/claims are not identity.
  function acceptPrincipal(payload) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const userId = payload?.user?.id;
    const sessionId = payload?.authenticationSessionId;
    if (typeof userId !== "string" || !uuid.test(userId) || payload.user.status !== "ACTIVE"
        || typeof sessionId !== "string" || !uuid.test(sessionId)) {
      const error = new CoreApiError({ code: "IDENTITY_INVALID_RESPONSE", status: 502 });
      invalidateSession(error);
      throw error;
    }
    if (principal && (principal.userId !== userId || principal.sessionId !== sessionId)) {
      const error = sessionEnded();
      invalidateSession(error);
      throw error;
    }
    principal = Object.freeze({ userId, sessionId });
    return payload;
  }

  /* Login, refresh e logout são os únicos requests que transportam o cookie.
     O refresh nunca é lido pelo JavaScript. */
  async function send(path, { method = "GET", body, query, token, cookie = false } = {}) {
    if (typeof path !== "string" || !/^\/(auth|me|catalog|admin|tenants|invitations)(\/|$|\?)/.test(path) || /[\\#]|\.\.|%2e|%2f|%5c/i.test(path)) {
      throw new CoreApiError({ code: "INVALID_API_PATH", status: 400 });
    }
    const url = new URL(apiBase() + path);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
      });
    }

    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        credentials: cookie ? "include" : "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (_) {
      throw new CoreApiError({ code: "NETWORK_UNREACHABLE", message: ERROR_MESSAGES.NETWORK_UNREACHABLE, status: 0 });
    }

    let payload = null;
    const raw = await response.text();
    if (raw) {
      try { payload = JSON.parse(raw); } catch (_) { payload = null; }
    }
    if (!response.ok) {
      const envelope = payload && payload.error ? payload.error : {};
      throw new CoreApiError({
        code: envelope.code || `HTTP_${response.status}`,
        message: envelope.message || response.statusText,
        details: envelope.details,
        requestId: payload ? payload.requestId : null,
        status: response.status,
      });
    }
    return payload;
  }

  async function refreshAccessToken() {
    if (loggingOut || sessionEndedLocally) throw sessionEnded();
    if (hasPendingLogout()) {
      await logout();
      throw sessionEnded();
    }
    if (refreshInFlight) return refreshInFlight;

    const epoch = sessionEpoch;
    const flight = send("/auth/refresh", { method: "POST", cookie: true })
      .then(async (payload) => {
        if (epoch !== sessionEpoch || loggingOut) throw sessionEnded();
        if (!payload || typeof payload.accessToken !== "string" || !payload.accessToken) {
          throw sessionEnded();
        }
        if (principal) {
          const me = await send("/me", { token: payload.accessToken });
          if (epoch !== sessionEpoch || loggingOut || sessionEndedLocally) throw sessionEnded();
          acceptPrincipal(me);
        }
        storeToken(payload.accessToken);
        return payload.accessToken;
      })
      .catch((error) => {
        if (epoch !== sessionEpoch || loggingOut || sessionEndedLocally) throw sessionEnded();
        // Rede/5xx não provam que a sessão foi revogada; preservamos o token
        // para permitir uma nova tentativa quando o CORE voltar.
        if (epoch === sessionEpoch && !loggingOut && error.status >= 400 && error.status < 500) {
          invalidateSession(error);
        }
        throw error;
      })
      .finally(() => { if (refreshInFlight === flight) refreshInFlight = null; });
    refreshInFlight = flight;
    return flight;
  }

  async function logout() {
    if (logoutInFlight) return logoutInFlight;
    loggingOut = true;
    markPendingLogout();
    const flight = (async () => {
      try {
        if (refreshInFlight) {
          try { await refreshInFlight; } catch (_) { /* logout ainda deve ser enviado */ }
        }
        await send("/auth/logout", { method: "POST", cookie: true });
        clearPendingLogout();
      } finally {
        clearSession();
        loggingOut = false;
      }
    })().finally(() => { if (logoutInFlight === flight) logoutInFlight = null; });
    logoutInFlight = flight;
    return flight;
  }

  async function request(path, { method = "GET", body, query, auth = true } = {}) {
    if (!auth) {
      if (path === "/auth/login" && hasPendingLogout()) await logout();
      return send(path, { method, body, query, cookie: path === "/auth/login" });
    }
    if (hasPendingLogout()) {
      await logout();
      throw sessionEnded();
    }
    if (loggingOut || sessionEndedLocally) throw sessionEnded();

    const requestEpoch = sessionEpoch;
    let token = getToken();
    if (!token) token = await refreshAccessToken();
    if (requestEpoch !== sessionEpoch || loggingOut || sessionEndedLocally) throw sessionEnded();
    try {
      const result = await send(path, { method, body, query, token });
      if (requestEpoch !== sessionEpoch || loggingOut || sessionEndedLocally) throw sessionEnded();
      return path === "/me" ? acceptPrincipal(result) : result;
    } catch (error) {
      // Uma falha de refresh ou logout em outra request ja encerrou esta sessao.
      if (requestEpoch !== sessionEpoch || loggingOut || sessionEndedLocally) throw sessionEnded();
      if (error.status !== 401) throw error;
      // Outra request pode ter renovado o token enquanto esta aguardava o 401.
      const current = getToken();
      const nextToken = current && current !== token ? current : await refreshAccessToken();
      if (requestEpoch !== sessionEpoch || loggingOut || sessionEndedLocally) throw sessionEnded();
      try {
        const result = await send(path, { method, body, query, token: nextToken });
        if (requestEpoch !== sessionEpoch || loggingOut || sessionEndedLocally) throw sessionEnded();
        return path === "/me" ? acceptPrincipal(result) : result;
      } catch (retryError) {
        if (requestEpoch !== sessionEpoch || loggingOut || sessionEndedLocally) throw sessionEnded();
        if (retryError.status === 401 && requestEpoch === sessionEpoch && !loggingOut) {
          invalidateSession(retryError);
        }
        throw retryError;
      }
    }
  }

  /* --- Endpoints aprovados (espelho 1:1 do contrato, sem lógica) ------------------- */
  const api = {
    /* públicos */
    login: (email, password) => request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
    logout,
    acceptInvitation: (payload) => request("/invitations/accept", { method: "POST", body: payload, auth: false }),
    previewInvitation: (token, tenantId) => request("/invitations/preview", { method: "POST", body: { token, ...(tenantId ? { tenantId } : {}) }, auth: false }),

    /* autenticado (qualquer usuário) */
    me: () => request("/me"),
    meContext: (tenantId) => request(`/me/context/${tenantId}`),
    catalog: () => request("/catalog"),

    /* plataforma (PLATFORM_OWNER) */
    adminCreateTenant: (payload) => request("/admin/tenants", { method: "POST", body: payload }),
    adminListTenants: (query) => request("/admin/tenants", { query }),
    adminGetTenant: (tenantId) => request(`/admin/tenants/${tenantId}`),
    adminUpdateTenant: (tenantId, payload) => request(`/admin/tenants/${tenantId}`, { method: "PATCH", body: payload }),
    adminActivateTenant: (tenantId) => request(`/admin/tenants/${tenantId}/activate`, { method: "POST", body: {} }),
    adminDesignateOwner: (tenantId, email) => request(`/admin/tenants/${tenantId}/owner`, { method: "POST", body: { email } }),
    adminTenantRoles: (tenantId) => request(`/admin/tenants/${tenantId}/roles`),
    adminTenantMemberships: (tenantId) => request(`/admin/tenants/${tenantId}/memberships`),
    adminTenantInvitations: (tenantId) => request(`/admin/tenants/${tenantId}/invitations`),
    adminRevokeInvitation: (tenantId, invitationId) => request(`/admin/tenants/${tenantId}/invitations/${invitationId}/revoke`, { method: "POST", body: {} }),
    adminSuspendTenant: (tenantId, reason) => request(`/admin/tenants/${tenantId}/suspend`, { method: "POST", body: { reason } }),
    adminReactivateTenant: (tenantId) => request(`/admin/tenants/${tenantId}/reactivate`, { method: "POST", body: {} }),
    adminListEntitlements: (tenantId) => request(`/admin/tenants/${tenantId}/entitlements`),
    adminGrantEntitlement: (tenantId, moduleKey, payload) => request(`/admin/tenants/${tenantId}/entitlements/${moduleKey}`, { method: "POST", body: payload }),
    adminSuspendEntitlement: (tenantId, moduleKey, reason) => request(`/admin/tenants/${tenantId}/entitlements/${moduleKey}/suspend`, { method: "POST", body: { reason } }),
    adminCancelEntitlement: (tenantId, moduleKey, payload) => request(`/admin/tenants/${tenantId}/entitlements/${moduleKey}/cancel`, { method: "POST", body: payload || {} }),
    adminCreateInvitation: (tenantId, payload) => request(`/admin/tenants/${tenantId}/invitations`, { method: "POST", body: payload }),
    adminListAudit: (query) => request("/admin/audit-logs", { query }),

    /* escopo do tenant (permissões resolvidas no servidor) */
    tenantGet: (tenantId) => request(`/tenants/${tenantId}`),
    tenantMemberships: (tenantId, query) => request(`/tenants/${tenantId}/memberships`, { query }),
    tenantSuspendMember: (tenantId, membershipId, reason) => request(`/tenants/${tenantId}/memberships/${membershipId}/suspend`, { method: "POST", body: { reason } }),
    tenantReactivateMember: (tenantId, membershipId) => request(`/tenants/${tenantId}/memberships/${membershipId}/reactivate`, { method: "POST", body: {} }),
    tenantRoles: (tenantId) => request(`/tenants/${tenantId}/roles`),
    tenantGrantRole: (tenantId, membershipId, roleId) => request(`/tenants/${tenantId}/memberships/${membershipId}/roles`, { method: "POST", body: { roleId } }),
    tenantRevokeRole: (tenantId, membershipId, roleId) => request(`/tenants/${tenantId}/memberships/${membershipId}/roles/${roleId}`, { method: "DELETE" }),
    tenantEntitlements: (tenantId) => request(`/tenants/${tenantId}/entitlements`),
    tenantSeats: (tenantId) => request(`/tenants/${tenantId}/seats`),
    tenantAssignSeat: (tenantId, membershipId, payload) => request(`/tenants/${tenantId}/memberships/${membershipId}/seats`, { method: "POST", body: payload }),
    tenantReleaseSeat: (tenantId, membershipId, seatAssignmentId) => request(`/tenants/${tenantId}/memberships/${membershipId}/seats/${seatAssignmentId}`, { method: "DELETE" }),
    tenantUnits: (tenantId, query) => request(`/tenants/${tenantId}/units`, { query }),
    tenantInvitations: (tenantId, query) => request(`/tenants/${tenantId}/invitations`, { query }),
    tenantCreateInvitation: (tenantId, payload) => request(`/tenants/${tenantId}/invitations`, { method: "POST", body: payload }),
    tenantRevokeInvitation: (tenantId, invitationId) => request(`/tenants/${tenantId}/invitations/${invitationId}/revoke`, { method: "POST", body: {} }),
    tenantAudit: (tenantId, query) => request(`/tenants/${tenantId}/audit-logs`, { query }),
  };

  /* --- Rótulos oficiais (tradução visual dos enums do contrato — sem regra) -------- */
  const LABELS = {
    tenantStatus: {
      PROVISIONING: "Provisionando",
      TRIAL: "Trial",
      ACTIVE: "Ativa",
      SUSPENDED: "Suspensa",
      CANCELLED: "Cancelada",
    },
    entitlementState: {
      NOT_CONTRACTED: "Não contratado",
      TRIAL: "Trial",
      ACTIVE: "Ativo",
      SUSPENDED: "Suspenso",
      EXPIRED: "Expirado",
      CANCELLED: "Cancelado",
    },
    membershipStatus: {
      INVITED: "Convidado",
      ACTIVE: "Ativo",
      SUSPENDED: "Suspenso",
      REMOVED: "Removido",
    },
    invitationStatus: {
      PENDING: "Pendente",
      ACCEPTED: "Aceito",
      EXPIRED: "Expirado",
      REVOKED: "Revogado",
    },
    seatState: {
      RESERVED: "Reservada",
      ACTIVE: "Ativa",
      RELEASED: "Liberada",
    },
    seatType: {
      OPERATOR_SEAT: "Licença de operador",
      FIELD_SEAT: "Licença de campo",
      MANAGER_SEAT: "Licença de gestão",
      VIEWER_SEAT: "Licença de leitura",
      DEVICE_LICENSE: "Licença de dispositivo",
      INTEGRATION_LICENSE: "Licença de integração",
    },
    platformRole: {
      PLATFORM_OWNER: "Proprietário da plataforma",
      PLATFORM_SUPPORT: "Suporte da plataforma",
    },
  };

  /* Metadados visuais dos módulos (identidade), URLs de acesso são configuração local */
  const MODULE_META = {
    planning: { short: "P", iconClass: "planning", fallbackName: "ROUTflex Planning" },
    ops: { short: "O", iconClass: "ops", fallbackName: "ROUTflex OPS" },
    palm: { short: "Pa", iconClass: "palm", fallbackName: "ROUTflex Palm" },
    sales: { short: "S", iconClass: "sales", fallbackName: "ROUTflex Sales" },
  };

  const trustedLinks = Object.freeze(Object.fromEntries(Object.keys(MODULE_META).map((key) => {
    const value = config.moduleLinks?.[key];
    if (!value) return [key, null];
    const url = new URL(value, pageUrl.origin);
    if (!safeDestination(url)) throw new Error("Invalid module deployment configuration");
    return [key, url.href];
  })));

  function moduleLinks() {
    return { ...trustedLinks };
  }

  // Server revalidation, never JWT decoding or locally inferred authorization.
  function watchSession(onValidated = () => {}) {
    let flight = null;
    async function check() {
      if (!principal || flight || window.document?.visibilityState === "hidden") return;
      const epoch = sessionEpoch;
      flight = (async () => {
        try {
          const me = await api.me();
          if (epoch === sessionEpoch) await onValidated(me);
        } catch (error) {
          if (epoch === sessionEpoch) invalidateSession(error);
        } finally { flight = null; }
      })();
      return flight;
    }
    const timer = window.setInterval?.(check, 30000);
    window.addEventListener?.("focus", check);
    window.document?.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval?.(timer);
      window.removeEventListener?.("focus", check);
      window.document?.removeEventListener("visibilitychange", check);
    };
  }
  window.addEventListener?.("storage", (event) => {
    if ((event.key === STORAGE_LOGOUT_PENDING && event.newValue === "1") || (event.key === STORAGE_SESSION_CHANGED && event.newValue)) invalidateSession(sessionEnded());
  });
  window.addEventListener?.("pagehide", () => invalidateSession(sessionEnded("pagehide")));
  window.addEventListener?.("pageshow", (event) => { if (event.persisted) window.location.reload(); });

  function invitationUrl(token, tenantId) {
    const root = new URL(window.location.href);
    root.pathname = root.pathname.replace(/(?:control-center\/[^/]*|[^/]*)$/, "invitation.html");
    root.search = "";
    root.hash = new URLSearchParams({ token, ...(tenantId ? { tenantId } : {}) }).toString();
    return root.toString();
  }

  window.RoutflexCore = {
    api,
    request,
    CoreApiError,
    friendlyError,
    LABELS,
    MODULE_META,
    moduleLinks,
    invitationUrl,
    apiBase,
    setApiBase,
    getToken,
    setToken,
    clearSession,
    refreshAccessToken,
    logout,
    onUnauthenticated,
    watchSession,
    demoRequested,
    demoActive,
  };
})();
