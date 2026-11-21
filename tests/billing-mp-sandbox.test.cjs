'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../workspace-billing.js'), 'utf8');
const start = source.indexOf('  function safeCheckout('), end = source.indexOf("  document.addEventListener('click'", start);
const context = vm.createContext({ URL, Date, binding: { tenantId: 'tenant-a' } });
vm.runInContext(source.slice(start, end) + '\nthis.checkout=safeCheckout;', context);
const invoice = { id: 'invoice-a', isTest: true };
function response() {
  return { tenantId: 'tenant-a', invoiceId: invoice.id, provider: 'MERCADO_PAGO', isTest: true, status: 'PENDING_RECONCILIATION',
    url: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1234567890-test-preference',
    sandboxVerification: { kind: 'MP_TEST_ACCOUNT_PREFERENCE', tenantId: 'tenant-a', invoiceId: invoice.id, preferenceId: '1234567890-test-preference', verifiedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+3600000).toISOString() } };
}
test('shared MP hostname requires fresh CORE binding, without changing the URL', () => {
  const result=response();assert.equal(context.checkout(result,invoice,'MERCADO_PAGO'),result.url);
  delete result.sandboxVerification;assert.throws(()=>context.checkout(result,invoice,'MERCADO_PAGO'));
});
for (const kind of ['tenant','invoice','preference','expired','stale','kind','query','host','scheme','live']) {
  test('sandbox checkout blocks mismatched '+kind,()=>{
    const r=response(),p=r.sandboxVerification;
    if(kind==='tenant')p.tenantId='tenant-b';if(kind==='invoice')p.invoiceId='invoice-b';if(kind==='preference')p.preferenceId='1234567890-other';
    if(kind==='expired')p.expiresAt=new Date(0).toISOString();if(kind==='stale')p.verifiedAt=new Date(Date.now()-61000).toISOString();
    if(kind==='kind')p.kind='LIVE';if(kind==='query')r.url+='&redirect=evil';if(kind==='host')r.url=r.url.replace('.com.br','.com.br.evil.test');
    if(kind==='scheme')r.url=r.url.replace('https:','http:');if(kind==='live')r.isTest=false;
    assert.throws(()=>context.checkout(r,invoice,'MERCADO_PAGO'));
  });
}
