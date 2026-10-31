import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('OTP reissue preserves password challenge, throttles resends, verifies once and explains invalid codes in Spanish',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage,oldNow=Date.now;let clock=oldNow(),calls=[],bad=true;const m=new Map();
 Date.now=()=>clock;globalThis.sessionStorage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 globalThis.fetch=async(url,options)=>{const b=JSON.parse(options.body);calls.push({url,b});
 if(b.action==='password-check')return Response.json({passwordProof:'proof',expiresAt:new Date(clock+600000).toISOString()});
 if(url.endsWith('/otp'))return Response.json({});
 if(url.endsWith('/verify'))return bad?Response.json({code:'otp_expired',msg:'Token has expired or is invalid'},{status:403}):Response.json({user:{id:'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5'},access_token:'fake',refresh_token:'fake',expires_in:3600});
 if(b.action==='authorize')return Response.json({authorizedUntil:new Date(clock+3600000).toISOString()});
 throw Error('Unexpected request');};
 try{
 let source=await readFile(new URL('../slot/auth.js',import.meta.url),'utf8');source=source.replace(/^import .*config.js';/m,"const SUPABASE_URL='https://test.supabase.co',PUBLIC_KEY='public',API_URL=SUPABASE_URL+'/slot-premios';");
 const auth=await import('data:text/javascript;base64,'+Buffer.from(source+'\n//retry-test').toString('base64'));
 await Promise.all([auth.startLogin('ADMIN@example.org','correct'),auth.startLogin('ADMIN@example.org','correct')]);assert.equal(calls.filter(c=>c.b.action==='password-check').length,1);
 await assert.rejects(()=>auth.resendCode('admin@example.org'),/Espera un minuto/);
 await assert.rejects(()=>auth.verifyCode('admin@example.org','abc123'),/6 números/);
 await assert.rejects(()=>auth.verifyCode('other@example.org','000001'),/mismo correo/);
 await assert.rejects(()=>auth.verifyCode('admin@example.org','000001'),/Enviar nuevo código/);assert.equal(calls.at(-1).b.token,'000001');assert.equal(auth.hasSession(),false);
 clock+=61000;await Promise.all([auth.resendCode('admin@example.org'),auth.resendCode('admin@example.org')]);assert.equal(calls.filter(c=>c.url.endsWith('/otp')).length,2);assert.equal(calls.filter(c=>c.b.action==='password-check').length,1);
 bad=false;const n=calls.length;await Promise.all([auth.verifyCode('admin@example.org','000002'),auth.verifyCode('admin@example.org','000002')]);assert.equal(calls.length-n,2);assert.equal(auth.hasSession(),true);
 await auth.startLogin('admin@example.org','correct');clock+=600001;await assert.rejects(()=>auth.resendCode('admin@example.org'),/verificación venció/);
 }finally{globalThis.fetch=oldFetch;globalThis.sessionStorage=oldStorage;Date.now=oldNow;}
});
