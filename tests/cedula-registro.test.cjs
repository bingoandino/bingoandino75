const{test}=require('node:test');const assert=require('node:assert/strict');const{JSDOM}=require('jsdom');const fs=require('node:fs');const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
test('registration removes dots and spaces before remembering user and starting selection',()=>{
 const w=new JSDOM('<input id="nombre" value="Prueba"><input id="telefono" value="00000000000"><input id="cedula" value=" 14.072.273 "><input id="referido">',{runScripts:'outside-only'}).window;
 try{w.eval('var usuario={},opened=null,saved=null;function mostrarVentana(id){opened=id}function actualizarPreseleccion(){}function guardarDatosClienteLocal(){saved=usuario.cedula}');w.alert=()=>{};w.eval(src.slice(src.indexOf('function guardarDatosInscripcion()'),src.indexOf('function confirmarCantidad()')));w.guardarDatosInscripcion();assert.equal(w.usuario.cedula,'14072273');assert.equal(w.saved,'14072273');assert.equal(w.document.getElementById('cedula').value,'14072273');assert.equal(w.opened,'cantidad');w.document.getElementById('cedula').value='14A072273';w.opened=null;w.guardarDatosInscripcion();assert.equal(w.opened,null);}finally{w.close();}
});
