'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Exercise the actual render function with two synthetic CORE-authorized tenants.
// No browser, storage, network, authentication or operational data is used.
const source=fs.readFileSync(path.join(__dirname,'../workspace.js'),'utf8');
const start=source.indexOf('  function moduleEntry('),end=source.indexOf('  function renderMarketplace()',start);
assert.ok(start>=0&&end>start);
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
function fixture({key='ops',url='http://localhost:5173/',access=true}={}) {
 const grid={innerHTML:''},links={[key]:url};
 const state={tenantId:A,context:{tenant:{id:A},modules:[{moduleKey:key,hasEffectiveAccess:access,entitlementState:'ACTIVE',entitlementEffective:true,hasSeat:access}]},catalog:{modules:[{key,name:key}]}};
 const context={state,URL,Core:{moduleLinks:()=>links},can:()=>false,PERM:{MEMBER_READ:'synthetic'},MODULE_META:{},LABELS:{entitlementState:{},seatType:{}},ENT_TONE:{},badge:()=>'',escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;'),$:()=>grid};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const render=()=>{context.renderModules();const href=grid.innerHTML.match(/href="([^"]+)"[^>]*>Acessar<\/a>/)?.[1];return href?.replaceAll('&amp;','&').replaceAll('&quot;','"')??null;};
 return{state,grid,links,render};
}
test('OPS card carries explicitly selected tenant A from CORE context',()=>{
 const f=fixture(),href=f.render();assert.equal(href,'http://localhost:5173/?tenantId='+A);
 assert.match(f.grid.innerHTML,/rel="noopener noreferrer" referrerpolicy="no-referrer"/);
});
test('switch A to B replaces the OPS tenant hint and preserves the reviewed origin',()=>{
 const f=fixture();f.render();f.state.tenantId=B;f.state.context.tenant.id=B;
 const target=new URL(f.render());assert.equal(target.origin,'http://localhost:5173');assert.deepEqual(target.searchParams.getAll('tenantId'),[B]);
});
test('OPS destination query/hash are preserved and a stale hint is replaced exactly once',()=>{
 const f=fixture({url:'https://ops.example.test/view?layout=compact&tenantId=stale&tenantId=duplicate#queue'}),target=new URL(f.render());
 assert.equal(target.pathname,'/view');assert.equal(target.hash,'#queue');assert.equal(target.searchParams.get('layout'),'compact');assert.deepEqual(target.searchParams.getAll('tenantId'),[A]);
});
test('only public tenant hint enters the URL, never user or authentication session',()=>{
 const f=fixture();f.state.me={user:{id:'synthetic-user'},authenticationSessionId:'synthetic-auth-session'};
 const target=new URL(f.render());assert.deepEqual([...target.searchParams.keys()],['tenantId']);
 assert.ok(!target.href.includes('synthetic-user'));assert.ok(!target.href.includes('synthetic-auth-session'));
});
for(const [key,url] of [['planning','http://localhost:8080/frontend/map.html'],['palm','http://localhost:5173/palm'],['sales','https://sales.example.test/'],['future','https://future.example.test/?view=overview']])test(key+' destination remains unchanged',()=>{
 assert.equal(fixture({key,url}).render(),url);
});
test('OPS without effective CORE access has no launch link',()=>{const f=fixture({access:false});assert.equal(f.render(),null);});
test('OPS missing deployment URL keeps existing unavailable-destination action',()=>{const f=fixture({url:null});assert.equal(f.render(),null);assert.match(f.grid.innerHTML,/data-action="module-url-missing"/);});
test('trusted module destination map is never mutated',()=>{const f=fixture();f.render();assert.equal(f.links.ops,'http://localhost:5173/');});
