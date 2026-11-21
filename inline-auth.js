(function () {
  'use strict';
  const Core = window.RoutflexCore, Resolver = window.RoutflexDestination;
  const $ = id => document.getElementById(id);
  const form = $('inlineLoginForm'), error = $('inlineLoginError'), status = $('inlineLoginStatus');
  const signed = $('inlineSession'), choices = $('inlineOrganizations');
  let generation = 0, pending = false, current = null, settingToken = false;
  const query = new URLSearchParams(window.location.search);
  const endedNotice = query.getAll('session').length === 1 && query.get('session') === 'ended';
  // Presentation hint only; it grants no access and never selects a destination.
  const returnTo = endedNotice ? null : Resolver.intent(window.location.search);
  if (query.has('session')) { query.delete('session'); window.history.replaceState(null, '', window.location.pathname + (query.size ? '?' + query : '') + window.location.hash); }
  function message(text = '', failure = false) {
    error.hidden = !failure; error.textContent = failure ? text : '';
    status.textContent = failure ? '' : text;
    if (failure) error.focus({ preventScroll: true });
  }
  function busy(value) {
    pending = value; form.setAttribute('aria-busy', String(value));
    $('inlineLoginSubmit').disabled = value;
    $('inlineModeAdmin').disabled = value; $('inlineModeField').disabled = value;
    $('inlineContinue').disabled = value; $('inlineLogout').disabled = value;
  }
  function setPasswordVisibility(visible) {
    $('inlinePassword').type = visible ? 'text' : 'password';
    const label = visible ? 'Ocultar senha' : 'Mostrar senha';
    $('inlineShowPassword').setAttribute('aria-label', label);
    $('inlineShowPassword').setAttribute('title', label);
    $('inlineShowPassword').setAttribute('aria-pressed', String(visible));
  }
  function clear(text = '') {
    generation++; current = null; choices.replaceChildren(); $('inlineIdentity').textContent = '';
    $('inlinePassword').value = ''; setPasswordVisibility(false);
    transition.set('invalid', text);
  }
  let accessMode = returnTo === '/palm' ? 'field' : 'admin';
  function setMode(mode) {
    accessMode = mode === 'field' ? 'field' : 'admin';
    $('acesso').dataset.accessMode = accessMode;
    $('inlineModeAdmin').setAttribute('aria-pressed', String(accessMode === 'admin'));
    $('inlineModeField').setAttribute('aria-pressed', String(accessMode === 'field'));
    $('inlineAccessTitle').textContent = accessMode === 'field' ? 'Pronto para ir a campo.' : 'Sua operação, conectada.';
    $('inlineAccessDescription').textContent = accessMode === 'field' ? 'Entre no PALM para acompanhar suas execuções liberadas.' : 'Gestão, planejamento e equipes em um só lugar.';
    $('inlineLoginSubmit').textContent = accessMode === 'field' ? 'Entrar para operar' : 'Entrar na plataforma';
  }
  $('inlineModeAdmin').addEventListener('click', () => { if (!pending) setMode('admin'); });
  $('inlineModeField').addEventListener('click', () => { if (!pending) setMode('field'); });
  setMode(accessMode);
  const transition = window.RoutflexTransition.create({ onSignedOut() {
    $('inlineEmail').value = ''; clear('Você saiu da conta. Entre com suas credenciais.');
    $('inlinePassword').removeAttribute('aria-invalid');
  }, render(state) {
    $('acesso').dataset.phase = state.phase;
    $('acesso').setAttribute('aria-busy', String(!['valid', 'invalid'].includes(state.phase)));
    form.hidden = state.phase !== 'invalid' || Boolean(state.retry);
    signed.hidden = state.phase !== 'valid';
    busy(!['valid', 'invalid'].includes(state.phase));
    $('inlineRetry').hidden = !state.retry; $('inlineRetry').onclick = state.retry;
    message(state.message, state.phase === 'invalid' && Boolean(state.retry));
  } });
  function go(result) {
    if (!result.href) return;
    if (result.tenantId) { try { window.sessionStorage.setItem('routflex.core.tenantId', result.tenantId); } catch (_) {} }
    transition.navigate(result.href);
  }
  function render(result) {
    current = result; choices.replaceChildren(); transition.set('valid');
    $('inlineIdentity').textContent = result.me.user.fullName;
    $('inlineContinue').hidden = !result.href;
    if (result.kind === 'blocked') message('Sua conta está autenticada, mas não há acesso disponível. Procure o administrador da sua organização.', true);
    else if (result.kind === 'choose') {
      message('Selecione sua organização para continuar.');
      for (const choice of result.choices) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'inline-organization';
        button.textContent = choice.name; button.addEventListener('click', () => route(true, choice.id)); choices.append(button);
      }
    } else message('Sessão ativa. Seu acesso está pronto.');
  }
  function failureText(failure) {
    if (failure.code === 'INVALID_CREDENTIALS') return 'E-mail ou senha inválidos.';
    if (failure.status === 401) return window.RoutflexTransition.endedMessage;
    if (failure.status === 403) return 'O acesso não foi autorizado. Procure o administrador.';
    return 'Não foi possível confirmar seu acesso. Tente novamente em instantes.';
  }
  async function route(navigate, selectedTenantId) {
    const attempt = ++generation; transition.set('initializing', 'Confirmando seu acesso…');
    try {
      // The explicit access mode selects intent; CORE still decides access.
      const intent = accessMode === 'field' ? '/palm' : returnTo === '/palm' ? '/workspace.html' : returnTo;
      const result = await Resolver.resolve(Core, { selectedTenantId, returnTo: intent });
      if (attempt !== generation) return;
      if (navigate && result.href) go(result); else render(result);
    } catch (failure) { if (attempt === generation) { clear(); message(failureText(failure), true); } }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (pending || !form.reportValidity()) return;
    const email = $('inlineEmail').value.trim(), password = $('inlinePassword').value;
    $('inlinePassword').value = ''; const attempt = ++generation; transition.set('initializing', 'Autenticando…');
    try {
      const session = await Core.api.login(email, password);
      if (attempt !== generation) return;
      settingToken = true;
      try { Core.setToken(session.accessToken); } finally { settingToken = false; }
      await route(true);
    } catch (failure) { if (attempt === generation) { clear(); message(failureText(failure), true); $('inlinePassword').setAttribute('aria-invalid', 'true'); } }
  });
  $('inlinePassword').addEventListener('input', () => $('inlinePassword').removeAttribute('aria-invalid'));
  $('inlineShowPassword').addEventListener('click', () => {
    setPasswordVisibility($('inlinePassword').type === 'password');
  });
  $('inlineContinue').addEventListener('click', () => { if (!pending) return route(true, current?.tenantId); });
  $('inlineLogout').addEventListener('click', () => transition.logout(Core, () => {
    generation++; current = null; choices.replaceChildren(); $('inlineIdentity').textContent = '';
  }));
  Core.onUnauthenticated(failure => {
    if (settingToken) return;
    if (failure?.presentationReason === 'pagehide') { generation++; current = null; transition.set('navigating', 'Continuando…'); return; }
    if (transition.phase === 'logging-out' || transition.phase === 'navigating') return;
    const hadIdentity = Boolean(current); clear(endedNotice || hadIdentity ? window.RoutflexTransition.endedMessage : '');
    if (failure && failure.status !== 401) message(failureText(failure), true);
  });
  Core.watchSession(async () => { if (current && !pending) await route(false, current.tenantId); });
  // Restore through the existing HttpOnly refresh cookie; a normal institutional visit stays here.
  (async () => {
    const attempt = ++generation; transition.set('initializing', 'Verificando sessão…');
    try {
      const result = await Resolver.resolve(Core, { returnTo }); if (attempt !== generation) return;
      if (returnTo && result.href) go(result); else render(result);
    } catch (failure) { if (attempt === generation) { clear(endedNotice ? window.RoutflexTransition.endedMessage : ''); if (failure.status !== 401) message(failureText(failure), true); } }
  })();
})();
