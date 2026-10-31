const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
function fixture(){
 const w=new JSDOM('<input id="nombre" value="Prueba Cliente"><input id="telefono"><input id="cedula" value="12345678"><input id="referido"><input id="referencia4dig" value="0430"><input id="pago_banco" value="0102"><input id="pago_telefono" value="04241234567"><input id="pago_cedula" value="12345678"><input id="comprobante" type="file"><button id="btnEnviarComprobante">Enviar</button>',{runScripts:'outside-only'}).window;
 w.eval('var usuario={nombre:"Prueba Cliente",telefono:"04241234567",cedula:"12345678",cartones:[1]},cantidadPermitida=1,precioPorCarton=10,timerReserva=null; function mostrarVentana(id){window.abierta=id} function actualizarPreseleccion(){} function guardarDatosClienteLocal(){} function guardarDatosPagoClienteAutomatico(){} function getPromocionSeleccionada(){return null}');
 w.estadoEnvioCompra={fase:'listo',compra:null,id:null};
 w.alert=msg=>w.aviso=msg;w.console.error=()=>{};
 w.eval(source.slice(source.indexOf('function guardarDatosInscripcion()'),source.indexOf('function confirmarCantidad()')));
 w.eval(source.slice(source.indexOf('async function enviarComprobante()'),source.indexOf('// ==================== fUNCIONES DE USUARIO')));
 return w;
}
test('normaliza formatos pegados y rechaza teléfonos inválidos antes de continuar',()=>{
 const w=fixture();try{
  for(const entrada of ['0424.123.4567','+58 (424) 123-4567','\u200e04241234567']){
   w.abierta=null;w.document.getElementById('telefono').value=entrada;w.guardarDatosInscripcion();
   assert.equal(w.abierta,'cantidad');assert.match(w.usuario.telefono,/^\d{10,15}$/);
  }
  for(const entrada of ['424123','0424ABC1234567','1'.repeat(16)]){
   w.abierta=null;w.document.getElementById('telefono').value=entrada;w.guardarDatosInscripcion();assert.equal(w.abierta,null);assert.match(w.aviso,/teléfono de registro/);
  }
 }finally{w.close();}
});
test('un teléfono antiguo inválido se detecta antes de procesar o subir la imagen',async()=>{
 const w=fixture();try{w.usuario.telefono='123';await w.enviarComprobante();assert.equal(w.abierta,'inscripcion');assert.match(w.aviso,/teléfono de registro/);assert.equal(w.document.getElementById('btnEnviarComprobante').disabled,false);}finally{w.close();}
});
test('un rechazo al registrar conserva reservas y explica el campo; oculta errores internos',async()=>{
 for(const [message,esperado] of [['Revisa el teléfono',/teléfono de registro/],['Revisa los datos de Pago Móvil',/Pago Móvil/],['SQL SECRET',/No se pudo confirmar/]]){
  const w=fixture();let liberaciones=0,telefonoEnviado;
  try{
   w.usuario.telefono='+58 (424) 123-4567';
   w.ReferenciaBancaria={ultimos4:()=> '0430'};
   Object.defineProperty(w.document.getElementById('comprobante'),'files',{value:[{name:'test.jpg'}]});
   w.prepararComprobanteSeguro=async()=>({archivo:{},extension:'jpg',contentType:'image/jpeg'});
   w.supabase={storage:{from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:'https://example.test/test.jpg'}})})},rpc:async()=>{liberaciones++;return{}},from:tabla=>({select:()=>({in:async()=>({data:tabla==='cartones'?[{numero:1,cedula:'12345678'}]:[],error:null})}),insert:async filas=>{telefonoEnviado=filas[0].telefono;return{error:{code:'P0001',message}};}})};
   await w.enviarComprobante();assert.equal(telefonoEnviado,'584241234567');assert.equal(liberaciones,0);assert.match(w.aviso,esperado);assert.doesNotMatch(w.aviso,/SQL SECRET/);assert.match(w.aviso,/No vuelvas a pagar/);assert.equal(w.document.getElementById('btnEnviarComprobante').textContent,'Enviar');
  }finally{w.close();}
 }
});
