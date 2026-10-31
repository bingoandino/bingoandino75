const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('script.js','utf8');
const core=source.slice(source.indexOf('// Una respuesta perdida'),source.indexOf('// ==================== fUNCIONES DE USUARIO'));
function fixture({lost=false,queryFails=false,rejected=false}={}) {
 const dom=new JSDOM(`<section id="pago"><h2>Enviar pago</h2><div id="contadorReserva"></div><input id="nombre"><input id="telefono"><input id="cedula"><input id="referido"><input id="cantidadCartones" value="25"><input id="referencia4dig" value="00001234"><input id="pago_banco" value="0105"><input id="pago_telefono" value="04141234567"><input id="pago_cedula" value="12345678"><input id="comprobante" type="file"><button id="btnEnviarComprobante">Enviar comprobante</button></section><section id="cartones" class="oculto"><h2>Cartones</h2><div id="contenedor-cartones"></div></section>`,{url:'https://example.test',runScripts:'outside-only'});
 const w=dom.window;const cards=Array.from({length:25},(_,i)=>i+1),calls={insert:0,upload:0,release:0,alerts:[]};let saved=null;
 w.eval('var usuario={nombre:"Cliente Prueba",telefono:"04141234567",cedula:"12345678",referido:"",cartones:[]},timerReserva=null,cantidadPermitida=25,precioPorCarton=890,versionCartones="1",modoCartones="libre",cantidadFijaCartones=1,totalCartones=800;');
 w.usuario.cartones=cards;
 for(const id of ['nombre','telefono','cedula','referido'])w.document.getElementById(id).value=w.usuario[id];
 Object.defineProperty(w.document.getElementById('comprobante'),'files',{value:[{}]});
 w.ReferenciaBancaria={ultimos4:value=>value.slice(-4)};w.guardarDatosPagoClienteAutomatico=()=>{};
 w.prepararComprobanteSeguro=async()=>({archivo:{},extension:'jpg',contentType:'image/jpeg'});w.getPromocionSeleccionada=()=>null;
 w.alert=message=>calls.alerts.push(message);w.console.error=()=>{};w.mostrarVentana=async()=>{};w.cargarCartones=async()=>{};w.iniciarContadorReserva=()=>{};w.actualizarMonto=()=>{};w.toggleCarton=async()=>{throw Error('No debe cambiar una compra enviada');};w.seleccionarAleatorioSeguro=w.toggleCarton;
 w.supabase={storage:{from(){return {upload:async()=>{calls.upload++;return{};},getPublicUrl:()=>({data:{publicUrl:'https://example.test/proof.jpg'}})};}},rpc:async()=>{calls.release++;return {data:true};},from(table){let fields;const q={select(value){fields=value;return q;},eq(){return q;},in(){return q;},then(resolve,reject){let result;
   if(table==='cartones')result={data:cards.map(numero=>({numero,cedula:'12345678',reserved_at:new Date().toISOString(),partida_id:null}))};
   else if(fields.includes('referencia4dig')&&queryFails)result={error:{message:'offline'}};
   else result={data:saved?[saved]:[]};
   return Promise.resolve(result).then(resolve,reject);
 },async insert(){calls.insert++;if(rejected)return {error:{code:'P0001',message:'Revisa el teléfono'}};saved={id:75,cartones:[...cards],referencia4dig:'1234',estado:'pendiente'};if(lost)throw Error('Failed to fetch');return {data:75};}};return q;}};
 w.eval(core);
 const helper=fs.readFileSync('referencia.js','utf8');
 // Instala tanto el bloqueo de envío como la recuperación y sus relojes reales.
 w.eval(helper.slice(helper.indexOf('// Solo tiempos')));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,calls,get saved(){return saved;},close:()=>w.close()};
}
test('25 cartones: éxito visible, sin recargar, borrar reservas ni reenviar al pulsar otra vez',async()=>{
 const f=fixture();try{await f.w.enviarComprobante();assert.equal(f.calls.insert,1);assert.equal(f.saved.cartones.length,25);assert.match(f.w.document.getElementById('confirmacion-compra').textContent,/Compra #75 recibida: 25 cartones/);assert.equal(f.w.document.getElementById('btnEnviarComprobante').hidden,true);assert.equal(f.w.sessionStorage.getItem('bingo_compra_en_curso_v1'),null);f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.w.sessionStorage.getItem('bingo_compra_en_curso_v1'),null);await f.w.enviarComprobante();assert.equal(f.calls.insert,1);assert.equal(f.calls.upload,1);assert.equal(f.calls.release,0);assert.deepEqual(f.calls.alerts,[]);}finally{f.close();}
});
test('si el servidor guarda y se pierde la respuesta, recupera el mismo recibo sin otra compra',async()=>{
 const f=fixture({lost:true});try{await f.w.enviarComprobante();assert.equal(f.w.estadoEnvioCompra.fase,'confirmada');assert.match(f.w.document.getElementById('confirmacion-compra').textContent,/recibida/);await f.w.enviarComprobante();assert.equal(f.calls.insert,1);assert.equal(f.calls.upload,1);assert.deepEqual(f.calls.alerts,[]);}finally{f.close();}
});
test('si también falla la consulta, solo permite comprobar y bloquea cambiar cartones o volver a enviar',async()=>{
 const f=fixture({lost:true,queryFails:true});try{await f.w.enviarComprobante();assert.equal(f.w.estadoEnvioCompra.fase,'incierta');assert.equal(f.w.document.getElementById('btnEnviarComprobante').textContent,'Comprobar mi compra');await f.w.enviarComprobante();await f.w.seleccionarAleatorioSeguro();assert.equal(f.calls.insert,1);assert.equal(f.calls.upload,1);assert.equal(f.calls.release,0);assert.match(f.w.document.getElementById('confirmacion-compra').textContent,/No vuelvas a pagar/);assert.deepEqual(f.calls.alerts,[]);}finally{f.close();}
});
test('un rechazo real de Postgres sigue mostrando la validación y permite corregir',async()=>{
 const f=fixture({rejected:true});try{await f.w.enviarComprobante();assert.equal(f.saved,null);assert.equal(f.w.estadoEnvioCompra.fase,'listo');assert.match(f.calls.alerts[0],/teléfono/);assert.equal(f.w.document.getElementById('btnEnviarComprobante').disabled,false);}finally{f.close();}
});
test('al confirmar detiene el reloj y no restaura el borrador al volver a la pestaña',async()=>{
 const f=fixture();try{await f.w.enviarComprobante();f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));await Promise.resolve();assert.equal(f.w.document.getElementById('contadorReserva').textContent,'');assert.equal(f.w.sessionStorage.getItem('bingo_compra_en_curso_v1'),null);assert.deepEqual(f.calls.alerts,[]);}finally{f.close();}
});
