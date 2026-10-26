'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const R=require('../destination-resolver');
function fixture(){
 const id=randomUUID(),membershipId=randomUUID();
 const me={user:{id:randomUUID(),status:'ACTIVE',platformRole:null,email:'name.palm@example.test'},authenticationSessionId:randomUUID(),tenants:[{id,membershipId,status:'ACTIVE',membershipStatus:'ACTIVE',displayName:'Fictional Org'}]};
 const ctx={tenant:{id,status:'ACTIVE'},membership:{id:membershipId,status:'ACTIVE',isTenantOwner:false},roles:[{key:'FIELD_AGENT',isSystem:true}],permissions:['core.tenant.read_self'],modules:[{moduleKey:'palm',hasSeat:true,entitlementEffective:true,hasEffectiveAccess:true,seatTypeKey:'FIELD_SEAT'}]};
 const Core={api:{me:async()=>me,meContext:async()=>ctx},moduleLinks:()=>({palm:'http://localhost:5173/palm',ops:'http://localhost:5173/',planning:'http://localhost:8080/frontend/map.html'})};
 return {me,ctx,Core};
}
test('PLATFORM_OWNER has no membership/seat dependency and ignores returnTo',async()=>{const f=fixture();f.me.user.platformRole='PLATFORM_OWNER';f.me.tenants=[];f.Core.api.meContext=()=>{throw Error('MUST_NOT_QUERY');};assert.equal((await R.resolve(f.Core,{returnTo:'/palm'})).href,'/control-center/index.html');});
test('field-only identity goes directly to PALM from canonical context',async()=>{const f=fixture(),r=await R.resolve(f.Core);assert.equal(r.kind,'palm');assert.equal(new URL(r.href).searchParams.get('tenantId'),f.ctx.tenant.id);assert.ok(!r.href.includes('token'));});
for(const [name,mutate] of [
 ['tenant owner',f=>f.ctx.membership.isTenantOwner=true],
 ['tenant administrator',f=>f.ctx.roles.push({key:'TENANT_ADMIN',isSystem:true})],
 ['administrative permission',f=>f.ctx.permissions.push('core.member.read')],
 ['Planning operator',f=>{f.ctx.roles=[{key:'OPERATOR',isSystem:true}];f.ctx.modules[0].moduleKey='planning';}],
 ['OPS operator',f=>{f.ctx.roles=[{key:'OPERATOR',isSystem:true}];f.ctx.modules[0].moduleKey='ops';}],
 ['custom role same key is not field authority',f=>f.ctx.roles[0].isSystem=false],
 ['non-field module access',f=>f.ctx.modules.push({...f.ctx.modules[0],moduleKey:'ops'})]
])test(name+' keeps Workspace preference',async()=>{const f=fixture();mutate(f);assert.equal((await R.resolve(f.Core)).kind,'workspace');});
for(const [name,mutate] of [
 ['no seat',f=>{f.ctx.modules[0].hasSeat=false;f.ctx.modules[0].hasEffectiveAccess=false;}],
 ['no entitlement',f=>{f.ctx.modules[0].entitlementEffective=false;f.ctx.modules[0].hasEffectiveAccess=false;}],
 ['wrong seat type',f=>f.ctx.modules[0].seatTypeKey='MANAGER_SEAT'],
 ['missing field permission',f=>f.ctx.permissions=[]],
 ['suspended membership',f=>f.me.tenants[0].membershipStatus='SUSPENDED'],
 ['suspended tenant',f=>f.me.tenants[0].status='SUSPENDED'],
 ['CORE access denied',f=>f.Core.api.meContext=async()=>{throw {status:403};}]
])test(name+' cannot route field identity to a product or Workspace',async()=>{const f=fixture();mutate(f);assert.equal((await R.resolve(f.Core)).kind,'blocked');});
test('multiple field organizations need a minimal choice, never a stored/URL privilege',async()=>{const f=fixture(),second=structuredClone(f.me.tenants[0]);second.id=randomUUID();second.membershipId=randomUUID();f.me.tenants.push(second);f.Core.api.meContext=async id=>({...f.ctx,tenant:{...f.ctx.tenant,id},membership:{...f.ctx.membership,id:id===second.id?second.membershipId:f.ctx.membership.id}});const r=await R.resolve(f.Core,{selectedTenantId:randomUUID()});assert.equal(r.kind,'choose');assert.equal(r.fieldOnly,true);assert.equal(r.choices.length,2);assert.equal((await R.resolve(f.Core,{selectedTenantId:second.id})).tenantId,second.id);});
test('field name or email never determines routing',async()=>{const f=fixture();f.ctx.roles=[{key:'OPERATOR',isSystem:true}];assert.equal((await R.resolve(f.Core)).kind,'workspace');f.ctx.roles=[{key:'FIELD_AGENT',isSystem:true}];f.me.user.email='admin@example.test';assert.equal((await R.resolve(f.Core)).kind,'palm');});
test('permitted internal intention uses reviewed module URL and effective authorization',async()=>{const f=fixture();f.ctx.roles=[{key:'OPERATOR',isSystem:true}];f.ctx.modules[0].moduleKey='ops';assert.equal((await R.resolve(f.Core,{returnTo:'/ops'})).kind,'ops');assert.equal((await R.resolve(f.Core,{returnTo:'/planning'})).kind,'workspace');assert.equal((await R.resolve(f.Core,{returnTo:'/control-center/index.html'})).kind,'workspace');});
test('field policy overrides manipulated administrative intention',async()=>{const f=fixture();assert.equal((await R.resolve(f.Core,{returnTo:'/workspace.html'})).kind,'palm');});
for(const value of ['https://evil.test','//evil.test','/\\evil.test','javascript:alert(1)','/palm?token=x','/ops#x','/../ops','/control-center/evil','/sales'])test('reject return destination '+value,()=>assert.equal(R.intent('?returnTo='+encodeURIComponent(value)),null));
test('duplicate return destinations are ignored',()=>assert.equal(R.intent('?returnTo=/ops&returnTo=/palm'),null));
test('strict internal destination accepted',()=>assert.equal(R.intent('?returnTo=%2Fpalm'),'/palm'));
for(const [name,mutate] of [
 ['foreign tenant',f=>f.ctx.tenant.id=randomUUID()],['foreign membership',f=>f.ctx.membership.id=randomUUID()],
 ['duplicate module',f=>f.ctx.modules.push({...f.ctx.modules[0]})],['duplicate tenant',f=>f.me.tenants.push({...f.me.tenants[0]})],
 ['coerced access',f=>f.ctx.modules[0].hasEffectiveAccess='true'],['missing roles',f=>delete f.ctx.roles]
])test('malformed authoritative context rejected: '+name,async()=>{const f=fixture();mutate(f);await assert.rejects(R.resolve(f.Core));});
test('identity switch during context resolution never navigates stale identity',async()=>{const f=fixture();let count=0;f.Core.api.me=async()=>++count===1?f.me:{...f.me,authenticationSessionId:randomUUID()};await assert.rejects(R.resolve(f.Core));});
test('CORE unavailable does not turn into permission or Workspace fallback',async()=>{const f=fixture();f.Core.api.meContext=async()=>{throw {status:503};};await assert.rejects(R.resolve(f.Core));});
