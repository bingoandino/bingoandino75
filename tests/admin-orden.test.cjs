const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
const source=fs.readFileSync('script.js','utf8');
const row=(id,estado,nombre,cedula,ref,origen='compra')=>({id,estado,nombre,cedula,referencia4dig:ref,origen_registro:origen,cartones:[id],telefono:'04121234567',comprobante:'https://example.test/receipt',pago_banco:'0105',pago_telefono:'04121234567',pago_cedula:cedula});
function setup(){
 const d=new JSDOM('<select id="filtroOrigenSlot"><option value="todos">Todas</option><option value="bot">Bot</option><option value="compra">Compras</option></select><table id="tabla-comprobantes"><tbody></tbody></table><span id="contador-clientes"></span><span id="contadorCartones"></span><span id="pendientes-count"></span>',{url:'https://bingoandino75.com',runScripts:'outside-only'}),w=d.window;
 let data=[row(3,'aprobado','Zeta','300','9000'),row(2,'pendiente','Ana','100','2000','bot'),row(1,'rechazado','Beta','200','4000')],pending=null;
 w.eval(source.slice(0,source.indexOf('var supabase')));w.eval('var totalCartones=100,cartonesOcupados=[];');for(const n of ['obtenerTotalCartones','obtenerMontoTotalRecaudado','contarCartonesVendidos','cargarModoCartonesAdmin','cargarPromocionesAdmin'])w[n]=async()=>{};w.fetchTodosLosOcupados=async()=>[];
 w.supabase={from:()=>({select(){return this},order:()=>pending||Promise.resolve({data,error:null})})};w.buildWhatsAppLink=()=> 'https://wa.me/580000000000';w.copies=0;w.copiarPagoMovil=()=>w.copies++;
 w.eval(source.slice(source.indexOf('async function cargarPanelAdmin()'),source.indexOf("document.getElementById('btn-recargar-panel')")));
 w.eval(source.slice(source.indexOf('function ordenarPendientesArriba()'),source.indexOf('async function aprobarInscripcion(')));
 w.eval(source.slice(source.indexOf('function ordenarInscripcionesPorNombre()'),source.indexOf('function buildWhatsAppLink(')));
 w.eval(source.match(/^function coincideOrigenInscripcion.*$/m)[0]);
 return {w,set:v=>data=v,defer:()=>new Promise(done=>{pending=new Promise(resolve=>done(()=>{pending=null;resolve({data,error:null})}));})};
}
const names=w=>Array.from(w.document.querySelectorAll('tbody tr'),r=>r.cells[0].childNodes[0].textContent.trim());
test('pendientes permanece arriba tras nuevas compras y cambios de aprobación; filtros y botones siguen funcionando',async()=>{
 const {w,set}=setup();try{await w.cargarPanelAdmin();assert.deepEqual(names(w),['Zeta','Ana','Beta']);w.ordenarPendientesArriba();assert.deepEqual(names(w),['Ana','Beta','Zeta']);w.document.getElementById('filtroOrigenSlot').value='bot';
 set([row(4,'pendiente','Nueva','400','3000','bot'),row(3,'aprobado','Zeta','300','9000'),row(2,'aprobado','Ana','100','2000','bot'),row(1,'rechazado','Beta','200','4000')]);
 await w.cargarPanelAdmin();assert.deepEqual(names(w),['Nueva','Beta','Zeta','Ana']);assert.deepEqual(Array.from(w.document.querySelectorAll('tbody tr')).filter(r=>!r.hidden).map(r=>r.cells[0].childNodes[0].textContent.trim()),['Nueva','Ana']);
 assert.equal(w.document.getElementById('pendientes-count').textContent,'1');w.document.querySelector('.btn-copiar-pago').click();assert.equal(w.copies,1);
 await w.cargarPanelAdmin();assert.deepEqual(names(w),['Nueva','Beta','Zeta','Ana']);
 }finally{w.close()}
});
test('nombre, cédula y referencia conservan la dirección al reconstruir la tabla; solo otro clic invierte',async()=>{
 for(const mode of ['nombre','cedula','referencia']){const {w}=setup();try{await w.cargarPanelAdmin();const sort=mode==='nombre'?w.ordenarInscripcionesPorNombre:mode==='cedula'?w.ordenarPorCedula:w.ordenarPorReferencia;sort();const first=names(w);await w.cargarPanelAdmin();assert.deepEqual(names(w),first);await w.cargarPanelAdmin();assert.deepEqual(names(w),first);if(mode!=='nombre'){sort();assert.deepEqual(names(w),[...first].reverse());await w.cargarPanelAdmin();assert.deepEqual(names(w),[...first].reverse());}}finally{w.close()}}
});
test('una selección realizada mientras llega la actualización se aplica al resultado nuevo',async()=>{
 const {w,set,defer}=setup();try{await w.cargarPanelAdmin();const finish=await defer();const loading=w.cargarPanelAdmin();w.ordenarPendientesArriba();set([row(5,'aprobado','Reciente','500','5000'),row(4,'pendiente','Por verificar','400','4000')]);finish();await loading;assert.deepEqual(names(w),['Por verificar','Reciente']);}finally{w.close()}
});
