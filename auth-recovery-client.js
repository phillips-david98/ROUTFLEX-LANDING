(function (root) {
  'use strict';
  class RecoveryError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const validEmail = email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
  function createAdapter({ apiBase, fetchImpl = (...args) => fetch(...args), now = () => Date.now() } = {}) {
    const url = new URL(apiBase);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/core' ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '3100'))) {
      throw new RecoveryError('CONFIG', 'Recuperação indisponível.');
    }
    let challengeId = '', resetToken = '', resendAt = 0, controller = null, generation = 0;
    async function call(action, body) {
      const stamp = generation, abort = new AbortController(); controller = abort;
      const timeout = setTimeout(() => abort.abort(), 10000);
      try {
        const response = await fetchImpl(url.href + '/auth/recovery/' + action, {
          method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal,
        });
        if (stamp !== generation) throw new RecoveryError('CANCELLED', 'Solicitação cancelada.');
        if (!response.ok) {
          const message = response.status === 503 ? 'Recuperação indisponível neste ambiente. Tente novamente após a configuração do serviço.'
            : response.status === 429 ? 'Aguarde antes de tentar novamente.'
              : action === 'complete' ? 'Não foi possível alterar a senha. Confira a frase-senha ou solicite um novo código.'
                : 'Código ou solicitação inválida, expirada ou já utilizada. Solicite um novo código.';
          throw new RecoveryError(response.status === 503 ? 'UNAVAILABLE' : 'CODE', message);
        }
        const payload = await response.json();
        if (stamp !== generation) throw new RecoveryError('CANCELLED', 'Solicitação cancelada.');
        return payload;
      } catch (error) {
        if (error instanceof RecoveryError) throw error;
        throw new RecoveryError('NETWORK', 'Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.');
      } finally { clearTimeout(timeout); if (controller === abort) controller = null; }
    }
    return {
      remaining: () => Math.max(0, Math.ceil((resendAt - now()) / 1000)),
      async send(email) {
        if (!validEmail(email)) throw new RecoveryError('EMAIL', 'Informe o e-mail usado para entrar.');
        if (now() < resendAt) throw new RecoveryError('COOLDOWN', 'Aguarde antes de reenviar.');
        resetToken = ''; const result = await call('request', { email });
        if (result.accepted !== true || !validToken(result.challengeId) || result.resendAfterSeconds !== 60 || result.expiresInSeconds !== 600) {
          throw new RecoveryError('RESPONSE', 'Resposta de recuperação inválida.');
        }
        challengeId = result.challengeId; resendAt = now() + 60000;
      },
      async verify(code) {
        if (!challengeId || !/^\d{6}$/.test(code)) throw new RecoveryError('CODE', 'Preencha o código de seis dígitos.');
        const result = await call('verify', { challengeId, code });
        if (!validToken(result.resetToken)) throw new RecoveryError('RESPONSE', 'Resposta de verificação inválida.');
        resetToken = result.resetToken;
      },
      async complete(password) {
        if (!challengeId || !resetToken) throw new RecoveryError('CODE', 'Solicite e verifique um novo código.');
        const result = await call('complete', { challengeId, resetToken, password });
        if (result.completed !== true || result.loginRequired !== true) throw new RecoveryError('RESPONSE', 'Confirmação de recuperação inválida.');
        challengeId = ''; resetToken = ''; resendAt = 0;
      },
      cancel() { generation++; controller?.abort(); resetToken = ''; },
      reset() { this.cancel(); challengeId = ''; resendAt = 0; },
    };
  }
  function createFlow(adapter, onChange = () => {}) {
    let state = { step: 'login', email: '', busy: false, operation: '', error: '', notice: '' }, generation = 0;
    const update = values => { state = { ...state, ...values }; onChange({ ...state }); };
    async function run(operation, success, name) {
      if (state.busy) return false;
      const stamp = ++generation; update({ busy: true, operation: name, error: '', notice: '' });
      try { await operation(); if (stamp !== generation) return false; update({ busy: false, operation: '', ...success }); return true; }
      catch (error) { if (stamp !== generation) return false; update({ busy: false, operation: '',
        error: error instanceof RecoveryError ? error.message : 'Não foi possível concluir a recuperação.' }); return false; }
    }
    const notice = 'Se a conta estiver apta, as instruções serão enviadas ao contato de recuperação verificado.';
    return {
      get state() { return { ...state }; },
      clearError() { if (!state.busy) update({ error: '' }); },
      open() { if (state.step === 'login') update({ step: 'email', error: '', notice: '' }); },
      close() { generation++; adapter.reset(); update({ step: 'login', email: '', busy: false, operation: '', error: '', notice: '' }); },
      back() {
        generation++; adapter.cancel();
        if (state.step === 'password') update({ step: 'otp', busy: false, operation: '', error: '', notice: 'Solicite um novo código para continuar.' });
        else if (state.step === 'otp') { adapter.reset(); update({ step: 'email', busy: false, operation: '', error: '', notice: '' }); }
        else this.close();
      },
      send(email) {
        if (state.step !== 'email' || state.busy) return Promise.resolve(false);
        const normalized = email.trim().toLowerCase();
        if (!validEmail(normalized)) { update({ error: 'Informe o e-mail usado para entrar.' }); return Promise.resolve(false); }
        return run(() => adapter.send(normalized), { step: 'otp', email: normalized, notice }, 'send');
      },
      resend() {
        if (state.step !== 'otp') return Promise.resolve(false);
        return run(() => adapter.send(state.email), { notice }, 'resend');
      },
      verify(code) {
        if (state.step !== 'otp' || state.busy) return Promise.resolve(false);
        if (!/^\d{6}$/.test(code)) { update({ error: 'Preencha as seis posições com números.' }); return Promise.resolve(false); }
        return run(() => adapter.verify(code), { step: 'password', notice: 'Código verificado.' }, 'verify');
      },
      save(password, confirmation) {
        if (state.step !== 'password' || state.busy) return Promise.resolve(false);
        if (!password || password !== confirmation) { update({ error: 'Preencha as duas senhas com o mesmo valor.' }); return Promise.resolve(false); }
        if ([...password].length < 15 || new TextEncoder().encode(password).length > 72) {
          update({ error: 'Use uma frase-senha com pelo menos 15 caracteres e até 72 bytes.' }); return Promise.resolve(false);
        }
        return run(() => adapter.complete(password), { step: 'complete', notice: 'Senha alterada. Entre novamente para continuar.' }, 'save');
      },
    };
  }
  const api = Object.freeze({ createAdapter, createFlow, RecoveryError });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoutflexRecovery = api;
})(globalThis);
