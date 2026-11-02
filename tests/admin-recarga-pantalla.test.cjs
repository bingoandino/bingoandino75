const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const script=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function extract(start,end){
 const a=script.indexOf(start),b=script.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'No se encontró la sección: '+start);
 return script.slice(a,b);
}
const init=extract('async function verificarSesionInicial()', '// ==================== FUNCIONES FALTANTES');
const tabs=extract('function cambiarTab(tabId)', '// ================== EXPORTAR FUNCIONES');
const panel=extract('async function mostrarPanelAdminSeguro(sessionToken)', '// Función para verificar OTP');
function mount({view='panel',valid=true,loadFails=false,paused=false}={}){
 const html=[
 '<section id="bienvenida"></section>',
 '<section id="admin-login" class="oculto"><input id="admin-email"></section>',
 '<section id="admin-panel" class="oculto">',
 '<h2>Administrador</h2><div id="admin-email-display"></div>',
 '<nav class="admin-tabs"><button class="tab-btn active" onclick="cambiarTab(\'tab-dashboard\')">Dashboard</button>',
 '<button class="tab-btn" onclick="cambiarTab(\'tab-ventas\')">Ventas</button></nav>',
 '<section id="tab-dashboard" class="tab-content active">Dashboard</section>',
 '<section id="tab-ventas" class="tab-content">Ventas</section>',
 '</section><section id="ganadores" class="oculto"></section>',
 '<section id="premios-pagados" class="oculto"></section>',
 '<div id="modal-terminos"></div><section id="otro-nested-section"></section>'
 ].join('');
 const dom=new JSDOM(html,{url:'https://bingoandino75.com',runScripts:'outside-only'});
 const w=dom.window;
 w.sessionStorage.setItem('admin_session_token','valid-session-stays-in-session-storage');
 w.sessionStorage.setItem('admin_email','admin@example.test');
 w.sessionStorage.setItem('admin_vista_panel_v1',view);
 w.sessionStorage.setItem('admin_tab_activa_v1','tab-ventas');
 let release;
 const gate=paused?new Promise(resolve=>release=resolve):Promise.resolve(valid);
 w.eval([
 'let sesionActiva=false,adminSession=null;',
 'async function verificarSesionAdmin(){window.verifyCalls++;return await window.sessionGate;}',
 'async function cargarPanelAdmin(){window.dataCalls++;if(window.loadFails)throw Error("red intermitente");}',
 'function activarRefrescoAutomaticoAdmin(){}',
 'function iniciarDetectorActividad(){}',
 'function resetInactivityTimer(){}',
 tabs,init,panel
 ].join('\n'));
 w.verifyCalls=0;w.dataCalls=0;w.sessionGate=gate;w.loadFails=loadFails;
 return {w,release,close:()=>dom.window.close()};
}
test('La sesión guardada restaura administrador y pestaña, aun con secciones anidadas visibles',async()=>{
 const f=mount();
 try{
  await f.w.verificarSesionInicial();
  const d=f.w.document;
  assert.equal(d.getElementById('admin-panel').classList.contains('oculto'),false);
  assert.equal(d.getElementById('bienvenida').classList.contains('oculto'),true);
  assert.equal(d.getElementById('tab-ventas').classList.contains('active'),true);
  assert.equal(d.getElementById('tab-dashboard').classList.contains('active'),false);
  assert.equal(f.w.verifyCalls,1);
  assert.equal(f.w.dataCalls,1);
  assert.equal(f.w.sessionStorage.getItem('admin_session_token'),'valid-session-stays-in-session-storage');
 }finally{f.close();}
});
test('Problema de red cargando datos no destruye una sesión confirmada',async()=>{
 const f=mount({loadFails:true});
 try{
  await f.w.verificarSesionInicial();
  assert.equal(f.w.document.getElementById('admin-panel').classList.contains('oculto'),false);
  assert.equal(f.w.sessionStorage.getItem('admin_session_token'),'valid-session-stays-in-session-storage');
 }finally{f.close();}
});
test('El administrador no aparece mientras el servidor no haya validado la sesión',async()=>{
 const f=mount({paused:true});
 try{
  const pending=f.w.verificarSesionInicial();
  assert.equal(f.w.document.getElementById('admin-panel').classList.contains('oculto'),true);
  f.release(true);await pending;
  assert.equal(f.w.document.getElementById('admin-panel').classList.contains('oculto'),false);
 }finally{f.close();}
});
test('Una sesión inválida no abre el administrador y borra su token',async()=>{
 const f=mount({valid:false});
 try{
  await f.w.verificarSesionInicial();
  assert.equal(f.w.document.getElementById('admin-panel').classList.contains('oculto'),true);
  assert.equal(f.w.sessionStorage.getItem('admin_session_token'),null);
 }finally{f.close();}
});
test('Una vista pública elegida se mantiene pública al recargar',async()=>{
 const f=mount({view:'publica'});
 try{
  await f.w.verificarSesionInicial();
  assert.equal(f.w.document.getElementById('admin-panel').classList.contains('oculto'),true);
  assert.equal(f.w.document.getElementById('bienvenida').classList.contains('oculto'),false);
 }finally{f.close();}
});
test('Entrar al panel guarda la preferencia inmediatamente sin clics en el logo',async()=>{
 const f=mount();
 try{
  f.w.sessionStorage.setItem('admin_vista_panel_v1','publica');
  await f.w.mostrarPanelAdminSeguro('valid-session-stays-in-session-storage');
  assert.equal(f.w.sessionStorage.getItem('admin_vista_panel_v1'),'panel');
  assert.equal(f.w.document.getElementById('admin-panel').classList.contains('oculto'),false);
 }finally{f.close();}
});
test('Pestañas sin event global, con preferencia guardada',async()=>{
 const f=mount();
 try{
  await f.w.verificarSesionInicial();
  f.w.cambiarTab('tab-dashboard');
  assert.equal(f.w.sessionStorage.getItem('admin_tab_activa_v1'),'tab-dashboard');
  f.w.cambiarTab('tab-ventas');
  assert.equal(f.w.sessionStorage.getItem('admin_tab_activa_v1'),'tab-ventas');
  assert.equal(f.w.document.querySelectorAll('.admin-tabs .tab-btn.active').length,1);
 }finally{f.close();}
});
test('Se renueva script sin modificar verificación OTP',()=>{
 assert.match(index,/script\.js\?v=20261102-admin-recarga-1/);
 assert.ok(script.includes('async function verificarOTP()'));
 assert.ok(script.includes('create_session_otp'));
 assert.ok(script.includes("sessionStorage.setItem('admin_vista_panel_v1','panel')"));
 assert.ok(script.includes("sessionStorage.removeItem('admin_vista_panel_v1')"));
});
