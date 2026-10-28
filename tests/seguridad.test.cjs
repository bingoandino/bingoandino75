const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const{JSDOM}=require('jsdom');const ts=require('typescript');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');const main=read('script.js');const utility=main.slice(0,main.indexOf('var supabase'));
test('un nombre malicioso se muestra como texto en la fila real del administrador',()=>{
 const w=new JSDOM('<table><tbody><tr id="fila"></tr></tbody></table>',{runScripts:'dangerously',url:'https://example.test'}).window;
 try{w.eval(utility);w.item={id:1,nombre:'<img src=x onerror="window.ataque=1">',telefono:"');window.ataque=2;//",cedula:'00000000',referido:'<svg onload="window.ataque=3">',cartones:[1],estado:'pendiente',comprobante:'javascript:window.ataque=4',pago_banco:"');window.ataque=5;//"};w.buildWhatsAppLink=()=> 'https://wa.me/580000000000';w.copiarPagoMovil=()=>{};w.tr=w.document.getElementById('fila');
  const start=main.indexOf('    tr.innerHTML = `',main.indexOf('async function cargarPanelAdmin()'));const end=main.indexOf('    const btnAprobar',start);w.eval(main.slice(start,end));
  assert.equal(w.document.querySelector('img[src="x"]'),null);assert.equal(w.document.querySelector('svg'),null);assert.match(w.tr.textContent,/<img src=x/);assert.equal(w.ataque,undefined);assert.equal(w.document.querySelector('[onclick]'),null);assert.equal(w.document.querySelector('img').getAttribute('src'),'');
 }finally{w.close();}
});
test('lista pública y Top muestran los nombres sin ejecutar HTML',async()=>{
 const w=new JSDOM('<div id="contenedor-aprobados"></div><div id="listaTopCompradores"></div>',{runScripts:'dangerously',url:'https://example.test'}).window;
 try{w.eval(utility);w.supabase={rpc:async name=>({data:[{nombre:'<img src=x onerror="window.ataque=1">',cedula:'****0000',cartones:[1],total:1}]})};w.eval(main.slice(main.indexOf('async function cargarListaAprobadosSeccion()'),main.indexOf('function actualizarHoraVenezuela()')));await w.cargarListaAprobadosSeccion();
  w.eval(main.slice(main.indexOf('async function cargarTopCompradores()'),main.indexOf('let canalTopCompradores')));await w.cargarTopCompradores();assert.equal(w.document.querySelector('img'),null);assert.equal(w.document.querySelector('svg'),null);assert.equal(w.ataque,undefined);
 }finally{w.close();}
});
function edge(slug,user){let handler,writes=0,reads=0;let src=read('supabase/functions/'+slug+'/index.ts').replace(/^import .*;$/gm,'');src=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const client={rpc:async(name,args)=>{assert.equal(name,'admin_abrir_sesion');assert.equal(args._device_id,'ficticio');assert.equal(args._authentication,'otp');writes++;return {data:{sessionToken:'sess-ficticia',expiresAt:new Date(Date.now()+7200000).toISOString(),deviceId:args._device_id},error:null}},auth:{getUser:async()=>({data:{user},error:user?null:{message:'No autorizado'}})},from:()=>({select(){reads++;return this},eq(){return this},single:async()=>({data:null}),maybeSingle:async()=>({data:null}),then(resolve){return Promise.resolve({data:[]}).then(resolve)},upsert:async()=>{writes++;return{error:null}},update(){writes++;return this},insert(){writes++;return this}})};
 new Function('serve','createClient','Deno','encodeHex',src)(h=>handler=h,()=>client,{env:{get:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'FICTICIA'}[k])}},bytes=>Buffer.from(bytes).toString('hex'));
 return{run:(body,token)=>handler(new Request('https://example.invalid/',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})),stats:()=>({reads,writes})};
}
for(const slug of ['admin-auth','create-session','verify-session','update-session'])test(slug+': una petición sin un usuario administrador verificado no modifica sesiones',async()=>{
 for(const user of [null,{id:'00000000-0000-0000-0000-000000000001',email:'otro@example.invalid',email_confirmed_at:'2026-01-01'}]){const e=edge(slug,user);const r=await e.run({email:'owner@example.invalid',deviceId:'ficticio',action:'create_session_otp'},user?'jwt-ficticio':null);assert.equal(r.status,401);assert.equal(e.stats().writes,0);}
});
test('un administrador verificado sí puede crear su sesión interna después del OTP',async()=>{
 const e=edge('admin-auth',{id:'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',email:'owner@example.invalid',email_confirmed_at:'2026-01-01'});const r=await e.run({email:'owner@example.invalid',deviceId:'ficticio',action:'create_session_otp'},'jwt-ficticio');assert.equal(r.status,200);assert.equal(e.stats().writes,1);
});
test('la credencial de reserva se añade al RPC y al envío sin cambiar lecturas ni publicarla en la URL',async()=>{
 const w=new JSDOM('',{runScripts:'outside-only',url:'https://example.test'}).window;const requests=[];
 try{const builder=()=>({setHeader(k,v){requests.push({k,v});return this;}});w.supabase={auth:{},rpc:()=>builder(),from:()=>({select:()=>42,insert:()=>builder()})};w.eval(read('referencia.js').split('(function (global) {')[0]);w.supabase.rpc('rpc_reservar_carton',{_numero:1});w.supabase.from('inscripciones').insert([{}]);assert.equal(requests.length,2);assert.equal(requests[0].k,'x-bingo-reserva');assert.equal(requests[0].v,requests[1].v);assert.equal(w.supabase.from('inscripciones').select(),42);assert.equal(w.location.href,'https://example.test/');assert.ok(w.sessionStorage.getItem('bingo_reserva_credencial_v1'));}finally{w.close();}
});

