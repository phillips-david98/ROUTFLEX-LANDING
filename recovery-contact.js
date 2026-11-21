(function () {
  'use strict';
  const Core = window.RoutflexCore;
  if (!Core) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'recovery-contact-dialog';
  dialog.setAttribute('aria-labelledby', 'recoveryContactTitle');
  dialog.innerHTML = `<form novalidate><h2 id="recoveryContactTitle">Contato de recuperação</h2><p data-description></p>
    <div data-fields><label>E-mail pessoal para recuperação<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
    <label>Confirme sua senha atual<input name="password" type="password" autocomplete="current-password" required></label></div>
    <label data-code hidden>Código recebido por e-mail<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label>
    <p role="status" aria-live="polite" data-status></p><footer><button type="button" data-close>Fechar</button><button type="submit">Enviar verificação</button></footer></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'), fields = dialog.querySelector('[data-fields]');
  const emailField = form.elements.email, emailLabel = emailField.closest('label');
  const codeField = dialog.querySelector('[data-code]'), status = dialog.querySelector('[data-status]');
  const description = dialog.querySelector('[data-description]'), submit = dialog.querySelector('[type=submit]');
  let epoch = 0, challenge = '', identity = null, target = null, busy = false, opener;
  let controller = null, validationTimer = null, validationPending = false;
  let configuredRecipient = false, contactRequestAttempted = false;
  const identityKey = me => me?.user?.id && me?.authenticationSessionId ? me.user.id + ':' + me.authenticationSessionId : null;
  const pageValid = () => !document.getElementById('authTransition') || document.getElementById('authTransition').dataset.phase === 'valid';
  const active = stamp => stamp === epoch && dialog.open && pageValid() && controller && !controller.signal.aborted;
  function clear() {
    epoch++; controller?.abort(); controller = null;
    window.clearInterval(validationTimer); validationTimer = null; validationPending = false;
    challenge = ''; identity = null; target = null; busy = false;
    configuredRecipient = false; contactRequestAttempted = false;
    emailLabel.hidden = false; emailField.disabled = false; emailField.required = true;
    form.reset(); status.textContent = ''; submit.hidden = false; submit.disabled = true;
  }
  function close(restoreFocus = false) {
    clear(); if (dialog.open) dialog.close();
    const previousOpener = opener; opener = null;
    if (restoreFocus && pageValid()) previousOpener?.focus();
  }
  dialog.querySelector('[data-close]').addEventListener('click', () => close(true));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(true); });
  dialog.addEventListener('close', () => { if (!dialog.open) clear(); });
  Core.onUnauthenticated?.(() => close());
  document.addEventListener('routflex:protected-context-cleared', () => close());
  window.addEventListener('pagehide', () => close());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') close(); });
  async function current(stamp) {
    if (!active(stamp) || !identity) throw Error('SESSION_CHANGED');
    try {
      const me = await Core.api.me({ signal: controller.signal });
      if (!active(stamp)) throw Error('SESSION_CHANGED');
      if (identityKey(me) !== identity) throw Error('SESSION_CHANGED');
    } catch (error) {
      if (stamp === epoch) close();
      throw error;
    }
  }
  async function validateOpenDialog() {
    if (!dialog.open || !identity || validationPending) return;
    const stamp = epoch; validationPending = true;
    try { await current(stamp); } catch (_) { /* current closes and clears immediately. */ }
    finally { if (stamp === epoch) validationPending = false; }
  }
  window.addEventListener('focus', validateOpenDialog);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-recovery-contact], [data-recovery-member]');
    if (!button || !pageValid()) return;
    event.preventDefault(); clear(); opener = button;
    controller = new AbortController();
    const stamp = epoch;
    target = button.dataset.recoveryMember ? { tenant: button.dataset.recoveryTenant, member: button.dataset.recoveryMember, platform: button.dataset.recoveryPlatform === 'true' } : null;
    fields.hidden = Boolean(target); codeField.hidden = true;
    submit.textContent = target ? 'Enviar instruções' : 'Enviar verificação'; submit.disabled = true;
    description.textContent = target ? 'As instruções serão enviadas somente ao contato verificado do usuário. Você não receberá a senha ou o código dele.'
      : 'Este contato será usado apenas para recuperar sua senha. Seu login, perfil e vínculos com empresas permanecem iguais. Confirme a senha atual e depois o código recebido.';
    dialog.showModal();
    try {
      const me = await Core.api.me({ signal: controller.signal }); if (!active(stamp)) return;
      identity = identityKey(me); if (!identity) throw Error('SESSION_REQUIRED');
      if (!target) {
        const result = await Core.api.recoveryContactStatus({ signal: controller.signal }); if (!active(stamp)) return;
        configuredRecipient = result.configuredRecipient === true;
        emailLabel.hidden = configuredRecipient; emailField.disabled = configuredRecipient; emailField.required = !configuredRecipient;
        if (configuredRecipient) description.textContent += ' Será usado o contato aprovado para esta operação. Mantenha esta página visível ao consultar o código.';
        status.textContent = result.verified ? 'Já existe um contato verificado. Uma substituição exige nova verificação.' : 'Nenhum contato verificado cadastrado.';
      }
      submit.disabled = false; (target ? submit : configuredRecipient ? form.elements.password : emailField).focus();
      // Remote revocation has no push channel. Poll only while this sensitive form is open.
      validationTimer = window.setInterval(validateOpenDialog, 5000);
    } catch { if (stamp === epoch) status.textContent = 'Recuperação indisponível. Verifique a configuração do serviço e sua sessão.'; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || submit.disabled || !active(epoch) || !identity) return;
    if (configuredRecipient && contactRequestAttempted && !challenge) return;
    if (!target && !challenge && !form.reportValidity()) return;
    if (challenge && !/^\d{6}$/.test(form.elements.code.value)) { status.textContent = 'Preencha o código de seis dígitos.'; return; }
    busy = true; submit.disabled = true; status.textContent = 'Aguarde…'; const stamp = epoch;
    try {
      await current(stamp);
      if (target) {
        await (target.platform ? Core.api.adminInitiateRecovery : Core.api.tenantInitiateRecovery)(target.tenant, target.member, { signal: controller.signal });
        await current(stamp); status.textContent = 'Se a conta estiver apta, as instruções serão enviadas ao contato de recuperação verificado.'; submit.hidden = true;
      } else if (!challenge) {
        contactRequestAttempted = configuredRecipient;
        const pending = Core.api.recoveryContactRequest(configuredRecipient ? undefined : emailField.value.trim(), form.elements.password.value, { signal: controller.signal });
        form.elements.password.value = ''; form.elements.email.value = '';
        let result;
        try { result = await pending; }
        catch (error) {
          // The restricted endpoint rejects an incorrect current password with
          // 403 before reserving or sending. An ambiguous outcome stays blocked.
          if (stamp === epoch && error.status === 403) contactRequestAttempted = false;
          throw error;
        }
        await current(stamp);
        if (!result.accepted || !/^[A-Za-z0-9_-]{43}$/.test(result.challengeId)) throw Error('INVALID_RESPONSE');
        challenge = result.challengeId; fields.hidden = true; codeField.hidden = false;
        status.textContent = 'Informe o código enviado ao novo contato. Ele expira em 10 minutos.';
        submit.textContent = 'Verificar contato'; form.elements.code.focus();
      } else {
        const pending = Core.api.recoveryContactVerify(challenge, form.elements.code.value, { signal: controller.signal });
        form.elements.code.value = '';
        const result = await pending;
        await current(stamp); if (result.verified !== true) throw Error('INVALID_RESPONSE');
        challenge = ''; form.reset(); codeField.hidden = true; submit.hidden = true;
        status.textContent = 'Contato verificado e vinculado à sua identidade. Seu login e perfil foram preservados.';
      }
    } catch { if (stamp === epoch) status.textContent = configuredRecipient && contactRequestAttempted && !challenge
      ? 'Não foi possível confirmar a solicitação. Novos envios estão bloqueados nesta janela. Aguarde orientação.'
      : 'Não foi possível concluir. Confira a senha atual ou o código, sua sessão e a disponibilidade do serviço.'; }
    finally { if (stamp === epoch) { busy = false; submit.disabled = configuredRecipient && contactRequestAttempted && !challenge; form.elements.password.value = ''; } }
  });
})();
