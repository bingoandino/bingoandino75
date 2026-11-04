const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {webcrypto,TextEncoder}=require('node:util');
const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/slot-fidelidad/index.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},
 reportDiagnostics:true});
const admin='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',sid='10000000-0000-4000-8000-000000000001';
const proof='a'.repeat(64);
const tokenPayload=claims=>'header.'+Buffer.from(JSON.stringify({
 sub:admin,role:'authenticated',session_id:sid,...claims
})).toString('base64url')+'.signature';

function setup({claims={},state,denyAuth=false}={}){
 const calls=[],key='service-example-secret',base='https://example.supabase.co';
 let handler;
 const fetcher=async(url,opt={})=>{
  calls.push({url,method:opt.method||'GET'});
  if(url.endsWith('/auth/v1/user'))return Response.json(denyAuth?{error:'Unauthorized'}:
   {id:admin,email_confirmed_at:'2026-10-25T00:00:00Z'},{status:denyAuth?401:200});
  if(url.includes('/rest/v1/slot_accesos'))return Response.json([
   {auth_session_id:sid,authorized_until:'2099-01-01T00:00:00Z'}]);
  if(url.endsWith('/rest/v1/rpc/fidelidad_estado'))return Response.json(state||{
   ready:true,fecha:'2026-10-31',participants:[
    {cedula:'12345678',name:'Ana Pérez',ticket:123},
    {cedula:'87654321',name:'Zoe Pérez',ticket:456}
   ],winners:[],cantidad:2});
  if(url.endsWith('/rest/v1/rpc/fidelidad_girar'))return Response.json({
   drawId:'10000000-0000-4000-8000-000000000002',
   name:'Ana Pérez',ticket:123,prize:'Premio fidelidad'});
  throw new Error('Unexpected mock URL '+url);
 };
 const env={SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:key};
 const sandbox={Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},
  fetch:fetcher,crypto:require('node:crypto').webcrypto,TextEncoder,
  Response,console,atob,Date};
 vm.runInNewContext(compiled.outputText,sandbox,{filename:'slot-fidelidad/index.ts'});
 const req=(action='estado',{origin='https://bingoandino75.com',access=true}={})=>
  new Request('https://example.supabase.co/functions/v1/slot-fidelidad',
   {method:'POST',headers:{Origin:origin,...(access?{Authorization:'Bearer '+tokenPayload(claims)}:{})},
    body:JSON.stringify({action,sabado:'2026-10-31',slotAccess:proof,drawId:'10000000-0000-4000-8000-000000000002',premio:'Premio fidelidad'})});
 return {handler,req,calls};
}
test('Edge Fidelidad: TS compila sin diagnósticos sintácticos',()=>{
 const diagnostics=(compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.deepEqual(diagnostics.map(d=>d.messageText),[]);
});
test('Edge Fidelidad: autenticación requerida, sin lectura privada si no hay sesión',async()=>{
 const f=setup();
 const r=await f.handler(f.req('estado',{access:false}));
 assert.equal(r.status,401);
 assert.equal(f.calls.length,0);
});
test('Edge Fidelidad: no filtra cédulas a la pantalla y solo acepta origen autorizado',async()=>{
 const f=setup();
 const r=await f.handler(f.req());
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.ready,true);
 assert.equal(data.participants.length,2);
 assert.ok(data.participants.every(p=>p.personId.length===64));
 assert.equal(JSON.stringify(data).includes('12345678'),false);
 assert.equal(JSON.stringify(data).includes('87654321'),false);
 assert.equal(f.calls.some(x=>x.url.includes('rpc/fidelidad_estado')),true);
 const blocked=await f.handler(f.req('estado',{origin:'https://sitiomalicioso.example'}));
 assert.equal(blocked.status,403);
});
test('Edge Fidelidad: el giro solo va a su RPC, sin llamar compras/pagos ni slot anterior',async()=>{
 const f=setup();
 const r=await f.handler(f.req('girar'));
 assert.equal(r.status,200);
 assert.equal((await r.json()).winner.name,'Ana Pérez');
 assert.equal(f.calls.some(x=>x.url.endsWith('rpc/fidelidad_girar')),true);
 assert.equal(f.calls.some(x=>/slot_asignar_premios|inscripciones|pagos_sincronizar/.test(x.url)),false);
});
