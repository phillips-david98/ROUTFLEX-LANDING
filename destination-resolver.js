/* Entry policy only. CORE and each product backend remain authorization authorities. */
(function (root, factory) {
  const policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  else root.RoutflexDestination = policy;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const active = value => ['ACTIVE', 'TRIAL'].includes(value);
  const fieldPermissions = new Set(['core.tenant.read_self', 'palm.route.read']);
  const intents = new Set(['/workspace.html', '/control-center/index.html', '/planning', '/ops', '/palm']);
  const invalid = () => Object.assign(new Error('O contexto de acesso não pôde ser confirmado.'), { code: 'INVALID_ENTRY_CONTEXT' });
  function intent(search) {
    const params = new URLSearchParams(search);
    const values = params.getAll('returnTo');
    return values.length === 1 && intents.has(values[0]) ? values[0] : null;
  }
  function validateMe(me) {
    if (!uuid(me?.user?.id) || me.user.status !== 'ACTIVE' || !uuid(me.authenticationSessionId)
      || !Array.isArray(me.tenants) || me.tenants.some(t => !uuid(t.id) || !uuid(t.membershipId)
        || typeof t.membershipStatus !== 'string' || typeof t.status !== 'string')
      || new Set(me.tenants.map(t => t.id)).size !== me.tenants.length) throw invalid();
    return me;
  }
  function classify(me, tenant, ctx) {
    if (!ctx || ctx.tenant?.id !== tenant.id || !active(ctx.tenant.status)
      || ctx.membership?.id !== tenant.membershipId || ctx.membership.status !== 'ACTIVE'
      || typeof ctx.membership.isTenantOwner !== 'boolean'
      || !Array.isArray(ctx.roles) || ctx.roles.some(r => typeof r.key !== 'string' || typeof r.isSystem !== 'boolean')
      || !Array.isArray(ctx.permissions) || ctx.permissions.some(p => typeof p !== 'string')
      || !Array.isArray(ctx.modules) || ctx.modules.some(m => typeof m.moduleKey !== 'string'
        || ['entitlementEffective', 'hasSeat', 'hasEffectiveAccess'].some(k => typeof m[k] !== 'boolean'))
      || new Set(ctx.modules.map(m => m.moduleKey)).size !== ctx.modules.length) throw invalid();
    const modules = ctx.modules.filter(m => m.hasEffectiveAccess && m.hasSeat && m.entitlementEffective);
    const fieldRole = ctx.roles.length > 0 && ctx.roles.every(r => r.key === 'FIELD_AGENT' && r.isSystem === true);
    const fieldOnly = !me.user.platformRole && !ctx.membership.isTenantOwner && fieldRole
      && ctx.permissions.every(p => fieldPermissions.has(p)) && modules.every(m => m.moduleKey === 'palm');
    const palm = modules.find(m => m.moduleKey === 'palm' && m.seatTypeKey === 'FIELD_SEAT');
    return { tenant, context: ctx, modules, fieldOnly, fieldAllowed: fieldOnly && Boolean(palm) && ctx.permissions.includes('core.tenant.read_self') };
  }
  async function resolve(Core, { me: existing, selectedTenantId, returnTo } = {}) {
    const me = validateMe(existing || await Core.api.me());
    if (me.user.platformRole === 'PLATFORM_OWNER') return { kind: 'platform', href: '/control-center/index.html', me };
    const entries = [];
    for (const tenant of me.tenants.filter(t => active(t.status) && t.membershipStatus === 'ACTIVE')) {
      try { entries.push(classify(me, tenant, await Core.api.meContext(tenant.id))); }
      catch (error) { if (error.status !== 403 && error.status !== 404) throw error; }
    }
    const current = validateMe(await Core.api.me());
    if (current.user.id !== me.user.id || current.authenticationSessionId !== me.authenticationSessionId) throw invalid();
    if (!entries.length) return { kind: 'blocked', me };
    const onlyField = entries.every(e => e.fieldOnly);
    const choices = onlyField ? entries.filter(e => e.fieldAllowed) : entries;
    if (!choices.length) return { kind: 'blocked', me };
    const selected = choices.find(e => e.tenant.id === selectedTenantId) || (choices.length === 1 ? choices[0] : null);
    if (!selected && !onlyField && !['/planning', '/ops', '/palm'].includes(returnTo)) return { kind: 'workspace', href: '/workspace.html', me };
    if (!selected) return { kind: 'choose', me, choices: choices.map(e => ({ id: e.tenant.id, name: e.tenant.displayName })), fieldOnly: onlyField };
    const requested = intents.has(returnTo) ? returnTo.slice(1) : null;
    const key = onlyField ? 'palm' : ['planning', 'ops', 'palm'].includes(requested) ? requested : null;
    if (key && selected.modules.some(m => m.moduleKey === key)) {
      const href = Core.moduleLinks()[key];
      if (!href) return { kind: 'blocked', me };
      const url = new URL(href);
      if (key === 'palm' || key === 'ops') url.searchParams.set('tenantId', selected.tenant.id);
      return { kind: key, href: url.href, tenantId: selected.tenant.id, me };
    }
    // Administrative duties anywhere preserve Workspace preference. No role is granted here.
    if (onlyField) return { kind: 'blocked', me };
    return { kind: 'workspace', href: '/workspace.html', tenantId: selected.tenant.id, me };
  }
  return Object.freeze({ intent, validateMe, classify, resolve });
});
