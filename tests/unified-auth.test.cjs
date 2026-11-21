'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../core-client.js'),'utf8');
const me={user:{id:'11111111-1111-4111-8111-111111111111',status:'ACTIVE'},authenticationSessionId:'22222222-2222-4222-8222-222222222222',tenants:[]};
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
const reply=(status,payload)=>({status,ok:status<400,text:async()=>JSON.stringify(payload),statusText:String(status)});
function fixture({session=storage(),local=storage(),href='http://localhost:5500/workspace.html',config,transport}={}){
 const events={},docEvents={},calls=[],timers=new Map();let timerId=0;
 const window={sessionStorage:session,localStorage:local,RoutflexAuthConfig:config,location:{href,search:new URL(href).search,reload:()=>calls.push({reload:true})},document:{visibilityState:'visible',addEventListener:(key,fn)=>docEvents[key]=fn,removeEventListener:key=>delete docEvents[key]},addEventListener:(key,fn)=>events[key]=fn,removeEventListener:key=>delete events[key],setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id)};
 vm.runInNewContext(source,{window,URL,URLSearchParams,console,fetch:async(url,options)=>{calls.push({url,options});return transport?transport(url,options):reply(200,url.endsWith('/auth/refresh')?{accessToken:'synthetic-refreshed'}:me);}});
 return {Core:window.RoutflexCore,window,events,docEvents,timers,calls,session,local};
}
test('storage cannot redirect credentials or module links; legacy tokens are removed',async()=>{
 const local=storage(),session=storage();local.setItem('routflex.core.apiBase','https://attacker.example.test/core');local.setItem('routflex.workspace.moduleLinks','{"planning":"javascript:alert(1)"}');session.setItem('routflex.core.accessToken','obsolete');
 const f=fixture({local,session,config:{apiBase:'http://localhost:3100/core',moduleLinks:{planning:'http://localhost:8080/frontend/map.html'}}});
 await f.Core.api.login('fake@example.test','fictional-password');
 assert.equal(f.calls[0].url,'http://localhost:3100/core/auth/login');assert.equal(f.Core.moduleLinks().planning,'http://localhost:8080/frontend/map.html');
 for(const store of [local,session])assert.equal(store.getItem('routflex.core.accessToken'),null);
 assert.throws(()=>f.Core.setApiBase('https://attacker.example.test/core'),e=>e.code==='DEPLOYMENT_CONFIG_LOCKED');
});
test('access is memory-only and a new document restores only through CORE refresh plus me',async()=>{
 const first=fixture();first.Core.setToken('synthetic-access');assert.equal(first.session.getItem('routflex.core.accessToken'),null);assert.equal(first.local.getItem('routflex.core.accessToken'),null);
 const second=fixture({session:first.session,local:first.local});assert.equal(second.Core.getToken(),null);await second.Core.api.me();assert.deepEqual(second.calls.map(c=>new URL(c.url).pathname),['/core/auth/refresh','/core/me']);
});
test('demo query and injected fixture object never replace the real transport',async()=>{
 const f=fixture({href:'http://localhost:5500/workspace.html?demo=1&returnUrl=https://attacker.example.test'});f.window.RoutflexCoreFixtures={ready:true,handle(){throw Error('FIXTURE_MUST_NOT_RUN');}};
 await f.Core.api.me();assert.equal(f.Core.demoActive(),false);assert.equal(f.calls.length,2);
});
test('transport rejects arbitrary paths and prohibits following redirects with credentials',async()=>{
 const f=fixture();for(const route of ['//attacker.example.test/','/me/../../auth','/me/%2e%2e/admin','https://attacker.example.test','/me\\x'])await assert.rejects(f.Core.request(route,{auth:false}),e=>e.code==='INVALID_API_PATH');
 assert.equal(f.calls.length,0);await f.Core.api.login('fake@example.test','fictional-password');assert.equal(f.calls[0].options.redirect,'error');assert.equal(f.calls[0].options.referrerPolicy,'no-referrer');
});
test('deployment configuration rejects unsafe module destinations and credentials in URLs',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,bad','https://user:secret@example.test/','https://example.test/?token=bad','https://example.test/#token'])assert.throws(()=>fixture({config:{moduleLinks:{planning:value}}}),/Invalid module/);
 assert.throws(()=>fixture({config:{apiBase:'http://attacker.example.test/core'}}),/Invalid CORE/);
});
test('nonlocal pages use same-origin HTTPS and cannot fall back to local CORE',()=>{
 const f=fixture({href:'https://app.example.test/workspace.html'});assert.equal(f.Core.apiBase(),'https://app.example.test/core');assert.equal(f.Core.moduleLinks().planning,null);
 assert.throws(()=>fixture({href:'https://app.example.test/workspace.html',config:{apiBase:'http://localhost:3100/core'}}),/Invalid CORE/);
});
test('session monitor locks after canonical revocation and stops subsequent silent refresh',async()=>{
 let revoked=false;const f=fixture({transport:async url=>revoked?reply(401,{error:{code:'AUTHENTICATION_SESSION_REVOKED'}}):reply(200,me)});f.Core.setToken('synthetic');await f.Core.api.me();let locked=0;f.Core.onUnauthenticated(()=>locked++);const stop=f.Core.watchSession();revoked=true;await f.events.focus();assert.equal(locked,1);assert.equal(f.Core.getToken(),null);const count=f.calls.length;await assert.rejects(f.Core.api.me());assert.equal(f.calls.length,count);stop();assert.equal(f.timers.size,0);
});
test('monitor network failure clears local identity without inventing authenticated offline access',async()=>{
 let offline=false;const f=fixture({transport:async()=>{if(offline)throw Error('offline');return reply(200,me);}});f.Core.setToken('synthetic');await f.Core.api.me();let locked=false;f.Core.onUnauthenticated(()=>locked=true);f.Core.watchSession();offline=true;await f.events.focus();assert.equal(locked,true);assert.equal(f.Core.getToken(),null);
});
test('logout or identity-change hints from another tab only invalidate, never grant access',async()=>{
 for(const event of [{key:'routflex.core.logoutPending',newValue:'1'},{key:'routflex.core.sessionChanged',newValue:'metadata-only'}]){
  const f=fixture();f.Core.setToken('synthetic');await f.Core.api.me();let locked=false;f.Core.onUnauthenticated(()=>locked=true);f.events.storage(event);assert.equal(locked,true);assert.equal(f.Core.getToken(),null);
 }
});
test('pagehide discards identity and BFCache restoration requires a fresh document',async()=>{
 const f=fixture();f.Core.setToken('synthetic');await f.Core.api.me();let locked=false,reason;f.Core.onUnauthenticated(e=>{locked=true;reason=e.presentationReason;});f.events.pagehide({persisted:true});assert.equal(locked,true);assert.equal(f.Core.getToken(),null);assert.equal(reason,'pagehide');f.events.pageshow({persisted:true});assert.ok(f.calls.some(c=>c.reload));
});
