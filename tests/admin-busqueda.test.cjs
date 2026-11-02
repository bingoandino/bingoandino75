const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
const start=source.indexOf('// La búsqueda filtra únicamente inscripciones ya cargadas en el administrador.');
const end=source.indexOf('// Keep the administrator',start);
assert.ok(start>=0&&end>start,'No se encontró código de búsqueda');
const search=source.slice(start,end);

function setup(){
 const dom=new JSDOM(html,{url:'https://bingoandino75.com/',runScripts:'outside-only'});
 const w=dom.window;
 w.eval(search);
 const tbody=w.document.querySelector('#tabla-comprobantes tbody');
 const origen=w.document.getElementById('filtroOrigenSlot');
 const campo=w.document.getElementById('admin-buscar-texto');
 const tipo=w.document.getElementById('admin-buscar-tipo');
 const boton=w.document.getElementById('admin-buscar-boton');
 const clear=w.document.getElementById('admin-limpiar-busqueda');
 const result=w.document.getElementById('admin-buscar-resultado');
 function add({nombre,cedula,telefono,referencia,cartones,origenRegistro='compra',referido='',pago=''}){
  const tr=w.document.createElement('tr');
  tr.dataset.origenRegistro=origenRegistro;
  tr.dataset.busquedaNombre=w.normalizarBusquedaInscripciones(nombre);
  tr.dataset.busquedaCedula=w.normalizarBusquedaInscripciones(cedula);
  tr.dataset.busquedaTelefono=w.normalizarBusquedaInscripciones(telefono);
  tr.dataset.busquedaReferencia=w.normalizarBusquedaInscripciones(referencia);
  tr.dataset.busquedaReferido=w.normalizarBusquedaInscripciones(referido);
  tr.dataset.busquedaPago=w.normalizarBusquedaInscripciones(pago);
  tr.dataset.busquedaCartones=cartones.join(' ');
  tbody.appendChild(tr);
  return tr;
 }
 const ana=add({nombre:'María Pérez',cedula:'12.345.678',telefono:'0414-1234567',referencia:'1234',cartones:[3,120],origenRegistro:'compra'});
 const luis=add({nombre:'Luis García',cedula:'09876543',telefono:'04122222222',referencia:'8891',cartones:[12,36],origenRegistro:'soporte'});
 const bot=add({nombre:'Andrea Rodríguez',cedula:'22559911',telefono:'04245555555',referencia:'3344',cartones:[312],origenRegistro:'bot'});
 const regalo=add({nombre:'Carla',cedula:'333222111',telefono:'04120000000',referencia:'0000',cartones:[987],origenRegistro:'premio_slot'});
 return {w,dom,tbody,campo,tipo,boton,clear,origen,result,ana,luis,bot,regalo,
  search(q,field='todos'){campo.value=q;tipo.value=field;w.buscarInscripcionesAdmin();},
  count(){return tbody.querySelectorAll('tr:not([hidden])').length;},
  close(){dom.window.close();}};
}

test('Ventas incluye botón Buscar, Limpiar y selector accesible sin cambiar navegación',()=>{
 const f=setup();
 try{
  assert.ok(f.boton);
  assert.equal(f.boton.textContent.includes('Buscar'),true);
  assert.ok(f.clear);
  assert.equal(f.tipo.options.length,6);
  assert.equal(f.w.document.getElementById('form-buscar-inscripciones-admin').getAttribute('role'),'search');
  assert.ok(html.includes("admin-compacto.css?v=20261102-buscar-1"));
  assert.ok(html.includes("script.js?v=20261102-admin-buscar-1"));
 }finally{f.close();}
});
test('Busca por nombre con acentos, cédula, teléfono y referencia',()=>{
 const f=setup();
 try{
  f.search('maria','nombre');assert.equal(f.count(),1);assert.equal(f.ana.hidden,false);
  f.search('9876543','cedula');assert.equal(f.count(),1);assert.equal(f.luis.hidden,false);
  f.search('04245555','telefono');assert.equal(f.count(),1);assert.equal(f.bot.hidden,false);
  f.search('8891','referencia');assert.equal(f.count(),1);assert.equal(f.luis.hidden,false);
 }finally{f.close();}
});
test('Cartón busca número exacto: 12 no muestra 120 ni 312',()=>{
 const f=setup();
 try{
  f.search('12','carton');
  assert.equal(f.count(),1);
  assert.equal(f.luis.hidden,false);
  assert.equal(f.ana.hidden,true);
  assert.equal(f.bot.hidden,true);
  f.search('987','carton');
  assert.equal(f.count(),1);
  assert.equal(f.regalo.hidden,false);
 }finally{f.close();}
});
test('Búsqueda y filtro de origen se combinan; sin coincidencias muestra un aviso',()=>{
 const f=setup();
 try{
  f.search('luis','nombre');
  assert.equal(f.count(),1);
  f.origen.value='bot';f.w.filtrarOrigenInscripciones();
  assert.equal(f.count(),0);assert.match(f.result.textContent,/No se encontraron/);
  f.origen.value='soporte';f.w.filtrarOrigenInscripciones();
  assert.equal(f.count(),1);
  f.search('cuenta inexistente');
  assert.equal(f.count(),0);
  assert.match(f.result.textContent,/No se encontraron/);
 }finally{f.close();}
});
test('Limpiar restablece búsquedas, no borra compras ni elimina el filtro de origen',()=>{
 const f=setup();
 try{
  const old=f.tbody.querySelectorAll('tr').length;
  f.origen.value='compra';f.w.filtrarOrigenInscripciones();
  f.search('3344','referencia');
  assert.equal(f.count(),1);
  f.w.limpiarBusquedaInscripcionesAdmin();
  assert.equal(f.count(),3);
  assert.equal(f.campo.value,'');
  assert.equal(f.tipo.value,'todos');
  assert.equal(f.origen.value,'compra');
  assert.equal(f.tbody.querySelectorAll('tr').length,old);
 }finally{f.close();}
});
test('Después de una actualización de tabla, reaplica búsqueda sin modificar los estados',()=>{
 const f=setup();
 try{
  f.search('rodriguez','nombre');assert.equal(f.count(),1);
  // Reemplazo de filas análogo a cargarPanelAdmin().
  f.tbody.innerHTML='';
  const row=f.w.document.createElement('tr');
  row.dataset.busquedaNombre='andrea rodriguez';
  row.dataset.origenRegistro='bot';
  row.dataset.estadoActual='aprobado';
  f.tbody.appendChild(row);
  f.w.aplicarFiltrosInscripcionesAdmin();
  assert.equal(f.count(),1);
  assert.equal(row.dataset.estadoActual,'aprobado');
 }finally{f.close();}
});
test('Código de carga inicializa datos de búsqueda y reaplica filtros',()=>{
 assert.match(source,/tr\.dataset\.busquedaNombre = normalizarBusquedaInscripciones\(item\.nombre\)/);
 assert.match(source,/tr\.dataset\.busquedaCartones = .*item\.cartones/);
 assert.ok(source.includes('  aplicarFiltrosInscripcionesAdmin();\n  document.getElementById('));
});
