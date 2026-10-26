const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../inline-auth.js'),'utf8');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function fixture(){
 const nodes=new Map(),calls=[];const node=()=>({dataset:{},hidden:false,value:'',type:'password',disabled:false,handlers:{},children:[],addEventListener(n,fn){this.handlers[n]=fn;},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},replaceChildren(){this.children=[];},append(n){this.children.push(n);},focus(options){this.focused=true;this.focusOptions=options;},reportValidity(){return true;}});
 const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};let ended,token=null;
 const result={kind:'workspace',href:'/workspace.html',tenantId:'fictional-tenant',me:{user:{fullName:'Fictional User'}}};
 const Core={api:{login:async()=>({accessToken:'fictional-access'})},onUnauthenticated:fn=>ended=fn,watchSession(){},setToken:t=>{if(token)ended();token=t;},logout:async()=>{token=null;}};
 let resolving=()=>Promise.reject({status:401});
 const win={RoutflexCore:Core,RoutflexDestination:{intent:()=>null,resolve:()=>resolving()},location:{search:'',replace:href=>calls.push(href)},sessionStorage:{setItem(){}}};
 const c={URLSearchParams,window:win,document:{getElementById:$,createElement:node}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../auth-transition.js'),'utf8'),c);
 vm.runInNewContext(source.replace('  (async () => {','  globalThis.boot = (async () => {'),c);await c.boot;
 resolving=async()=>result;
 return {$,Core,calls,ended:()=>ended(),token:()=>token,result,resolve:fn=>resolving=fn,submit:()=>{ $('inlineEmail').value='fictional@example.test';$('inlinePassword').value='Synthetic-only';return $('inlineLoginForm').handlers.submit({preventDefault(){}});}};
}
test('inline login clears password immediately and navigates only after CORE context resolves',async()=>{const f=await fixture(),flight=defer();f.Core.api.login=()=>flight.promise;const run=f.submit();assert.equal(f.$('inlinePassword').value,'');assert.equal(f.$('inlineLoginSubmit').disabled,true);assert.equal(f.calls.length,0);flight.resolve({accessToken:'fictional-access'});await run;assert.deepEqual(f.calls,['/workspace.html']);});
test('invalid credentials stay inline with accessible error and no navigation',async()=>{const f=await fixture();f.Core.api.login=async()=>{throw {code:'INVALID_CREDENTIALS',status:401};};await f.submit();assert.equal(f.calls.length,0);assert.equal(f.$('inlineLoginError').hidden,false);assert.equal(f.$('inlineLoginError').focused,true);assert.equal(f.$('inlineLoginError').focusOptions.preventScroll,true);assert.equal(f.$('inlineLoginSubmit').disabled,false);});
test('session invalidated during login discards obsolete completion and token',async()=>{const f=await fixture(),flight=defer();f.Core.api.login=()=>flight.promise;const run=f.submit();f.ended();flight.resolve({accessToken:'obsolete'});await run;assert.equal(f.token(),null);assert.equal(f.calls.length,0);});
test('pending submission cannot create duplicate authentication requests',async()=>{const f=await fixture(),flight=defer();let n=0;f.Core.api.login=()=>{n++;return flight.promise;};const first=f.submit();await f.submit();assert.equal(n,1);flight.resolve({accessToken:'fictional-access'});await first;});
test('invalidation during destination lookup prevents stale navigation',async()=>{const f=await fixture(),flight=defer();f.resolve(()=>flight.promise);const run=f.submit();await Promise.resolve();f.ended();flight.resolve(f.result);await run;assert.equal(f.calls.length,0);});
test('setToken replacement invalidation does not lose the successful new login',async()=>{const f=await fixture();f.Core.setToken('older');await f.submit();assert.equal(f.token(),'fictional-access');assert.deepEqual(f.calls,['/workspace.html']);});
test('password eye toggles accessible labels without replacing its icon and resets when session clears',async()=>{
 const f=await fixture(),button=f.$('inlineShowPassword');
 button.textContent='eye-icon';
 assert.equal(button['aria-label'],'Mostrar senha');
 button.handlers.click();
 assert.equal(f.$('inlinePassword').type,'text');assert.equal(button['aria-pressed'],'true');
 assert.equal(button['aria-label'],'Ocultar senha');assert.equal(button.title,'Ocultar senha');assert.equal(button.textContent,'eye-icon');
 button.handlers.click();
 assert.equal(f.$('inlinePassword').type,'password');assert.equal(button['aria-pressed'],'false');assert.equal(button['aria-label'],'Mostrar senha');
 button.handlers.click();f.ended();
 assert.equal(f.$('inlinePassword').type,'password');assert.equal(button['aria-pressed'],'false');
 assert.equal(button['aria-label'],'Mostrar senha');assert.equal(button.title,'Mostrar senha');assert.equal(button.textContent,'eye-icon');
});
test('resolver outage never redirects to a mock or Workspace',async()=>{const f=await fixture();f.resolve(async()=>{throw {status:503};});await f.submit();assert.equal(f.calls.length,0);assert.equal(f.$('inlineLoginError').hidden,false);});
