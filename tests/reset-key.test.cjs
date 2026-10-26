const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const owner={id:'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',email:'admin@example.invalid',email_confirmed_at:'2026-01-01'};
function edge({user=owner,otpError=null,gate={ok:true}}={}){
 let handler;const calls=[];let clients=0;
 const src=ts.transpileModule(read('supabase/functions/reset-key/index.ts').replace(/^import .*;$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const create=()=>{const id=++clients;return{auth:{getUser:async()=>({data:{user},error:null}),signInWithOtp:async args=>{calls.push(['mail',args]);return{error:null}},verifyOtp:async args=>{calls.push(['verify',args]);return{data:{user},error:otpError}}},rpc:async(name,args)=>{calls.push([name,args,id]);return{data:name==='rpc_reset_key_email_gate'?gate:null,error:null}}};};
 new Function('serve','createClient','Deno',src)(h=>handler=h,create,{env:{get:()=> 'test'}});
 return {calls,run:(body,bearer='test')=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)}))};
}
test('reset key: no anonymous or different-user access, even with arbitrary email',async()=>{
 for(const [user,bearer] of [[owner,null],[null,'test'],[{...owner,id:'other'},'test']]){const e=edge({user});const r=await e.run({action:'request',email:'attacker@example.invalid'},bearer);assert.equal(r.status,401);assert.equal(e.calls.length,0);}
});
test('reset key: OTP is sent only to the verified administrator email',async()=>{
 const e=edge();assert.equal((await e.run({action:'request',email:'attacker@example.invalid'})).status,200);const call=e.calls.find(c=>c[0]==='mail');assert.equal(call[1].email,owner.email);assert.equal(call[1].options.shouldCreateUser,false);
});
test('reset key: invalid/expired OTP and exhausted attempts cannot save key',async()=>{
 for(const opts of [{otpError:{message:'expired'}},{gate:{ok:false,error:'limit'}}]){const e=edge(opts);const r=await e.run({action:'save',code:'123456',key:'Ficticia-para-test'});assert.ok(r.status>=400);assert.equal(e.calls.some(c=>c[0]==='rpc_guardar_clave_reinicio'),false);}
});
test('reset key: password changes only after OTP, using isolated service client',async()=>{
 const e=edge();const r=await e.run({action:'save',code:'123456',key:'Ficticia-para-test'});assert.equal(r.status,200);assert.deepEqual(e.calls.map(c=>c[0]),['rpc_reset_key_email_gate','verify','rpc_guardar_clave_reinicio']);assert.equal(e.calls.at(-1)[2],1);assert.equal((await r.text()).includes('Ficticia'),false);
});
async function ui(configured=true){
 const w=new JSDOM('<head></head><body><div id="admin-panel"></div></body>',{runScripts:'outside-only',url:'https://example.test'}).window;
 const calls=[];w.TextEncoder=TextEncoder;w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.alert=()=>{};w.confirm=()=>false;
 w.supabase={auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},rpc:async(name,args)=>{calls.push([name,args]);return{data:name==='rpc_estado_clave_reinicio'?configured:{ok:false,error:'Clave incorrecta'},error:null}}};
 w.fetch=async(url,args)=>{calls.push(['fetch',JSON.parse(args.body)]);return{ok:true,json:async()=>({ok:true,message:'Listo'})}};
 w.eval(read('reset-key.js'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));return{w,calls};
}
test('reset UI: no automatic OTP request, private fields and no persisted password',async()=>{
 const {w,calls}=await ui();try{assert.equal(calls.length,0);const box=w.document.querySelector('details');assert.ok(box);box.querySelector('button').click();await new Promise(r=>setImmediate(r));assert.equal(calls[0][1].action,'request');assert.equal(box.querySelectorAll('input[type=password]').length,2);assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);}finally{w.close();}
});
test('reset UI: unconfigured key opens settings; cancellation does not reset',async()=>{
 const first=await ui(false);try{await first.w.reiniciarTodo();assert.equal(first.w.document.querySelector('details').open,true);assert.equal(first.calls.length,1);}finally{first.w.close();}
 const {w,calls}=await ui();try{await w.reiniciarTodo();const form=w.document.querySelector('dialog form');form.querySelector('input').value='Ficticia-para-test';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(calls.length,1);}finally{w.close();}
});
test('reset UI: failed reset displays server error, clears secret and prevents duplicate requests',async()=>{
 const {w,calls}=await ui();try{w.confirm=()=>true;await w.reiniciarTodo();const form=w.document.querySelector('dialog form');form.querySelector('input').value='Ficticia-para-test';form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(calls.filter(c=>c[0]==='rpc_reiniciar_sorteo_con_clave').length,1);assert.match(form.textContent,/Clave incorrecta/);assert.equal(form.querySelector('input').value,'');assert.equal(w.localStorage.length,0);}finally{w.close();}
});
