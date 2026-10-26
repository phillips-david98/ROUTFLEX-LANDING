(function () {
  'use strict';
  // Presentation only. CORE still owns login, refresh, revocation and identity.
  const endedMessage = 'Sua sessão terminou. Entre novamente.';
  function create({ render, landing = '/', intent = '', onSignedOut }) {
    let phase = 'initializing', revision = 0;
    function set(next, message = '', retry = null) {
      phase = next; revision++; render({ phase, message, retry });
    }
    function navigate(href) {
      if (phase === 'navigating') return;
      set('navigating', 'Continuando…'); window.location.replace(href);
    }
    function entry(ended = false, resume = true) {
      const query = [];
      if (resume && intent) query.push('returnTo=' + encodeURIComponent(intent));
      if (ended) query.push('session=ended');
      navigate(landing + (query.length ? '?' + query.join('&') : ''));
    }
    function invalid(error, wasValid = phase === 'valid') {
      if (error?.presentationReason === 'pagehide') { set('navigating', 'Continuando…'); return; }
      if (phase === 'navigating' || phase === 'logging-out') return;
      if (!error || error.status === 401) { entry(wasValid); return; }
      set('invalid', 'Não foi possível confirmar sua sessão. Tente novamente.', () => window.location.reload());
    }
    async function logout(Core, clear) {
      if (phase === 'logging-out' || phase === 'navigating') return;
      set('logging-out', 'Encerrando sessão…'); clear();
      const attempt = revision;
      try {
        await Core.logout();
        if (attempt === revision) {
          if (onSignedOut) onSignedOut(); else entry(false, false);
        }
      } catch (_) {
        if (attempt === revision) set('invalid', 'O acesso local foi bloqueado. Não foi possível confirmar a saída. Tente sair novamente.', () => logout(Core, clear));
      }
    }
    return { set, navigate, entry, invalid, logout, get phase() { return phase; } };
  }
  function panel() {
    const region = document.getElementById('authTransition');
    const text = document.getElementById('authTransitionMessage');
    const retry = document.getElementById('authTransitionRetry');
    return state => {
      region.hidden = state.phase === 'valid';
      region.dataset.phase = state.phase;
      text.textContent = state.message;
      text.setAttribute('role', state.phase === 'invalid' ? 'alert' : 'status');
      retry.hidden = !state.retry; retry.onclick = state.retry;
    };
  }
  window.RoutflexTransition = Object.freeze({ create, panel, endedMessage });
})();
