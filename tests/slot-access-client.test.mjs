import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('client enforces password -> email OTP -> server authorization and preserves grant during refresh',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage;
 const map=new Map([['andino_slot_auth_v1','old-email-only-session']]),calls=[];let accepted=false;
 globalThis.sessionStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 globalThis.fetch=async(url,options)=>{
  const b=JSON.parse(options.body);calls.push({url,b});
  if(url.endsWith('/slot-premios')){if(b.action==='password-check')return Response.json(b.password==='correct'?{passwordProof:'a'.repeat(64)}:{error:'incorrecta'},{status:b.password==='correct'?200:401});if(b.action==='authorize'){assert.equal(b.passwordProof,'a'.repeat(64));accepted=true;return Response.json({authorizedUntil:new Date(Date.now()+3600000).toISOString()})}assert.equal(b.slotAccess,'a'.repeat(64));if(b.action==='sign-out')return Response.json({signedOut:true});assert.ok(accepted);return Response.json({ok:true});}
  if(url.endsWith('/otp'))return Response.json({});
  if(url.includes('/token?'))return Response.json({access_token:'refreshed',refresh_token:'refresh2',expires_in:3600});
  if(url.endsWith('/verify'))return Response.json({access_token:'jwt',refresh_token:'refresh',expires_in:1,user:{id:'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5'}});
  throw Error(url);
 };
 try{
  let source=await readFile(new URL('../slot/auth.js',import.meta.url),'utf8');source=source.replace(/^import .*config.js';/m,"const SUPABASE_URL='https://test.supabase.co',PUBLIC_KEY='public',API_URL=SUPABASE_URL+'/slot-premios';");
  const auth=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(map.has('andino_slot_auth_v1'),false);assert.equal(auth.hasSession(),false);
  await assert.rejects(()=>auth.verifyCode('admin@example.org','123456'));assert.equal(calls.length,0);
  await assert.rejects(()=>auth.startLogin('admin@example.org','wrong'));assert.equal(calls.length,1);assert.equal(calls[0].b.action,'password-check');
  await auth.startLogin('admin@example.org','correct');assert.equal(calls[1].b.action,'password-check');assert.ok(calls[2].url.endsWith('/otp'));
  await auth.verifyCode('admin@example.org','123456');assert.ok(calls[3].url.endsWith('/verify'));assert.equal(calls[4].b.action,'authorize');assert.equal(auth.hasSession(),true);
  await auth.api('history');assert.ok(calls[5].url.includes('/token?'));assert.equal(calls[6].b.slotAccess,'a'.repeat(64));assert.equal(calls[6].b.action,'history');
  await auth.endSession();assert.equal(calls.at(-1).b.action,'sign-out');assert.equal(auth.hasSession(),false);assert.equal(map.has('andino_slot_auth_v2'),false);
 }finally{globalThis.fetch=oldFetch;if(oldStorage===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=oldStorage;}
});
