const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('script.js','utf8');
function fixture(rows,{failPage=0}={}) {
 const w=new JSDOM('<button id="btnDupReferenciaAprobados">Referencias</button><div id="duplicadosAprobadosResultado"></div>',{runScripts:'outside-only'}).window;
 const calls=[];w.console.error=()=>{};w.alert=()=>{};w.escaparHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 w.solicitudEstadoAdmin=async q=>q;
 w.supabase={from(){let after=0,state=null;const q={select(){return q;},gt(_,value){after=value;return q;},order(){return q;},limit(){return q;},eq(_,value){state=value;return q;},then(resolve,reject){calls.push({after,state});return Promise.resolve(calls.length===failPage?{error:{message:'offline'}}:{data:rows.filter(r=>r.id>after&&(!state||r.estado===state)).slice(0,500)}).then(resolve,reject);}};return q;}};
 w.eval(source.slice(source.indexOf('function normalizarNombre('),source.indexOf('function imprimirLista(')));
 return {w,calls,get result(){return w.document.getElementById('duplicadosAprobadosResultado');},close:()=>w.close()};
}
const row=(id,ref,estado)=>({id,referencia4dig:ref,estado,nombre:'Cliente '+id,cedula:'12345678',cartones:[id]});
test('una referencia repetida entre verificada y pendiente muestra ambas compras y sus estados',async()=>{
 const f=fixture([row(1,'0042','aprobado'),row(2,'0042','pendiente'),row(3,'8765','pendiente')]);try{await f.w.detectarDuplicadosAprobadosPorReferencia();assert.equal(f.result.querySelectorAll('.persona-item').length,2);assert.match(f.result.textContent,/Verificada/);assert.match(f.result.textContent,/Pendiente de verificación/);assert.equal(f.calls[0].state,null);}finally{f.close();}
});
test('también agrupa dos pendientes y muestra rechazadas con su estado real',async()=>{
 const f=fixture([row(1,'4444','pendiente'),row(2,'4444','pendiente'),row(3,'4444','rechazado')]);try{await f.w.detectarDuplicadosAprobadosPorReferencia();assert.equal(f.result.querySelectorAll('.persona-item').length,3);assert.match(f.result.textContent,/Rechazada/);}finally{f.close();}
});
test('encuentra coincidencias después de mil compras sin perder páginas',async()=>{
 const rows=Array.from({length:1101},(_,i)=>row(i+1,String(i+1000),'pendiente'));rows[0].referencia4dig='9999';rows[1100].referencia4dig='9999';rows[1100].estado='aprobado';const f=fixture(rows);try{await f.w.detectarDuplicadosAprobadosPorReferencia();assert.equal(f.calls.length,3);assert.equal(f.result.querySelectorAll('.persona-item').length,2);assert.match(f.result.textContent,/Cliente 1101/);}finally{f.close();}
});
test('compara los últimos cuatro dígitos de referencias antiguas completas y conserva ceros',async()=>{
 const f=fixture([row(1,'0012340042','aprobado'),row(2,'0042','pendiente'),row(3,'','pendiente')]);try{await f.w.detectarDuplicadosAprobadosPorReferencia();assert.match(f.result.textContent,/Referencia: 0042/);assert.equal(f.result.querySelectorAll('.persona-item').length,2);}finally{f.close();}
});
test('un fallo al leer una página no se presenta como una búsqueda sin duplicados',async()=>{
 const f=fixture(Array.from({length:501},(_,i)=>row(i+1,'0001','pendiente')),{failPage:2});try{await f.w.detectarDuplicadosAprobadosPorReferencia();assert.match(f.result.textContent,/No se pudo completar/);assert.doesNotMatch(f.result.textContent,/No se encontraron duplicados/);assert.equal(f.w.document.getElementById('btnDupReferenciaAprobados').disabled,false);}finally{f.close();}
});
test('la búsqueda por nombre incluye todos los estados y normaliza tildes y espacios',async()=>{
 const rows=[row(1,'0001','pendiente'),row(2,'0002','aprobado'),row(3,'0003','rechazado')];rows[0].nombre='José Pérez';rows[1].nombre=' JOSE  PEREZ ';rows[2].nombre='Jose Perez';
 const f=fixture(rows);try{await f.w.detectarDuplicadosAprobadosPorNombre();assert.equal(f.calls[0].state,null);assert.equal(f.result.querySelectorAll('.persona-item').length,3);assert.match(f.result.textContent,/Verificada/);assert.match(f.result.textContent,/Pendiente de verificación/);assert.match(f.result.textContent,/Rechazada/);}finally{f.close();}
});
test('ambos botones y sus resultados están sobre la tabla junto a los filtros, sin IDs repetidos',()=>{
 const w=new JSDOM(fs.readFileSync('index.html','utf8')).window;
 try{const tabla=w.document.getElementById('tabla-comprobantes');for(const id of ['btnDupNombreAprobados','btnDupReferenciaAprobados']){const boton=w.document.getElementById(id);assert.equal(w.document.querySelectorAll('#'+id).length,1);assert.ok(boton.closest('.sort-controls'));assert.ok(boton.compareDocumentPosition(tabla)&4);}
 const resultados=w.document.getElementById('duplicadosAprobadosResultado');assert.ok(resultados.compareDocumentPosition(tabla)&4);assert.ok(w.document.getElementById('tab-ventas').contains(w.document.getElementById('listaAprobados')));
 }finally{w.close();}
});
