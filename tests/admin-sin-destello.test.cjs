const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const script=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=script.indexOf("window.addEventListener('DOMContentLoaded', async () => {");
const end=script.indexOf('async function obtenerTotalCartones()',start);
assert.ok(start>=0&&end>start);
const init=script.slice(start,end);

async function flush(){await new Promise(resolve=>setTimeout(resolve,20));}
function sessionRefresh({restoreAdmin=true}={}){
 const dom=new JSDOM([
  '<div id="overlay-carga" style="display:flex"></div>',
  '<div id="modal-terminos" class="oculto"></div>',
  '<section id="bienvenida"></section>',
  '<section id="admin-panel" class="oculto"></section>'
 ].join(''),{url:'https://bingoandino75.com',runScripts:'outside-only'});
 const w=dom.window;
 if(restoreAdmin){
  w.sessionStorage.setItem('admin_session_token','sesion-test');
  w.sessionStorage.setItem('admin_vista_panel_v1','panel');
 }
 let completeVerification,verifying=false;
 const gate=new Promise(resolve=>{completeVerification=resolve;});
 const methods=[
 'obtenerTotalCartones','cargarLinkWhatsapp','cargarVersionCartones',
 'cargarDatosClienteLocal','activarProgresoCartonesRealtime','generarCartones',
 'cargarBarraProgresoInicio','cargarConfigBarraProgresoAdmin',
 'cargarImagenPremiosInicio','cargarPrecioPorCarton',
 'cargarConfiguracionModoCartones','cargarPromocionesConfig',
 'abrirEnlaceListaAprobados'
 ];
 for(const method of methods)w[method]=async()=>{};
 w.verificarSesionInicial=async()=>{
  verifying=true;
  await gate;
  if(restoreAdmin){
   w.document.getElementById('bienvenida').classList.add('oculto');
   w.document.getElementById('admin-panel').classList.remove('oculto');
  }
 };
 w.eval('var sistemaListo=false;\n'+init);
 return {w,dom,done:()=>completeVerification(),verifying:()=>verifying,close:()=>dom.window.close()};
}
test('Mientras el servidor verifica sesión, la bienvenida queda cubierta por pantalla de carga',async()=>{
 const f=sessionRefresh();
 try{
  f.w.dispatchEvent(new f.w.Event('DOMContentLoaded'));
  await flush();
  assert.equal(f.verifying(),true);
  assert.equal(f.w.document.getElementById('overlay-carga').style.display,'flex');
  assert.equal(f.w.document.getElementById('admin-panel').classList.contains('oculto'),true);
  f.done();await flush();
  assert.equal(f.w.document.getElementById('bienvenida').classList.contains('oculto'),true);
  assert.equal(f.w.document.getElementById('admin-panel').classList.contains('oculto'),false);
  assert.equal(f.w.document.getElementById('overlay-carga').style.display,'none');
 }finally{f.close();}
});
test('Un visitante sin sesión también puede ver Inicio tras cargar',async()=>{
 const f=sessionRefresh({restoreAdmin:false});
 try{
  f.w.dispatchEvent(new f.w.Event('DOMContentLoaded'));await flush();
  // Para visitantes no se retrasa la pantalla principal.
  assert.equal(f.w.document.getElementById('overlay-carga').style.display,'none');
  f.done();await flush();
  assert.equal(f.w.document.getElementById('overlay-carga').style.display,'none');
  assert.equal(f.w.document.getElementById('bienvenida').classList.contains('oculto'),false);
 }finally{f.close();}
});
test('La verificación siempre precede al cierre de pantalla de carga',()=>{
 const verify=init.indexOf('await verificarSesionInicial()');
 const finallyHide=init.lastIndexOf("overlayInicio.style.display = 'none'");
 assert.ok(verify>=0&&finallyHide>verify);
 assert.match(init,/finally\s*\{/);
 assert.match(html,/script\.js\?v=20261102-admin-buscar-1/);
 assert.match(html,/background: linear-gradient\(145deg, #25102f, #441857\)/);
});
