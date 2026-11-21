(function () {
  'use strict';
  const page = new URL(window.location.href);
  if (window.RoutflexAuthConfig?.recoveryEnabled !== true ||
      page.protocol !== 'http:' || page.port !== '5500' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(page.hostname)) return;

  const $ = id => document.getElementById(id);
  const card = $('acesso'), opener = $('inlineForgotPassword'), loginForm = $('inlineLoginForm');
  const host = card.closest('.hero-login');
  const views = document.createElement('div'), login = document.createElement('div'), panel = document.createElement('section');
  views.className = 'recovery-views'; login.className = 'recovery-panel'; panel.className = 'recovery-panel';
  panel.id = 'inlineRecovery'; panel.hidden = true; panel.setAttribute('aria-labelledby', 'recoveryTitle');
  // Move, never recreate, the original nodes: all existing login handlers survive.
  login.append(...card.childNodes); views.append(login, panel); card.append(views);
  const eye = $('inlineShowPassword').innerHTML;
  panel.innerHTML = `
    <div id="recoveryContent" class="recovery-content">
    <div class="recovery-heading"><span class="recovery-eyebrow">RECUPERAÇÃO</span><span id="recoveryProgress" class="recovery-progress"></span></div>
    <h2 id="recoveryTitle" class="recovery-title" tabindex="-1"></h2>
    <p id="recoveryDescription" class="recovery-description"></p>
    <p id="recoveryStatus" class="recovery-status" role="status" aria-live="polite"></p>
    <form id="recoveryEmailForm" data-recovery-view="email" autocomplete="off" novalidate hidden>
      <label for="recoveryEmail">E-mail usado para entrar</label>
      <input id="recoveryEmail" type="email" required maxlength="254" autocomplete="off" placeholder="voce@empresa.com.br" aria-describedby="recoveryError">
      <button class="hero-login-submit" type="submit" data-idle="Enviar código">Enviar código</button>
      <div class="recovery-actions"><button class="recovery-link" type="button" data-recovery-close>Voltar ao login</button></div>
    </form>
    <form id="recoveryOtpForm" data-recovery-view="otp" autocomplete="off" novalidate hidden>
      <fieldset class="recovery-otp" id="recoveryDigits"><legend>Código de seis dígitos</legend>
        ${Array.from({ length: 6 }, (_, i) => `<input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Dígito ${i + 1} de 6" aria-describedby="recoveryError" style="--digit:${i}">`).join('')}
      </fieldset>
      <button class="hero-login-submit" type="submit" data-idle="Verificar código">Verificar código</button>
      <div class="recovery-actions"><button id="recoveryResend" class="recovery-link" type="button">Reenviar código</button><button class="recovery-link" type="button" data-recovery-back>Alterar e-mail</button><button class="recovery-link" type="button" data-recovery-close>Voltar</button></div>
    </form>
    <form id="recoveryPasswordForm" data-recovery-view="password" autocomplete="off" novalidate hidden>
      <label for="recoveryPassword">Nova senha</label>
      <div class="inline-password"><input id="recoveryPassword" type="password" required autocomplete="off" aria-describedby="recoveryMatch recoveryError"><button class="inline-password-toggle" type="button" data-password-toggle="recoveryPassword" aria-label="Mostrar nova senha" title="Mostrar nova senha" aria-controls="recoveryPassword" aria-pressed="false">${eye}</button></div>
      <label for="recoveryConfirmation">Confirmar nova senha</label>
      <div class="inline-password"><input id="recoveryConfirmation" type="password" required autocomplete="off" aria-describedby="recoveryMatch recoveryError"><button class="inline-password-toggle" type="button" data-password-toggle="recoveryConfirmation" aria-label="Mostrar confirmação" title="Mostrar confirmação" aria-controls="recoveryConfirmation" aria-pressed="false">${eye}</button></div>
      <p id="recoveryMatch" class="recovery-match" role="status" aria-live="polite">Repita a senha para conferir.</p>
      <button class="hero-login-submit" type="submit" data-idle="Confirmar nova senha">Confirmar nova senha</button>
      <div class="recovery-actions"><button class="recovery-link" type="button" data-recovery-back>Voltar ao código</button><button class="recovery-link" type="button" data-recovery-close>Voltar ao login</button></div>
    </form>
    <div data-recovery-view="complete" hidden>
      <div class="recovery-success" aria-hidden="true"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="33"/><path fill="none" stroke-linecap="round" stroke-linejoin="round" d="m24 40 11 11 21-23"/></svg></div>
      <button class="hero-login-submit" type="button" data-recovery-close>Voltar ao login</button>
    </div>
    <p id="recoveryError" class="inline-auth-error recovery-error" role="alert" hidden></p>
    </div>
    <p class="recovery-dev">O código é enviado somente ao contato de recuperação verificado. Sua senha de acesso vale para todas as suas empresas.</p>`;

  const adapter = window.RoutflexRecovery.createAdapter({ apiBase: window.RoutflexAuthConfig.apiBase });
  const digits = [...$('recoveryDigits').querySelectorAll('input')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let displayed = 'login', requested = 'login', transitionId = 0, ticker = null, pinnedWidth = 0;
  let heightAnimation = null;
  const headings = {
    email: ['Recuperar acesso.', 'Informe o e-mail que identifica sua conta ROUTflex.', '1 de 3'],
    otp: ['Verificar código.', '', '2 de 3'],
    password: ['Criar nova senha.', 'Use uma frase-senha com pelo menos 15 caracteres. As sessões anteriores serão encerradas.', '3 de 3'],
    complete: ['Senha alterada.', 'Entre novamente com sua nova senha para continuar.', 'CONCLUÍDO'],
  };
  function focus(node) { node.focus({ preventScroll: true }); }
  function clearDigits() { for (const input of digits) { input.value = ''; input.dataset.filled = 'false'; input.removeAttribute('aria-invalid'); } }
  function clearPasswords() {
    for (const input of [$('recoveryPassword'), $('recoveryConfirmation')]) { input.value = ''; input.type = 'password'; input.removeAttribute('aria-invalid'); }
    for (const button of panel.querySelectorAll('[data-password-toggle]')) {
      const label = button.dataset.passwordToggle === 'recoveryPassword' ? 'Mostrar nova senha' : 'Mostrar confirmação';
      button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', label); button.title = label;
    }
    $('recoveryMatch').textContent = 'Repita a senha para conferir.'; delete $('recoveryMatch').dataset.matches;
  }
  function animateHeight(from, to) {
    heightAnimation?.cancel();
    if (!reduced.matches && Math.abs(from - to) > 1) {
      heightAnimation = views.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }
  function pinHost() {
    const hidden = login.hidden;
    login.hidden = false; login.style.cssText = 'position:absolute;visibility:hidden;width:100%';
    const height = login.getBoundingClientRect().height;
    host.style.height = (height + card.offsetHeight - views.offsetHeight) + 'px';
    card.style.setProperty('--recovery-max-height', height + 'px');
    login.style.cssText = ''; login.hidden = hidden;
    host.classList.add('recovery-host'); pinnedWidth = card.offsetWidth;
  }
  function cooldown() {
    const remaining = adapter.remaining(), busy = flow.state.busy;
    $('recoveryResend').textContent = remaining ? `Reenviar em ${remaining}s` : 'Reenviar código';
    $('recoveryResend').disabled = busy || remaining > 0;
  }
  function feedback(state) {
    panel.setAttribute('aria-busy', String(state.busy));
    $('recoveryError').hidden = !state.error; $('recoveryError').textContent = state.error;
    const loading = { send: 'Solicitando código…', resend: 'Solicitando novo código…', verify: 'Verificando código…', save: 'Alterando senha…' };
    $('recoveryStatus').textContent = state.busy ? loading[state.operation]
      : state.notice;
    $('recoveryStatus').dataset.verified = String(state.step === 'password' && !state.busy && Boolean(state.notice));
    for (const button of panel.querySelectorAll('button')) {
      button.disabled = state.busy && !button.hasAttribute('data-recovery-close') && !button.hasAttribute('data-recovery-back');
      if (button.dataset.idle) button.textContent = state.busy ? 'Aguarde…' : button.dataset.idle;
    }
    for (const input of panel.querySelectorAll('input')) input.disabled = state.busy;
    $('recoveryDigits').dataset.verifying = String(state.operation === 'verify' && state.busy);
    $('recoveryDigits').dataset.error = String(state.step === 'otp' && Boolean(state.error));
    for (const input of digits) input.setAttribute('aria-invalid', String(state.step === 'otp' && Boolean(state.error)));
    $('recoveryEmail').setAttribute('aria-invalid', String(state.step === 'email' && Boolean(state.error)));
    cooldown();
    if (state.busy && state.step === 'password') clearPasswords();
  }
  async function switchStep(step) {
    requested = step;
    const attempt = ++transitionId, outgoing = displayed === 'login' ? login : panel;
    const from = views.getBoundingClientRect().height;
    if (displayed === 'login' && step !== 'login') pinHost();
    outgoing.inert = true;
    if (!reduced.matches) {
      await outgoing.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 120 }).finished;
    }
    if (attempt !== transitionId) return;
    const state = flow.state;
    displayed = step; card.dataset.recoveryStep = step;
    login.hidden = step !== 'login'; panel.hidden = step === 'login';
    login.inert = step !== 'login'; panel.inert = step === 'login';
    for (const view of panel.querySelectorAll('[data-recovery-view]')) view.hidden = view.dataset.recoveryView !== step;
    clearPasswords();
    clearDigits();
    $('recoveryContent').scrollTop = 0;
    if (step === 'login') {
      $('recoveryEmail').value = '';
      $('recoveryError').textContent = ''; $('recoveryStatus').textContent = '';
      clearInterval(ticker); ticker = null;
    } else {
      const [title, description, progress] = headings[step];
      $('recoveryTitle').textContent = title; $('recoveryProgress').textContent = progress;
      if (step === 'otp') {
        const recipient = document.createElement('span');
        recipient.className = 'recovery-recipient'; recipient.textContent = state.email; recipient.title = state.email;
        $('recoveryDescription').replaceChildren('Solicitação para a conta:', recipient);
      } else $('recoveryDescription').textContent = description;
      if (step === 'email') $('recoveryEmail').value = state.email;
      if (!ticker) ticker = setInterval(cooldown, 1000);
      feedback(state);
    }
    const incoming = step === 'login' ? login : panel;
    animateHeight(from, incoming.getBoundingClientRect().height);
    if (step === 'login') {
      const release = () => {
        if (attempt === transitionId && flow.state.step === 'login') { host.style.height = ''; host.classList.remove('recovery-host'); }
      };
      if (heightAnimation?.playState === 'running') heightAnimation.finished.then(release, () => {});
      else release();
    }
    incoming.classList.remove('recovery-enter');
    if (!reduced.matches) {
      void incoming.offsetWidth; incoming.classList.add('recovery-enter');
      incoming.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, easing: 'ease-out' });
    }
    focus(step === 'login' ? opener : $('recoveryTitle'));
  }
  function render(state) {
    if (state.step !== requested) { void switchStep(state.step); return; }
    if (displayed !== state.step) return;
    const from = views.getBoundingClientRect().height;
    const wasBusy = panel.getAttribute('aria-busy') === 'true';
    feedback(state);
    animateHeight(from, (displayed === 'login' ? login : panel).getBoundingClientRect().height);
    if (wasBusy && !state.busy && state.error) {
      focus(state.step === 'otp' ? digits[0] : state.step === 'email' ? $('recoveryEmail') : $('recoveryConfirmation'));
    }
  }
  const flow = window.RoutflexRecovery.createFlow(adapter, render);
  function syncLogin() {
    const available = card.dataset.phase === 'invalid' && !loginForm.hidden && $('inlineRetry').hidden;
    opener.hidden = !available;
    if (!available && flow.state.step !== 'login') flow.close();
  }
  new MutationObserver(syncLogin).observe(card, { attributes: true, attributeFilter: ['data-phase'] });
  new ResizeObserver(() => { if (displayed !== 'login' && pinnedWidth !== card.offsetWidth) pinHost(); }).observe(card);
  syncLogin();
  opener.addEventListener('click', () => { if (!opener.hidden) flow.open(); });
  panel.querySelectorAll('[data-recovery-close]').forEach(button => button.addEventListener('click', () => flow.close()));
  panel.querySelectorAll('[data-recovery-back]').forEach(button => button.addEventListener('click', () => flow.back()));
  $('recoveryEmailForm').addEventListener('submit', event => {
    event.preventDefault(); void flow.send($('recoveryEmail').value);
    if (flow.state.error) focus($('recoveryEmail'));
  });
  $('recoveryEmail').addEventListener('input', () => flow.clearError());
  function fillCode(value, start = 0) {
    const numbers = value.replace(/\D/g, '').slice(0, 6 - start);
    for (let i = 0; i < numbers.length; i++) { digits[start + i].value = numbers[i]; digits[start + i].dataset.filled = 'true'; }
    focus(digits[Math.min(start + numbers.length, 5)]);
  }
  digits.forEach((input, index) => {
    input.addEventListener('input', () => {
      flow.clearError();
      const value = input.value.replace(/\D/g, '');
      input.value = value.slice(0, 1); input.dataset.filled = String(Boolean(input.value));
      input.removeAttribute('aria-invalid'); $('recoveryDigits').dataset.error = 'false';
      if (value.length > 1) fillCode(value, value.length >= 6 ? 0 : index);
      else if (input.value && index < 5) focus(digits[index + 1]);
    });
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace') {
        event.preventDefault();
        const target = input.value || index === 0 ? input : digits[index - 1];
        target.value = ''; target.dataset.filled = 'false'; focus(target);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); focus(digits[Math.max(0, Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1)))]);
      }
    });
    input.addEventListener('paste', event => {
      event.preventDefault();
      flow.clearError();
      const text = event.clipboardData.getData('text');
      const numbers = text.replace(/\D/g, '');
      if (numbers.length >= 6) { clearDigits(); fillCode(numbers); } else fillCode(numbers, index);
    });
  });
  $('recoveryOtpForm').addEventListener('submit', event => {
    event.preventDefault(); void flow.verify(digits.map(input => input.value).join(''));
    if (flow.state.error) focus(digits.find(input => !input.value) || digits[0]);
  });
  $('recoveryResend').addEventListener('click', async () => { if (await flow.resend()) { clearDigits(); focus(digits[0]); } });
  function matchPasswords() {
    flow.clearError();
    const password = $('recoveryPassword').value, confirmation = $('recoveryConfirmation').value;
    const matches = Boolean(password) && password === confirmation;
    $('recoveryMatch').textContent = confirmation ? matches ? 'As senhas correspondem.' : 'As senhas ainda não correspondem.' : 'Repita a senha para conferir.';
    if (confirmation) $('recoveryMatch').dataset.matches = String(matches); else delete $('recoveryMatch').dataset.matches;
    $('recoveryConfirmation').setAttribute('aria-invalid', String(Boolean(confirmation) && !matches));
  }
  [$('recoveryPassword'), $('recoveryConfirmation')].forEach(input => input.addEventListener('input', matchPasswords));
  panel.querySelectorAll('[data-password-toggle]').forEach(button => button.addEventListener('click', () => {
    const input = $(button.dataset.passwordToggle), visible = input.type === 'password';
    input.type = visible ? 'text' : 'password'; button.setAttribute('aria-pressed', String(visible));
    const label = `${visible ? 'Ocultar' : 'Mostrar'} ${input.id === 'recoveryPassword' ? 'nova senha' : 'confirmação'}`;
    button.setAttribute('aria-label', label); button.title = label;
  }));
  $('recoveryPasswordForm').addEventListener('submit', event => {
    event.preventDefault(); void flow.save($('recoveryPassword').value, $('recoveryConfirmation').value);
    if (flow.state.error) focus($('recoveryConfirmation'));
  });
  window.addEventListener('pagehide', () => { flow.close(); clearPasswords(); clearDigits(); $('recoveryEmail').value = ''; });
  reduced.addEventListener('change', () => { if (reduced.matches) heightAnimation?.cancel(); });
})();
