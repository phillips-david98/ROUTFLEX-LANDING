'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Optional lightweight DOM suite. Set ROUTFLEX_TEST_JSDOM to the installed
// jsdom directory; no browser process, network or production state is used.
const domPath=process.env.ROUTFLEX_TEST_JSDOM;
const root=path.resolve(__dirname,'..');
const T='11111111-1111-4111-8111-111111111111',U='22222222-2222-4222-8222-222222222222',M='33333333-3333-4333-8333-333333333333',S='44444444-4444-4444-8444-444444444444';
async function fixture({query='',modules=['palm'],fieldOnly=false}={}){
 const {JSDOM,VirtualConsole}=require(domPath),vc=new VirtualConsole();
 const errors=[],destinations=[];vc.on('jsdomError',e=>{if(!e.message.includes('Not implemented: navigation'))errors.push(e.message);});
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost:5500/'+query,runScripts:'outside-only',virtualConsole:vc});
 const w=dom.window;let authenticated=false;
 const me={user:{id:U,status:'ACTIVE',fullName:'Persona fictícia'},authenticationSessionId:S,tenants:[{id:T,membershipId:M,status:'ACTIVE',membershipStatus:'ACTIVE',displayName:'Tenant fictício'}]};
 const ctx={tenant:{id:T,status:'ACTIVE'},membership:{id:M,status:'ACTIVE',isTenantOwner:false},roles:fieldOnly?[{key:'FIELD_AGENT',isSystem:true}]:[{key:'FIELD_AGENT',isSystem:true},{key:'TEST_EXECUTION',isSystem:false}],permissions:fieldOnly?['core.tenant.read_self','palm.route.read']:['core.tenant.read_self','palm.route.read','palm.execution.write','core.operation_session.read'],modules:modules.map(moduleKey=>({moduleKey,entitlementEffective:true,hasSeat:true,hasEffectiveAccess:true,seatTypeKey:moduleKey==='palm'?'FIELD_SEAT':'OFFICE_SEAT'}))};
 w.RoutflexCore={api:{me:async()=>{if(!authenticated)throw {status:401};return me;},meContext:async()=>ctx,login:async()=>({accessToken:'fictional-memory-token'})},setToken:()=>{authenticated=true;},moduleLinks:()=>({planning:'http://localhost:8080/frontend/map.html',ops:'http://localhost:5173/',palm:'http://localhost:5173/palm'}),onUnauthenticated(){},watchSession(){}};
 for(const name of ['destination-resolver.js','auth-transition.js'])w.eval(fs.readFileSync(path.join(root,name),'utf8'));
 const original=w.RoutflexDestination;
 w.RoutflexDestination={...original,resolve:async(...args)=>{const result=await original.resolve(...args);destinations.push(result);return result;}};
 w.eval(fs.readFileSync(path.join(root,'inline-auth.js'),'utf8'));
 const settle=async condition=>{for(let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,2));}throw Error('DOM did not settle');};
 await settle(()=>w.document.getElementById('acesso').dataset.phase==='invalid');
 return {w,dom,errors,destinations,async login(mode){if(mode)w.document.getElementById(mode==='field'?'inlineModeField':'inlineModeAdmin').click();w.document.getElementById('inlineEmail').value='fake@example.test';w.document.getElementById('inlinePassword').value='synthetic-only';w.document.getElementById('inlineLoginForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle(()=>destinations.length>0);return destinations.at(-1);}};
}
for(const item of [
 {name:'default login routes the execution-enabled field persona directly to PALM',kind:'palm'},
 {name:'Workspace return intent cannot expose Workspace to the execution-enabled field persona',query:'?returnTo=/workspace.html',kind:'palm'},
 {name:'explicit field mode routes the execution-enabled PALM persona to PALM',mode:'field',kind:'palm'},
 {name:'field mode overrides a stale OPS return intent',query:'?returnTo=/ops',modules:['ops','palm'],mode:'field',kind:'palm'},
 {name:'admin mode can leave an initial PALM return intent',query:'?returnTo=/palm',modules:['ops','palm'],mode:'admin',kind:'workspace'},
 {name:'admin mode preserves explicit Planning intent',query:'?returnTo=/planning',modules:['planning','palm'],mode:'admin',kind:'planning'},
 {name:'field selection cannot grant PALM without CORE module access',modules:['ops'],mode:'field',kind:'workspace'},
 {name:'default admin entry remains Workspace for administrative identity',modules:['ops','palm'],kind:'workspace'},
 {name:'original FIELD_AGENT routing remains PALM',fieldOnly:true,kind:'palm'},
 {name:'PALM return intent remains PALM without changing mode',query:'?returnTo=/palm',kind:'palm'},
])test(item.name,{skip:!domPath},async()=>{const f=await fixture(item);try{const got=await f.login(item.mode);assert.equal(got.kind,item.kind);if(got.kind==='palm'){const href=new URL(got.href);assert.equal(href.origin,'http://localhost:5173');assert.equal(href.pathname,'/palm');assert.deepEqual([...href.searchParams.keys()],['tenantId']);assert.equal(href.searchParams.get('tenantId'),T);}assert.equal(f.w.document.getElementById('inlinePassword').value,'');assert.deepEqual(f.errors,[]);}finally{f.dom.window.close();}});
