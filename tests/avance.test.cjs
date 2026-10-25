const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const helper=fs.readFileSync(path.join(__dirname,'..','referencia.js'),'utf8');const block=helper.slice(helper.indexOf('// Recuperación en esta pestaña'));
const key='bingo_compra_en_curso_v1';
function fixture(options={}){
 const d=new JSDOM(`<section id="bienvenida"></section><section id="inscripcion" class="oculto"><input id="nombre"><input id="telefono"><input id="cedula"><input id="referido"></section><section id="cantidad" class="oculto"><input id="cantidadCartones" value="1"></section><section id="cartones" class="oculto"><h2>Cartones</h2><div id="contenedor-cartones"><div class="carton ocupado">12</div></div></section><section id="pago" class="oculto"><div id="contadorReserva"></div><input id="referencia4dig"><input type="file" id="comprobante"><input id="pago_banco" value="dato privado no nuevo"><button id="btnEnviarComprobante">Enviar</button></section><section id="usuario" class="oculto"><input id="consulta-cedula"></section>`,{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=d.window;let now=Date.now();w.Date.now=()=>now;const calls={reads:0,send:0,rpc:0};
 w.eval('var usuario={nombre:"Prueba",telefono:"00000000000",cedula:"12345678",referido:"",cartones:[]},cantidadPermitida=1,versionCartones="1",precioPorCarton=10,totalCartones=100,sistemaListo=true,modoCartones="libre",cantidadFijaCartones=1,timerReserva=null;');
 for(const id of ['nombre','telefono','cedula','referido'])w.document.getElementById(id).value=w.usuario[id];
 const rows=options.rows||[{numero:12,cedula:'12345678',reserved_at:new Date(now-60000).toISOString(),partida_id:null}];
 w.supabase={from(table){let cedula,selection;return{select(){return this;},eq(_,value){cedula=value;return this;},in(field,value){if(field==='numero')selection=value;calls.reads++;if(options.error)return Promise.resolve({error:{}});return Promise.resolve({data:table==='cartones'?rows.filter(r=>r.cedula===cedula&&selection.includes(r.numero)):(options.enviadas||[])});}};},rpc(){calls.rpc++;throw Error('No debe modificar reservas durante la recuperación');}};
 w.mostrarVentana=async id=>{w.document.querySelectorAll('section').forEach(s=>s.classList.toggle('oculto',s.id!==id));if(id==='pago')w.iniciarContadorReserva(5);};
 w.iniciarContadorReserva=()=>{};w.toggleCarton=async numero=>{w.usuario.cartones=w.usuario.cartones.includes(numero)?w.usuario.cartones.filter(n=>n!==numero):[...w.usuario.cartones,numero];};w.cargarCartones=async()=>{};w.actualizarMonto=()=>{};w.enviarComprobante=async()=>{calls.send++;};
 if(options.draft)w.sessionStorage.setItem(key,options.draft);
 const longTimeouts=[];if(options.holdLongTimeouts){const native=w.setTimeout.bind(w);w.setTimeout=(callback,ms,...args)=>ms>1000?(longTimeouts.push(callback),99999):native(callback,ms,...args);}
 if(options.reload)w.performance.getEntriesByType=()=>[{type:'reload'}];
 if(options.admin)w.sessionStorage.setItem('admin_session_token','sesion-ficticia');
 w.eval(block);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return{w,rows,calls,longTimeouts,setNow:value=>{now=value;},get now(){return now;},save:()=>w.sessionStorage.getItem(key),close:()=>w.close()};
}
async function selected(f){await f.w.toggleCarton(12);await f.w.mostrarVentana('pago');return f.save();}
async function retomar(f){await f.w.document.querySelector('#retomar-compra button').onclick();}
test('guarda campos de la compra sin copiar archivo ni datos bancarios y sin consultas por escribir',()=>{
 const f=fixture();try{f.w.document.getElementById('nombre').dispatchEvent(new f.w.Event('input',{bubbles:true}));const value=JSON.parse(f.save());assert.equal(value.campos.cedula,'12345678');assert.equal(f.calls.reads,0);assert.equal(/pago_banco|comprobante|dato privado/.test(f.save()),false);}finally{f.close();}
});
test('el contador usa el vencimiento del servidor y no reinicia al volver a pago ni al regresar a la pestaña',async()=>{
 const f=fixture();try{await selected(f);assert.match(f.w.document.getElementById('contadorReserva').textContent,/4:00/);f.setNow(f.now+30000);await f.w.mostrarVentana('pago');assert.match(f.w.document.getElementById('contadorReserva').textContent,/3:30/);f.setNow(f.now+30000);f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));assert.match(f.w.document.getElementById('contadorReserva').textContent,/3:00/);}finally{f.close();}
});
test('al recargar recupera la reserva original y la referencia completa, usando el precio actual',async()=>{
 const first=fixture();let draft,rows;try{first.w.document.getElementById('referencia4dig').value='000012345678';draft=await selected(first);rows=first.rows;}finally{first.close();}
 const f=fixture({draft,rows});try{f.w.precioPorCarton=15;await retomar(f);assert.deepEqual(Array.from(f.w.usuario.cartones),[12]);assert.equal(f.w.document.getElementById('pago').classList.contains('oculto'),false);assert.equal(f.w.document.getElementById('referencia4dig').value,'000012345678');assert.equal(f.w.document.getElementById('comprobante').files.length,0);assert.equal(f.w.precioPorCarton,15);assert.match(f.w.document.getElementById('avance-compra-estado').textContent,/archivo/);assert.equal(f.calls.rpc,0);}finally{f.close();}
});
test('vencimiento, cambio de titular, cambio de sello o reinicio de versión no recuperan cartones',async()=>{
 const first=fixture();let draft,rows;try{draft=await selected(first);rows=first.rows;}finally{first.close();}
 for(const scenario of ['vencida','titular','sello','version']){
  const altered=rows.map(r=>({...r}));if(scenario==='titular')altered[0].cedula='87654321';if(scenario==='sello')altered[0].reserved_at=new Date().toISOString();
  const f=fixture({draft,rows:altered});try{if(scenario==='vencida')f.setNow(f.now+300000);if(scenario==='version')f.w.versionCartones='2';await retomar(f);assert.equal(f.w.usuario.cartones.length,0,scenario);assert.equal(f.w.document.getElementById('pago').classList.contains('oculto'),true);assert.equal(f.calls.rpc,0);}finally{f.close();}
 }
});
test('una compra ya enviada se dirige a consultar y no vuelve a reservar ni enviar',async()=>{
 const first=fixture();let draft,rows;try{draft=await selected(first);rows=first.rows;}finally{first.close();}
 const f=fixture({draft,rows,enviadas:[{cartones:[12]}]});try{await retomar(f);assert.equal(f.w.usuario.cartones.length,0);assert.equal(f.w.document.getElementById('usuario').classList.contains('oculto'),false);assert.equal(f.save(),null);assert.equal(f.calls.send,0);assert.equal(f.calls.rpc,0);}finally{f.close();}
});
test('error de red conserva el borrador y bloquea el envío hasta confirmar la reserva',async()=>{
 const first=fixture();let draft;try{draft=await selected(first);}finally{first.close();}
 const f=fixture({draft,error:true});try{await retomar(f);assert.equal(f.save(),draft);await f.w.enviarComprobante();assert.equal(f.calls.send,0);assert.equal(f.calls.rpc,0);}finally{f.close();}
});
test('el reloj vence al tiempo real tras suspensión y no ejecuta liberaciones ni borra compras del servidor',async()=>{
 const f=fixture();try{await selected(f);f.setNow(f.now+300000);f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(f.w.usuario.cartones.length,0);assert.match(f.w.document.getElementById('avance-compra-estado').textContent,/reserva venció/);assert.equal(f.calls.rpc,0);}finally{f.close();}
});
test('dos intentos de envío comparten validación y un solo envío',async()=>{
 const f=fixture();try{await selected(f);const a=f.w.enviarComprobante(),b=f.w.enviarComprobante();assert.equal(a,b);await a;assert.equal(f.calls.send,1);}finally{f.close();}
});
test('una selección incompleta conserva solo las reservas vigentes y no permite enviar',async()=>{
 const f=fixture();try{f.w.usuario.cartones=[12,13];f.w.cantidadPermitida=2;await f.w.enviarComprobante();assert.equal(f.calls.send,0);assert.deepEqual(Array.from(f.w.usuario.cartones),[12]);assert.equal(f.w.document.getElementById('btnEnviarComprobante').disabled,false);}finally{f.close();}
});
test('el intento de envío se recuerda para comprobar su estado al recargar',async()=>{
 const f=fixture();try{await selected(f);const pending=f.w.enviarComprobante();assert.equal(f.w.document.getElementById('btnEnviarComprobante').disabled,true);assert.match(f.w.document.getElementById('btnEnviarComprobante').textContent,/Verificando/);await pending;assert.equal(JSON.parse(f.save()).envioIntentado,true);assert.equal(f.w.document.getElementById('btnEnviarComprobante').disabled,false);}finally{f.close();}
});
test('un borrador de más de treinta minutos no se ofrece para recuperar',async()=>{
 const old=fixture();let draft;try{draft=JSON.parse(await selected(old));draft.guardado-=31*60000;}finally{old.close();}
 const f=fixture({draft:JSON.stringify(draft)});try{assert.equal(f.w.document.getElementById('retomar-compra'),null);assert.equal(f.save(),null);}finally{f.close();}
});
test('recargar otra vez sin retomar todavía no sobrescribe el avance guardado',async()=>{
 const first=fixture();let draft;try{draft=await selected(first);}finally{first.close();}
 const f=fixture({draft});try{f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.save(),draft);}finally{f.close();}
});
async function esperarRecuperacion(f){for(let i=0;i<30;i++){await new Promise(resolve=>setTimeout(resolve,5));if(!f.w.document.getElementById('retomar-compra')||f.w.document.getElementById('avance-compra-estado')?.textContent.includes('No se pudo recuperar'))return;}}
test('una recarga vuelve automáticamente a pago validando la reserva sin reiniciar el reloj',async()=>{
 const first=fixture();let draft,rows;try{draft=await selected(first);rows=first.rows;}finally{first.close();}
 const f=fixture({draft,rows,reload:true});try{await esperarRecuperacion(f);assert.equal(f.w.document.getElementById('pago').classList.contains('oculto'),false);assert.deepEqual(Array.from(f.w.usuario.cartones),[12]);assert.match(f.w.document.getElementById('contadorReserva').textContent,/3:|4:/);assert.equal(f.calls.send,0);assert.equal(f.calls.rpc,0);}finally{f.close();}
});
test('recargar con reserva vencida recupera datos y cantidad sin regresar a pago',async()=>{
 const first=fixture();let draft,rows;try{draft=await selected(first);rows=first.rows.map(r=>({...r,reserved_at:new Date(Date.now()-600000).toISOString()}));}finally{first.close();}
 const f=fixture({draft,rows,reload:true});try{await esperarRecuperacion(f);assert.equal(f.w.document.getElementById('pago').classList.contains('oculto'),true);assert.equal(f.w.usuario.cartones.length,0);assert.equal(f.w.document.getElementById('cantidad').classList.contains('oculto'),false);}finally{f.close();}
});
test('la recarga no recupera una compra encima de una sesión de administrador',async()=>{
 const first=fixture();let draft;try{draft=await selected(first);}finally{first.close();}
 const f=fixture({draft,reload:true,admin:true});try{await new Promise(resolve=>setTimeout(resolve,15));assert.equal(f.w.document.getElementById('bienvenida').classList.contains('oculto'),false);assert.ok(f.w.document.getElementById('retomar-compra'));assert.equal(f.calls.reads,0);}finally{f.close();}
});
test('al retomar un cartón completo mantiene los demás bloqueados y distingue los ocupados',async()=>{
 const first=fixture();let draft,rows;try{draft=await selected(first);rows=first.rows;}finally{first.close();}
 const f=fixture({draft,rows});try{
  f.w.document.getElementById('contenedor-cartones').insertAdjacentHTML('beforeend','<div class="carton">13</div><div class="carton ocupado">14</div>');
  await retomar(f);const cards=f.w.document.querySelectorAll('.carton');
  assert.equal(cards[0].classList.contains('seleccionado'),true);assert.equal(cards[0].classList.contains('bloqueado'),false);
  assert.equal(cards[1].classList.contains('bloqueado'),true);assert.equal(cards[1].onclick,null);
  assert.equal(cards[2].classList.contains('ocupado'),true);assert.equal(cards[2].onclick,null);
  const rule=Array.from(f.w.document.styleSheets).flatMap(s=>Array.from(s.cssRules)).find(r=>r.selectorText==='#contenedor-cartones .carton.seleccionado');
  assert.ok(rule);assert.match(rule.style.background,/#168443|22, 132, 67/);
 }finally{f.close();}
});
test('varios cartones se van seleccionando hasta el límite y quitar uno habilita los libres',async()=>{
 const f=fixture();try{
  f.w.cantidadPermitida=2;let modal=0;f.w.abrirModalCarton=()=>modal++;
  f.w.document.getElementById('contenedor-cartones').insertAdjacentHTML('beforeend','<div class="carton">13</div><div class="carton">14</div><div class="carton ocupado">15</div>');
  await f.w.toggleCarton(12);let cards=f.w.document.querySelectorAll('.carton');assert.equal(cards[0].classList.contains('seleccionado'),true);assert.equal(cards[1].classList.contains('bloqueado'),false);
  await f.w.toggleCarton(13);assert.equal(cards[1].classList.contains('seleccionado'),true);assert.equal(cards[2].classList.contains('bloqueado'),true);assert.equal(cards[2].onclick,null);
  await f.w.toggleCarton(12);assert.equal(cards[0].classList.contains('seleccionado'),false);assert.equal(cards[2].classList.contains('bloqueado'),false);cards[2].click();assert.equal(modal,1);assert.equal(cards[3].onclick,null);
 }finally{f.close();}
});
test('no ofrece Retomar si los cinco minutos vencieron aunque el borrador se haya guardado recientemente',async()=>{
 const first=fixture();let draft;try{draft=JSON.parse(await selected(first));draft.reservas[0].sello=new Date(Date.now()-360000).toISOString();draft.guardado=Date.now();}finally{first.close();}
 const f=fixture({draft:JSON.stringify(draft)});try{assert.equal(f.w.document.getElementById('retomar-compra'),null);assert.equal(f.save(),null);assert.equal(f.calls.reads,0);}finally{f.close();}
});
test('el aviso se retira al volver a la pestaña después de vencer sin modificar compras del servidor',async()=>{
 const first=fixture();let draft;try{draft=await selected(first);}finally{first.close();}
 const f=fixture({draft});try{assert.ok(f.w.document.getElementById('retomar-compra'));f.setNow(f.now+300000);f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(f.w.document.getElementById('retomar-compra'),null);assert.equal(f.save(),null);assert.equal(f.calls.rpc,0);assert.equal(f.calls.send,0);}finally{f.close();}
});
test('el vencimiento durante la compra no vuelve a guardar un avance vacío al salir o recargar',async()=>{
 const f=fixture();try{await selected(f);f.setNow(f.now+300000);f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.save(),null);assert.equal(f.w.usuario.cartones.length,0);}finally{f.close();}
});
test('el temporizador retira el aviso al vencer aunque el cliente no cambie de pestaña',async()=>{
 const first=fixture();let draft;try{draft=await selected(first);}finally{first.close();}
 const f=fixture({draft,holdLongTimeouts:true});try{assert.equal(f.longTimeouts.length,1);f.setNow(f.now+300000);f.longTimeouts[0]();assert.equal(f.w.document.getElementById('retomar-compra'),null);assert.equal(f.save(),null);}finally{f.close();}
});
test('después de vencer se puede empezar una nueva selección y guardar su nueva reserva',async()=>{
 const f=fixture();try{await selected(f);f.setNow(f.now+300000);f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(f.save(),null);f.rows[0].reserved_at=new Date(f.now).toISOString();await f.w.toggleCarton(12);await f.w.mostrarVentana('pago');assert.deepEqual(Array.from(f.w.usuario.cartones),[12]);assert.ok(f.save());assert.match(f.w.document.getElementById('contadorReserva').textContent,/5:00/);}finally{f.close();}
});
test('un avance vacío guardado en Inicio por una versión anterior no muestra el anuncio',()=>{
 const draft=JSON.stringify({schema:1,guardado:Date.now(),campos:{cedula:'12345678'},reservas:[],etapa:'bienvenida'});const f=fixture({draft});try{assert.equal(f.w.document.getElementById('retomar-compra'),null);assert.equal(f.save(),null);}finally{f.close();}
});
