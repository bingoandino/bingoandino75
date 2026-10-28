const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
const source=fs.readFileSync('script.js','utf8');
function setup({token='ficticio',view}={}){
 const d=new JSDOM('<div id="modal-terminos"></div><section id="bienvenida"></section><section id="usuario" class="oculto"></section><section id="ganadores" class="oculto"></section><section id="admin-panel" class="oculto"><span id="admin-email-display"></span></section><section id="admin-login" class="oculto"></section>',{url:'https://bingoandino75.com',runScripts:'outside-only'}),w=d.window;
 w.console.log=()=>{};w.console.error=()=>{};w.scrollTo=()=>{};w.requestAnimationFrame=fn=>fn();
 w.eval('var sesionActiva=false,adminSession=null,sistemaListo=true;');for(const f of ['cargarPanelAdmin','activarRefrescoAutomaticoAdmin','iniciarDetectorActividad','resetInactivityTimer'])w[f]=async()=>{};
 if(token)w.sessionStorage.setItem('admin_session_token',token);w.sessionStorage.setItem('admin_email','prueba@example.invalid');if(view)w.sessionStorage.setItem('admin_vista_panel_v1',view);
 w.eval(source.slice(source.indexOf('async function verificarSesionInicial()'),source.indexOf('// ==================== FUNCIONES FALTANTES')));
 w.eval(source.slice(source.indexOf('function mostrarSeccion(id)'),source.indexOf('async function cargarListaAprobadosSeccion')));
 w.eval(source.slice(source.indexOf('// Keep the administrator\'s view')));
 return {d,w};
}
const visible=(w,id)=>!w.document.getElementById(id).classList.contains('oculto');
test('recarga vuelve al panel solo después de validar la sesión y conserva el mismo token',async()=>{
 const {w}=setup();try{let finish;w.verificarSesionAdmin=()=>new Promise(r=>finish=r);const restoring=w.verificarSesionInicial();assert.equal(visible(w,'admin-panel'),false);finish(true);await restoring;assert.equal(visible(w,'admin-panel'),true);assert.equal(visible(w,'bienvenida'),false);assert.equal(w.sessionStorage.getItem('admin_session_token'),'ficticio');assert.equal(w.document.getElementById('modal-terminos').classList.contains('oculto'),true);}finally{w.close()}
});
test('una marca local no abre el panel con sesión inválida, vencida o sin token',async()=>{
 for(const token of ['ficticio',null]){const {w}=setup({token,view:'panel'});try{w.verificarSesionAdmin=async()=>false;await w.verificarSesionInicial();assert.equal(visible(w,'admin-panel'),false);if(token)assert.equal(w.sessionStorage.getItem('admin_session_token'),null);}finally{w.close()}}
});
test('la navegación pública elegida durante la verificación tardía no se reemplaza por el panel',async()=>{
 const {w}=setup({view:'panel'});try{let finish;w.verificarSesionAdmin=()=>new Promise(r=>finish=r);const restoring=w.verificarSesionInicial();w.mostrarSeccion('usuario');finish(true);await restoring;assert.equal(visible(w,'usuario'),true);assert.equal(visible(w,'admin-panel'),false);assert.equal(w.sessionStorage.getItem('admin_vista_panel_v1'),'publica');}finally{w.close()}
});
test('una pestaña que volvió voluntariamente al inicio conserva esa elección al actualizar',async()=>{
 const {w}=setup({view:'publica'});try{w.verificarSesionAdmin=async()=>true;await w.verificarSesionInicial();assert.equal(visible(w,'bienvenida'),true);assert.equal(visible(w,'admin-panel'),false);assert.equal(w.sesionActiva,true);}finally{w.close()}
});
test('pagehide recuerda panel o vista pública, sin borrar la sesión ni cambiar su token',async()=>{
 const {w}=setup();try{w.verificarSesionAdmin=async()=>true;await w.verificarSesionInicial();w.dispatchEvent(new w.Event('pagehide'));assert.equal(w.sessionStorage.getItem('admin_vista_panel_v1'),'panel');w.mostrarSeccion('bienvenida');w.dispatchEvent(new w.Event('pagehide'));assert.equal(w.sessionStorage.getItem('admin_vista_panel_v1'),'publica');assert.equal(w.sessionStorage.getItem('admin_session_token'),'ficticio');w.sessionStorage.removeItem('admin_session_token');w.dispatchEvent(new w.Event('pagehide'));assert.equal(w.sessionStorage.getItem('admin_vista_panel_v1'),null);}finally{w.close()}
});
