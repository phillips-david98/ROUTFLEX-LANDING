/* Tenant-scoped presentation only. The CORE authorizes every read/write/checkout. */
(function () {
  'use strict';
  const names = { MERCADO_PAGO: 'Mercado Pago', PAYPAL: 'PayPal' };
  const providerLogos = { MERCADO_PAGO: 'assets/billing/mercado-pago.svg', PAYPAL: 'assets/billing/paypal.png' };
  let generation = 0, binding = null, data = null, busy = false;
  const root = () => document.getElementById('billingContent');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = invoice => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: invoice.currency }).format(invoice.amountMinor / 100);
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : '—';
  const current = ticket => ticket === generation && binding?.current();

  // The adjacent provider name is always visible, including when an image fails.
  document.addEventListener('error', event => {
    const image = event.target;
    if (image?.matches?.('img.billing-provider-logo') && root()?.contains(image)) image.hidden = true;
  }, true);

  function reset() {
    generation++; binding = null; data = null; busy = false;
    if (root()) { root().replaceChildren(); root().setAttribute('aria-busy', 'false'); }
  }

  function validate(result) {
    if (!result || result.tenantId !== binding.tenantId || result.settings?.tenantId !== binding.tenantId ||
        !Number.isInteger(result.settings.revision) || typeof result.settings.mercadoPago !== 'boolean' || typeof result.settings.paypal !== 'boolean' ||
        ['mercadoPago', 'paypal'].some(key => typeof result.settings.platformAllowed?.[key] !== 'boolean' ||
          result.settings.available?.[key] !== (result.settings.platformAllowed[key] && result.settings[key])) ||
        typeof result.canManage !== 'boolean' || !Array.isArray(result.invoices) || result.invoices.some(invoice =>
          invoice.tenantId !== binding.tenantId || typeof invoice.id !== 'string' || !Number.isInteger(invoice.amountMinor) || invoice.amountMinor < 1 ||
          !['BRL','USD','EUR'].includes(invoice.currency) || !['PENDING_RECONCILIATION','CANCELLED'].includes(invoice.status) ||
          typeof invoice.isTest !== 'boolean' || !Array.isArray(invoice.providers) || invoice.providers.some(p => !Object.hasOwn(names, p.provider)))) {
      throw new Error('Resposta de Pagamentos inválida para esta organização.');
    }
    return result;
  }

  async function load(options) {
    reset(); binding = options;
    if (!root() || !binding.current()) return;
    if (!options.allowed) {
      root().innerHTML = '<div class="ws-empty ws-empty--lock"><strong>Acesso restrito</strong><span>Seu perfil não possui permissão para consultar os pagamentos desta organização.</span></div>';
      return;
    }
    await refresh();
  }

  async function refresh() {
    const ticket = ++generation;
    data = null; busy = false;
    root().setAttribute('aria-busy', 'true');
    root().innerHTML = '<div class="ws-skeleton" aria-label="Carregando pagamentos"><span></span><span></span><span></span></div>';
    try {
      const result = await binding.api.tenantBilling(binding.tenantId);
      if (!current(ticket)) return;
      data = validate(result); render(); return true;
    } catch (error) {
      if (!current(ticket)) return;
      const denied = error.status === 403;
      root().innerHTML = `<div class="ws-empty${denied ? ' ws-empty--lock' : ' ws-empty--error'}"><strong>${denied ? 'Acesso restrito' : 'Pagamentos indisponíveis'}</strong><span>${escape(error.message || 'Não foi possível consultar as cobranças. Tente novamente.')}</span><button type="button" class="secondary" data-billing="refresh">Tentar novamente</button></div>`;
    } finally { if (current(ticket)) root().setAttribute('aria-busy', 'false'); }
  }

  function status(invoice) {
    return `<span class="status ${invoice.status === 'CANCELLED' ? 'cancelled' : 'paused'}">${invoice.status === 'CANCELLED' ? 'Cancelada' : 'Pendente de conciliação'}</span>`;
  }

  function invoiceCard(invoice) {
    return `<article class="billing-invoice" aria-label="Cobrança ${escape(invoice.reference)}">
      <div class="billing-invoice-heading"><div><span class="billing-eyebrow">${invoice.isTest ? 'Registro de teste · sem cobrança real' : 'Cobrança individual'}</span><h3>${escape(invoice.serviceName)}</h3><p>Referência ${escape(invoice.reference)}</p></div>${status(invoice)}</div>
      <div class="billing-invoice-facts"><div class="billing-amount"><span>Valor da mensalidade / serviço</span><strong>${escape(money(invoice))}</strong><small>${escape(invoice.currency)} · valor fixo</small></div>
      <dl><div><dt>Período de referência</dt><dd>${date(invoice.periodStart)} a ${date(invoice.periodEnd)}</dd></div><div><dt>Vencimento</dt><dd>${date(invoice.dueDate)}</dd></div></dl></div>
      <div class="billing-checkouts">${invoice.providers.filter(provider => provider.authorized).map(provider => `<div><button type="button" class="${provider.provider === 'PAYPAL' ? 'secondary' : ''}" data-billing="checkout" data-invoice="${escape(invoice.id)}" data-provider="${escape(provider.provider)}" ${provider.available ? '' : 'disabled'}>${invoice.isTest ? 'Abrir sandbox' : 'Acessar checkout'} · ${names[provider.provider]} <span aria-hidden="true">↗</span></button>${!provider.available ? '<small>Link individual ainda indisponível</small>' : ''}</div>`).join('') || '<p>Nenhum provedor ativo para esta organização.</p>'}</div>
      <p class="billing-caption">${invoice.isTest ? 'Dados fictícios para homologação. ' : ''}A abertura do checkout não confirma o pagamento.</p></article>`;
  }

  function render() {
    const pending = data.invoices.filter(invoice => invoice.status === 'PENDING_RECONCILIATION');
    const preferences = [['mercadoPago', 'Mercado Pago'], ['paypal', 'PayPal']].filter(([key]) => data.settings.platformAllowed[key]);
    root().innerHTML = `<div class="billing-providers" aria-label="Provedores autorizados">${Object.entries(names).map(([key, name]) => {
      const setting = key === 'MERCADO_PAGO' ? 'mercadoPago' : 'paypal';
      const allowed = data.settings.platformAllowed[setting], enabled = data.settings.available[setting];
      return `<div class="billing-provider"><span class="billing-provider-mark" aria-hidden="true"><img class="billing-provider-logo" src="${providerLogos[key]}" width="32" height="32" alt="" decoding="async"></span><span class="billing-provider-copy"><strong>${name}</strong><small>${!allowed ? 'Indisponível · não autorizado pela plataforma' : enabled ? 'Autorizado pela plataforma · ativo na empresa' : 'Autorizado pela plataforma · desativado na empresa'}</small></span><span class="billing-provider-dot ${enabled ? 'enabled' : ''}" aria-hidden="true"></span></div>`;
    }).join('')}</div>
    <div class="billing-toolbar"><p>Consulte os valores e acesse o ambiente seguro do provedor.</p><button type="button" class="secondary btn-mini" data-billing="refresh">Atualizar</button></div>
    <div id="billingFeedback" role="status"></div>
    ${pending.length ? `<div class="billing-invoices">${pending.map(invoiceCard).join('')}</div>` : `<div class="billing-empty"><span class="billing-empty-icon" aria-hidden="true">✓</span><h3>${data.invoices.length ? 'Nenhuma cobrança em aberto' : 'Nenhuma cobrança cadastrada'}</h3><p>Quando a administração cadastrar uma cobrança para sua organização, os detalhes e as opções de pagamento aparecerão aqui.</p><span>Você não precisa realizar nenhuma ação agora.</span></div>`}
    ${data.invoices.length ? `<details class="billing-history"><summary>Histórico de cobranças <span>${data.invoices.length}${data.hasMore ? '+' : ''}</span></summary><div class="billing-table-scroll" tabindex="0" role="region" aria-label="Histórico de cobranças"><table><thead><tr><th scope="col">Referência / serviço</th><th scope="col">Período</th><th scope="col">Valor</th><th scope="col">Vencimento</th><th scope="col">Status</th></tr></thead><tbody>${data.invoices.map(invoice => `<tr><td><strong>${escape(invoice.reference)}</strong><small>${escape(invoice.serviceName)}${invoice.isTest ? ' · TESTE' : ''}</small></td><td>${date(invoice.periodStart)}<small>até ${date(invoice.periodEnd)}</small></td><td>${escape(money(invoice))}<small>${escape(invoice.currency)}</small></td><td>${date(invoice.dueDate)}</td><td>${status(invoice)}</td></tr>`).join('')}</tbody></table></div>${data.hasMore ? '<p>Exibindo as 100 cobranças mais recentes. Consulte a administração para registros anteriores.</p>' : ''}</details>` : ''}
    ${data.canManage && preferences.length ? `<details class="billing-settings"><summary>Preferências de pagamento da empresa</summary><p>Ative ou desative os provedores autorizados pela plataforma. Cada cobrança precisa de um link individual cadastrado pela administração.</p><form id="billingSettingsForm"><fieldset><legend>Provedores autorizados pela plataforma</legend>${preferences.map(([key, name]) => `<label><input type="checkbox" name="${key}" ${data.settings[key] ? 'checked' : ''}> ${name}</label>`).join('')}</fieldset><button type="submit">Salvar preferências</button><span id="billingSettingsFeedback" role="status"></span></form></details>` : ''}
    <p class="ws-section-note billing-note">O pagamento é concluído no site oficial do provedor. Cartões e dados bancários não são coletados pelo ROUTflex. Pix e parcelamento dependem da disponibilidade no Mercado Pago.</p>`;
  }

  function feedback(message, settings = false) {
    const node = document.getElementById(settings ? 'billingSettingsFeedback' : 'billingFeedback');
    if (node) node.textContent = message;
  }

  // Defense in depth for navigation. Financial authorization remains in the CORE.
  function safeCheckout(result, invoice, provider) {
    if (result.tenantId !== binding.tenantId || result.invoiceId !== invoice.id || result.provider !== provider || result.isTest !== invoice.isTest ||
        result.status !== 'PENDING_RECONCILIATION' || typeof result.url !== 'string' || /[\s\\%]/.test(result.url)) throw new Error('Checkout inválido. Atualize as cobranças.');
    const url = new URL(result.url);
    const hosts = provider === 'PAYPAL' ? (invoice.isTest ? ['www.sandbox.paypal.com'] : ['www.paypal.com']) :
      (invoice.isTest ? ['sandbox.mercadopago.com', 'sandbox.mercadopago.com.br'] : ['mpago.la', 'www.mercadopago.com.br']);
    // The shared MP hostname needs fresh server-side test-account/preference proof.
    // A hostname or a client flag alone cannot establish the test environment.
    if (provider === 'MERCADO_PAGO' && invoice.isTest && url.hostname === 'www.mercadopago.com.br') {
      const proof = result.sandboxVerification, pairs = [...url.searchParams];
      const age = proof ? Date.now() - Date.parse(proof.verifiedAt) : NaN;
      if (!proof || proof.kind !== 'MP_TEST_ACCOUNT_PREFERENCE' || proof.tenantId !== binding.tenantId || proof.invoiceId !== invoice.id ||
          url.pathname !== '/checkout/v1/redirect' || pairs.length !== 1 || pairs[0][0] !== 'pref_id' || pairs[0][1] !== proof.preferenceId ||
          !/^[A-Za-z0-9-]{10,160}$/.test(proof.preferenceId) || !Number.isFinite(age) || age < -5000 || age >= 60000 ||
          !(Date.parse(proof.expiresAt) > Date.now())) throw new Error('Preferência sandbox não verificada pelo CORE.');
      hosts.push('www.mercadopago.com.br');
    }
    const invoiceFragment = provider === 'PAYPAL' && url.pathname === '/invoice/p/' && /^#[A-Za-z0-9-]{6,160}$/.test(url.hash) && !url.search;
    if (url.protocol !== 'https:' || url.username || url.password || url.port || (url.hash && !invoiceFragment) || !hosts.includes(url.hostname)) throw new Error('Destino de checkout inválido.');
    return url.href;
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-billing]');
    if (!button || !root()?.contains(button) || !binding?.current() || busy) return;
    if (button.dataset.billing === 'refresh') return refresh();
    const invoice = data?.invoices.find(item => item.id === button.dataset.invoice);
    const provider = button.dataset.provider;
    if (!invoice?.providers.some(item => item.provider === provider && item.available) || button.disabled) return;
    const ticket = generation; busy = true; button.disabled = true;
    feedback('Validando o acesso ao checkout…');
    try {
      const result = await binding.api.tenantBillingCheckout(binding.tenantId, invoice.id, provider);
      if (!current(ticket)) return;
      const url = safeCheckout(result, invoice, provider);
      // Same-tab navigation avoids popup blockers; returning requires CORE revalidation.
      window.location.assign(url);
    } catch (error) {
      if (current(ticket)) feedback(error.message || 'Checkout indisponível. Atualize as cobranças.');
    } finally { if (current(ticket)) { busy = false; button.disabled = false; } }
  });

  document.addEventListener('submit', async event => {
    if (event.target.id !== 'billingSettingsForm') return;
    event.preventDefault();
    if (!binding?.current() || !data?.canManage || busy || !root()?.contains(event.target)) return;
    const form = event.target, ticket = generation, originalBinding = binding;
    const payload = { mercadoPago: Boolean(form.elements.mercadoPago?.checked), paypal: Boolean(form.elements.paypal?.checked), revision: data.settings.revision };
    busy = true; form.querySelector('button').disabled = true;
    feedback('');
    feedback('Salvando…', true);
    try {
      const result = await binding.api.tenantBillingSettings(binding.tenantId, payload);
      if (!current(ticket)) return;
      if (result.tenantId !== binding.tenantId) throw new Error('Resposta inválida para esta organização.');
      const refreshed = await refresh();
      if (refreshed && binding === originalBinding && binding.current() && data) { feedback('Configuração de provedores salva.'); document.getElementById('billingFeedback')?.scrollIntoView({ block: 'nearest' }); }
    } catch (error) { if (current(ticket)) feedback(error.message || 'Não foi possível salvar. Atualize antes de tentar novamente.', true); }
    finally { if (current(ticket)) { busy = false; form.querySelector('button').disabled = false; } }
  });
  window.RoutflexBilling = Object.freeze({ load, reset });
})();
