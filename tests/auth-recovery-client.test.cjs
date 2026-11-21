'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createAdapter,createFlow}=require('../auth-recovery-client.js');
function fixture(){
  let now=1000, reject=false;const calls=[];
  const adapter=createAdapter({apiBase:'http://localhost:3100/core',now:()=>now,fetchImpl:async(url,options)=>{
    calls.push({url,options,body:JSON.parse(options.body)});
    if(reject)return new Response('{}',{status:503});
    const value=url.endsWith('/request')?{accepted:true,challengeId:'a'.repeat(43),expiresInSeconds:600,resendAfterSeconds:60}
      :url.endsWith('/verify')?{resetToken:'b'.repeat(43)}:{completed:true,loginRequired:true};
    return new Response(JSON.stringify(value),{status:200});
  }});
  return {adapter,flow:createFlow(adapter),calls,advance:()=>now+=61000,unavailable:()=>reject=true};
}
test('real adapter completes five states and transmits secrets only in the expected request bodies',async()=>{
  const f=fixture();f.flow.open();await f.flow.send('fixture@example.test');await f.flow.verify('123456');
  await f.flow.save('Fixture long passphrase','Fixture long passphrase');
  assert.equal(f.flow.state.step,'complete');assert.equal(f.calls.length,3);
  assert.deepEqual(Object.keys(f.calls[2].body).sort(),['challengeId','password','resetToken']);
  assert.equal(f.calls[2].options.credentials,'omit');assert.equal(f.calls[2].options.cache,'no-store');
  assert.ok(!JSON.stringify(f.flow.state).includes('passphrase'));assert.ok(!JSON.stringify(f.flow.state).includes('123456'));
  await assert.rejects(f.adapter.complete('another passphrase'));
});
test('resend cooldown, backtracking and close erase old proof and prevent unintended requests',async()=>{
  const f=fixture();f.flow.open();await f.flow.send('fixture@example.test');assert.equal(await f.flow.resend(),false);
  await f.flow.verify('123456');f.flow.back();await assert.rejects(f.adapter.complete('Fixture long passphrase'));
  f.advance();assert.equal(await f.flow.resend(),true);f.flow.close();assert.equal(f.flow.state.step,'login');
  assert.equal(await f.flow.save('Fixture long passphrase','Fixture long passphrase'),false);
});
test('disabled backend does not advance the flow or fabricate delivery',async()=>{
  const f=fixture();f.unavailable();f.flow.open();assert.equal(await f.flow.send('fixture@example.test'),false);
  assert.equal(f.flow.state.step,'email');assert.match(f.flow.state.error,/indispon/);
});
test('late network responses cannot revive a closed recovery flow',async()=>{
  let release;const adapter=createAdapter({apiBase:'http://localhost:3100/core',fetchImpl:()=>new Promise(r=>release=r)});
  const flow=createFlow(adapter);flow.open();const pending=flow.send('fixture@example.test');flow.close();
  release(new Response(JSON.stringify({accepted:true,challengeId:'a'.repeat(43),expiresInSeconds:600,resendAfterSeconds:60})));
  assert.equal(await pending,false);assert.equal(flow.state.step,'login');
});
test('untrusted transport configuration and bcrypt-truncated Unicode passwords are rejected',async()=>{
  for(const apiBase of ['http://remote.example/core','https://u:p@example.test/core','http://localhost:8000/core','https://example.test/core?token=x'])assert.throws(()=>createAdapter({apiBase}));
  const f=fixture();f.flow.open();await f.flow.send('fixture@example.test');await f.flow.verify('123456');
  assert.equal(await f.flow.save('😀'.repeat(19),'😀'.repeat(19)),false);assert.equal(f.calls.length,2);
});
