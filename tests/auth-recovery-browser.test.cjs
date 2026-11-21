'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const playwrightPath = process.env.ROUTFLEX_TEST_PLAYWRIGHT, output = process.env.ROUTFLEX_RECOVERY_OUTPUT;
const T='11111111-1111-4111-8111-111111111111', U='22222222-2222-4222-8222-222222222222';
const S='44444444-4444-4444-8444-444444444444';
test('Recovery browser contracts and responsive UI (intercepted API; no real email)', {skip:!playwrightPath,timeout:180000},async t=>{
  const {chromium}=require(playwrightPath), browser=await chromium.launch({executablePath:process.env.ROUTFLEX_TEST_BROWSER,headless:true});
  t.after(()=>browser.close());if(output)fs.mkdirSync(output,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],calls=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
  let unavailable=false, delayed=false;
  await page.route('http://localhost:3100/core/**',async route=>{
    const name=new URL(route.request().url()).pathname;
    if(name.endsWith('/auth/refresh'))return route.fulfill({status:401,json:{}});
    if(name.includes('/auth/recovery/')){
      calls.push({name,body:route.request().postDataJSON()});
      if(delayed)await new Promise(r=>setTimeout(r,500));
      if(unavailable)return route.fulfill({status:503,json:{}});
      if(name.endsWith('/request'))return route.fulfill({status:202,json:{accepted:true,challengeId:'a'.repeat(43),expiresInSeconds:600,resendAfterSeconds:60}});
      if(name.endsWith('/verify'))return route.fulfill({status:calls.at(-1).body.code==='123456'?200:400,json:{resetToken:'b'.repeat(43)}});
      return route.fulfill({json:{completed:true,loginRequired:true}});
    }
    if(name.endsWith('/me'))return route.fulfill({json:{user:{id:U,status:'ACTIVE'},authenticationSessionId:S,tenants:[]}});
    return route.fulfill({status:403,json:{}});
  });
  const load=async()=>{await page.goto('http://localhost:5500/',{waitUntil:'domcontentloaded'});await page.locator('#inlineForgotPassword').waitFor();};
  const step=async name=>{
    await page.waitForFunction(v=>document.querySelector('#acesso').dataset.recoveryStep===v,name);
    await page.waitForFunction(()=>!document.querySelector('.recovery-views').getAnimations().some(a=>a.playState==='running'));
  };
  const send=async()=>{await page.locator('#inlineForgotPassword').click();await step('email');await page.locator('#recoveryEmail').fill('fixture@example.test');await page.locator('#recoveryEmailForm button[type=submit]').click();await step('otp');};
  const code=async value=>{await page.locator('#recoveryDigits input').first().focus();await page.keyboard.type(value);await page.locator('#recoveryOtpForm button[type=submit]').click();};
  const geometry=()=>page.evaluate(()=>{
    const r=document.querySelector('#acesso').getBoundingClientRect();
    return {x:r.x,y:r.y+scrollY,h:r.height,overflow:document.documentElement.scrollWidth>innerWidth,cardOverflow:document.querySelector('#acesso').scrollWidth>document.querySelector('#acesso').clientWidth};
  });
  const storage=()=>page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));
  await t.test('five states preserve geometry, keyboard entry and no secret persistence at five widths',async()=>{
    for(const width of [1440,1024,768,390,320]){
      await page.setViewportSize({width,height:width<800?900:1000});await load();
      const before=await geometry(),saved=await storage();await send();
      assert.equal(await page.locator('#recoveryDemoCode,#recoveryExpire').count(),0);
      assert.equal(await page.locator('#recoveryResend').isDisabled(),true);
      await code('000000');await page.locator('#recoveryError').waitFor({state:'visible'});
      await code('123456');await step('password');
      await page.locator('#recoveryPassword').fill('Test-only new passphrase');
      await page.locator('#recoveryConfirmation').fill('Test-only new passphrase');
      if(output&&[1440,390].includes(width))await page.locator('#acesso').screenshot({path:path.join(output,'password-'+width+'.png'),mask:[page.locator('#recoveryPassword,#recoveryConfirmation')]});
      const after=await geometry();
      assert.ok(Math.abs(after.x-before.x)<=1&&Math.abs(after.y-before.y)<=1);
      assert.ok(after.h<=before.h+1);assert.equal(after.overflow,false);assert.equal(after.cardOverflow,false);
      await page.locator('#recoveryPasswordForm button[type=submit]').click();await step('complete');
      assert.deepEqual(await storage(),saved);
      assert.equal(await page.locator('#recoveryPassword').inputValue(),'');
      await page.locator('[data-recovery-view=complete] [data-recovery-close]').click();await step('login');
      checks.push('five states and geometry '+width);
    }
    assert.equal(calls.filter(c=>c.name.endsWith('/complete')).length,5);
    assert.ok(calls.every(c=>!('tenantId' in c.body)&&!('userId' in c.body)&&!('recoveryEmail' in c.body)));
  });
  await t.test('real unavailability and cancelled network work cannot show success',async()=>{
    await load();unavailable=true;await page.locator('#inlineForgotPassword').click();await step('email');
    await page.locator('#recoveryEmail').fill('fixture@example.test');await page.locator('#recoveryEmailForm button[type=submit]').click();
    await page.locator('#recoveryError').waitFor({state:'visible'});assert.equal(await page.locator('#acesso').getAttribute('data-recovery-step'),'email');
    unavailable=false;delayed=true;await page.locator('#recoveryEmailForm button[type=submit]').click();await page.locator('#recoveryEmailForm [data-recovery-close]').click();await step('login');
    await page.waitForTimeout(600);assert.equal(await page.locator('#acesso').getAttribute('data-recovery-step'),'login');delayed=false;
    checks.push('unavailability and late response cancellation');
  });
  await t.test('normal motion is retained and disabled flag leaves login intact',async()=>{
    await page.emulateMedia({reducedMotion:'no-preference'});await load();await send();await code('123456');
    assert.equal(await page.locator('#recoveryDigits input').first().evaluate(e=>getComputedStyle(e).animationName),'recovery-verify');
    await step('password');
    const config=fs.readFileSync(path.join(__dirname,'../auth-config.js'),'utf8').replace(/recoveryEnabled: [^\n]+/,'recoveryEnabled: false,');
    await page.route('**/auth-config.js',r=>r.fulfill({body:config,contentType:'text/javascript'}));await page.goto('http://localhost:5500/',{waitUntil:'domcontentloaded'});
    await page.locator('#inlineLoginForm').waitFor({state:'visible'});assert.equal(await page.locator('#inlineRecovery').count(),0);
    checks.push('motion and disabled flag');
  });
  await t.test('separate contact dialog verifies OTP without changing identifier or retaining secrets',async()=>{
    await page.route('**/contact-fixture',r=>r.fulfill({contentType:'text/html',body:'<button data-recovery-contact>Contact</button><script>window.RoutflexCore={api:{me:async()=>({user:{id:"fixture"},authenticationSessionId:"session"}),recoveryContactStatus:async()=>({verified:false}),recoveryContactRequest:async(email,currentPassword)=>({accepted:true,challengeId:"c".repeat(43)}),recoveryContactVerify:async(challengeId,code)=>({verified:code==="123456"})}}</script><link rel="stylesheet" href="/recovery-contact.css"><script src="/recovery-contact.js"></script>'}));
    await page.goto('http://localhost:5500/contact-fixture');await page.locator('[data-recovery-contact]').click();
    const d=page.locator('.recovery-contact-dialog');await d.locator('input[name=email]').fill('personal@example.test');await d.locator('input[name=password]').fill('test-only current password');
    await d.locator('[type=submit]').click();await d.locator('input[name=code]').waitFor({state:'visible'});
    assert.equal(await d.locator('input[name=password]').inputValue(),'');await d.locator('input[name=code]').fill('123456');await d.locator('[type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('.recovery-contact-dialog [type=submit]').hidden);
    await d.locator('[data-close]').click();assert.equal(await d.locator('input[name=email]').inputValue(),'');
    checks.push('contact enrollment UI contract');
  });
  assert.deepEqual(errors,[]);
  if(output)fs.writeFileSync(path.join(output,'browser-validation.json'),JSON.stringify({checks,errors,api:'intercepted fixtures',realEmailSent:false,realUserLogin:false},null,2));
});

