import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crearConsultasCompra,cedulaConsulta} from '../asistente/consultas.js';
const ask = async (rows, phrase='Consultar mi compra') => {
  const calls=[];
  const c=crearConsultasCompra(async (url,options)=>{calls.push({url,options});return Response.json(rows);});
  await c.receive(phrase);const output=await c.receive('V-12.345.678');return {c,calls,output};
};
test('compra pasada y consultas piden cédula sin iniciar una transacción',async()=>{
  for(const phrase of ['Compré 3 cartones','Ya compré','Ya pagué','Dónde están mis cartones?','Consultar mi compra']){
    let calls=0;const c=crearConsultasCompra(async()=>{calls++;throw Error();});
    assert.match((await c.receive(phrase))[0].text,/solo tu cédula/);assert.equal(calls,0);
  }
});
test('cédula estricta: rechaza referencia mezclada, inyección, HTML y datos personales',()=>{
  assert.equal(cedulaConsulta('Cédula: V-12.345.678'),'12345678');
  for(const value of ['Ana 12345678','12345678 teléfono 04121234567','12345678&select=*','<img src=x>','1234','1234567890123','١٢٣٤٥٦٧٨'])assert.equal(cedulaConsulta(value),null,value);
});
test('la consulta pide exclusivamente estado y jamás llama IA, registro ni subida de archivos',async()=>{
  const {calls,output}=await ask([{estado:'pendiente'}]);assert.match(output[0].text,/pendiente de verificación/);
  assert.equal(calls.length,1);assert.match(calls[0].url,/rpc_consultar_cartones_cedula\?select=estado&limit=1000$/);
  assert.deepEqual(JSON.parse(calls[0].options.body),{_cedula:'12345678'});assert.equal(calls[0].options.redirect,'error');
  assert.doesNotMatch(JSON.stringify(calls),/registrar|upload|gemini|generales/);
});
test('distingue ausencia de compra de errores de red, permisos y datos inesperados',async()=>{
  const {output}=await ask([]);assert.match(output[0].text,/No encontramos compras/);
  for(const response of [()=>new Response(null,{status:403}),()=>Response.json({error:'x'}),()=>Response.json([{estado:'aprobado',nombre:'PRIVATE'}]),()=>{throw Error('PRIVATE');}]){
    const c=crearConsultasCompra(async()=>response());await c.receive('Consultar mi compra');const out=await c.receive('12345678');
    assert.match(out[0].text,/no significa que no haya una compra/);assert.doesNotMatch(JSON.stringify(out),/PRIVATE/);
  }
});
test('múltiples compras no se presentan engañosamente como una sola aprobada',async()=>{
  const {output}=await ask([{estado:'aprobado'},{estado:'pendiente'}]);assert.match(output[0].text,/distintos estados/);assert.match(output[0].text,/pendiente/);
});
test('estado desconocido no se muestra como texto ni HTML externo',async()=>{
  const {output}=await ask([{estado:'<script>PRIVATE</script>'}]);assert.match(output[0].text,/Soporte/);assert.doesNotMatch(JSON.stringify(output),/PRIVATE|<script>/);
});
test('volver al inicio, soporte y reiniciar salen de la captura de cédula',async()=>{
  const c=crearConsultasCompra(async()=>{throw Error();});
  for(const action of ['Volver al inicio','Escribir a soporte']){await c.receive('Consultar mi compra');await c.receive(action);assert.equal(await c.receive('12345678'),null);}
  await c.receive('Consultar mi compra');c.reset();assert.equal(await c.receive('12345678'),null);
});
test('comprobante inicial no se sube ni se interpreta como pago aprobado',()=>{
  const c=crearConsultasCompra(()=>{throw Error('must not call');});const output=c.proof();assert.match(output[0].text,/no confirma una compra/);assert.equal(output[1].type,'consult-options');
});
test('un dato numérico fuera de consulta no se captura para verificación',async()=>{
  const c=crearConsultasCompra(()=>{throw Error();});assert.equal(await c.receive('12345678'),null);assert.equal(await c.receive('Nombre: Ana Pérez'),null);
});
test('peticiones concurrentes no duplican consultas',async()=>{
  let finish,calls=0;const c=crearConsultasCompra(async()=>{calls++;return new Promise(r=>{finish=r;});});
  await c.receive('Consultar mi compra');const first=c.receive('12345678');const second=await c.receive('12345678');assert.match(second[0].text,/Espera/);finish(Response.json([]));await first;assert.equal(calls,1);
});

test('sí después del comprobante abre consulta y nunca cae en registro',async()=>{const c=crearConsultasCompra(()=>{throw Error();});c.proof();assert.match((await c.receive('sí'))[0].text,/solo tu cédula/);});
