const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('script.js','utf8');
function fixture({stalled=false,missing=false,duplicate=false,writeEmpty=false}={}) {
 const w=new JSDOM('<table><tbody><tr data-estado-actual="pendiente"><td><span class="estado-circulo rojo"></span><button class="btn-accion">✅</button></td></tr></tbody></table>',{runScripts:'outside-only'}).window;
 let writes=0,reads=0;const alerts=[];w.alert=m=>alerts.push(m);w.confirm=()=>true;w.console.error=()=>{};
 w.supabase={from(){let columns,writing=false;const q={select(c){columns=c;return q;},eq(){return q;},neq(){return q;},single(){return q;},abortSignal(){return q;},update(){writing=true;return q;},then(resolve,reject){if(writing){writes++;return Promise.resolve({data:writeEmpty?null:{id:1,estado:'aprobado'}}).then(resolve,reject);}reads++;if(stalled)return new Promise(()=>{});return Promise.resolve(missing?{error:{code:'PGRST116'}}:{data:columns==='estado'?{estado:'pendiente'}:columns==='cartones,nombre'?{nombre:'Cliente Prueba',cartones:[12]}:duplicate?[{id:2,nombre:'Otro Cliente',cartones:[12]}]:[]}).then(resolve,reject);}};return q;}};
 w.eval(source.slice(source.indexOf('const ultimoEstadoProcesado'),source.indexOf('const CONFIG_OTP'))+';window.testAdmin={ultimoEstadoProcesado,estadoEnProceso};');
 w.eval(source.slice(source.indexOf('async function aprobarInscripcion('),source.indexOf('async function rechazarInscripcion(')));
 const row=w.document.querySelector('tr');
 return {w,row,alerts,get writes(){return writes;},get reads(){return reads;},run:()=>w.procesarEstadoUnaVez(1,row,'aprobado',()=>w.aprobarInscripcion(1,row)),close:()=>w.close()};
}
test('una fila pendiente recargada se puede aprobar aunque la pestaña recuerde un estado anterior',async()=>{
 const f=fixture();try{f.w.testAdmin.ultimoEstadoProcesado.set(1,'aprobado');await f.run();assert.equal(f.writes,1);assert.equal(f.row.dataset.estadoActual,'aprobado');assert.equal(f.row.querySelector('.estado-circulo').classList.contains('verde'),true);assert.match(f.row.textContent,/Guardado/);}finally{f.close();}
});
test('los toques repetidos muestran progreso y solo hacen una aprobación',async()=>{
 const f=fixture();try{const a=f.run(),b=f.run();assert.equal(f.row.querySelector('button').disabled,true);assert.match(f.row.textContent,/Comprobando/);await Promise.all([a,b]);assert.equal(f.writes,1);assert.equal(f.row.querySelector('button').disabled,false);assert.equal(f.row.hasAttribute('aria-busy'),false);}finally{f.close();}
});
test('una consulta sin respuesta libera el bloqueo y avisa sin aprobar automáticamente',async()=>{
 const f=fixture({stalled:true});try{const timer=f.w.setTimeout.bind(f.w);f.w.setTimeout=(fn,ms)=>timer(fn,ms===15000?5:ms);await f.run();assert.equal(f.writes,0);assert.equal(f.row.dataset.estadoActual,'pendiente');assert.equal(f.row.querySelector('button').disabled,false);assert.match(f.alerts[0],/Recargar/);assert.equal(f.w.testAdmin.estadoEnProceso.size,0);}finally{f.close();}
});
test('una lectura sin permiso muestra una instrucción y no se queda callada',async()=>{
 const f=fixture({missing:true});try{await f.run();assert.equal(f.writes,0);assert.match(f.alerts[0],/administrador/);assert.equal(f.row.dataset.estadoActual,'pendiente');}finally{f.close();}
});
test('una actualización sin fila confirmada no pinta verde ni recuerda una aprobación falsa',async()=>{
 const f=fixture({writeEmpty:true});try{await f.run();assert.equal(f.writes,1);assert.equal(f.row.dataset.estadoActual,'pendiente');assert.equal(f.row.querySelector('.estado-circulo').classList.contains('verde'),false);assert.equal(f.w.testAdmin.ultimoEstadoProcesado.size,0);assert.match(f.alerts[0],/confirmar la aprobación/);}finally{f.close();}
});
test('los cartones ya aprobados para otra compra siguen bloqueando la aprobación',async()=>{
 const f=fixture({duplicate:true});try{await f.run();assert.equal(f.writes,0);assert.match(f.alerts[0],/ya aprobado/);assert.equal(f.row.dataset.estadoActual,'pendiente');}finally{f.close();}
});
