const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'..','referencia.js'),'utf8');
function fixture(response){
  const dom=new JSDOM('<div id="redes-sociales"><a href="https://wa.me/580000000000">Contacto ficticio</a></div><section><h2>Consultar cartones</h2><input id="consulta-cedula"><button onclick="consultarCartones()">Consultar</button><div id="cartones-usuario"></div></section>',{runScripts:'outside-only',url:'https://example.test'});
  const w=dom.window, calls=[];
  w.supabase={from(table){const call={table};calls.push(call);return {select(fields){call.fields=fields;return this;},eq(key,value){call.key=key;call.value=value;return this;},order(){return typeof response==='function'?response(call):Promise.resolve(response);}};}};
  w.urlCartonWebP=n=>`https://example.test/carton-${n}.webp`;
  w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const input=w.document.getElementById('consulta-cedula');input.value='12345678';
  return {w,calls,input,cont:w.document.getElementById('cartones-usuario'),button:w.document.querySelector('button'),close:()=>w.close()};
}
test('compras mixtas se muestran por separado con instrucciones y cartones de cada estado',async()=>{
  const f=fixture({data:[{id:3,estado:'aprobado',cartones:['12']},{id:2,estado:'pendiente',cartones:['23']},{id:1,estado:'rechazado',cartones:['34']}]});
  try{await f.w.consultarCartones();const cards=f.cont.querySelectorAll('article');assert.equal(cards.length,3);
    assert.match(cards[0].textContent,/Compra aprobada/);assert.match(cards[0].textContent,/Cartones: 12/);
    assert.match(cards[1].textContent,/30 minutos/);assert.match(cards[1].textContent,/todavía no están aprobados/);
    assert.match(cards[2].textContent,/No vuelvas a pagar/);assert.equal(cards[2].querySelectorAll('img').length,0);
    assert.equal(cards[0].querySelectorAll('img').length,1);assert.equal(cards[1].querySelectorAll('img').length,1);
    assert.equal(f.calls[0].fields,'id,cartones,estado');assert.equal(f.calls[0].key,'cedula');
    assert.equal(cards[1].querySelector('a').hostname,'wa.me');assert.equal(cards[1].querySelector('a').href.includes('12345678'),false);
  }finally{f.close();}
});
test('no encontrado, error de red y estado desconocido tienen mensajes diferentes',async()=>{
  for(const [response,expected] of [[{data:[]},/No encontramos/],[{error:{}},/no significa que tu compra haya sido rechazada/],[{data:[{estado:'desconocido',cartones:['1']}]},/Estado por confirmar/]]){
    const f=fixture(response);try{await f.w.consultarCartones();assert.match(f.cont.textContent,expected);assert.equal(f.button.disabled,false);}finally{f.close();}
  }
});
test('no consulta cédulas vacías o inválidas',async()=>{
  const f=fixture({data:[]});try{for(const value of ['','texto','123']){f.input.value=value;await f.w.consultarCartones();}assert.equal(f.calls.length,0);assert.match(f.cont.textContent,/solo números/);}finally{f.close();}
});
test('doble consulta comparte solicitud y una respuesta anterior no muestra datos de otra cédula',async()=>{
  const finishes=[];const f=fixture(()=>new Promise(resolve=>finishes.push(resolve)));
  try{const first=f.w.consultarCartones();assert.equal(f.w.consultarCartones(),first);await Promise.resolve();assert.equal(f.calls.length,1);assert.equal(f.button.disabled,true);
    f.input.value='87654321';f.input.dispatchEvent(new f.w.Event('input'));
    assert.equal(f.cont.textContent,'');const second=f.w.consultarCartones();await Promise.resolve();
    finishes[1]({data:[{estado:'pendiente',cartones:['22']}]});await second;
    finishes[0]({data:[{estado:'aprobado',cartones:['11']}]});await first;
    assert.match(f.cont.textContent,/Cartones: 22/);assert.doesNotMatch(f.cont.textContent,/Cartones: 11/);assert.equal(f.button.disabled,false);
  }finally{f.close();}
});
test('contenido extraño no crea HTML y editar la cédula limpia los resultados',async()=>{
  const f=fixture({data:[{estado:'<img src=x onerror=alert(1)>',cartones:['<script>','12','12']}]});
  try{await f.w.consultarCartones();assert.match(f.cont.textContent,/Estado por confirmar/);assert.equal(f.cont.querySelector('script'),null);assert.equal(f.cont.querySelector('img'),null);
    f.input.dispatchEvent(new f.w.Event('input'));assert.equal(f.cont.textContent,'');
  }finally{f.close();}
});
test('una respuesta fallida permite volver a consultar sin repetir datos anteriores',async()=>{
  let attempts=0;const f=fixture(()=>Promise.resolve(++attempts===1?{error:{message:'ficticio'}}:{data:[{estado:'aprobado',cartones:['45']}]}));
  try{await f.w.consultarCartones();assert.match(f.cont.textContent,/Revisa tu conexión/);await f.w.consultarCartones();assert.match(f.cont.textContent,/Compra aprobada/);assert.equal(f.calls.length,2);}finally{f.close();}
});

test('50 cartones cargan ocho miniaturas inicialmente y permiten desplegarlas todas',async()=>{
 const f=fixture({data:[{estado:'aprobado',cartones:Array.from({length:50},(_,i)=>String(i+1))}]});
 try{await f.w.consultarCartones();assert.equal(f.cont.querySelectorAll('img').length,8);assert.match(f.cont.querySelector('.compra-cantidad').textContent,/50 cartones/);f.cont.querySelector('.compra-ver-todos').click();assert.equal(f.cont.querySelectorAll('img').length,50);assert.equal(f.cont.querySelectorAll('.compra-ver-todos').length,0);}finally{f.close();}
});
test('ampliar un cartón pendiente conserva su estado y no abre acciones de compra',async()=>{
 const f=fixture({data:[{estado:'pendiente',cartones:['58']}]});
 try{f.w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};f.w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new f.w.Event('close'));};await f.w.consultarCartones();f.cont.querySelector('.compra-miniatura').click();const dialog=f.w.document.querySelector('dialog');assert.equal(dialog.open,true);assert.match(dialog.textContent,/Cartón 58 · Pendiente de aprobación/);assert.equal(dialog.querySelector('img').getAttribute('src'),'https://example.test/carton-58.webp');dialog.querySelector('button').click();assert.equal(dialog.open,false);assert.equal(dialog.querySelector('img').hasAttribute('src'),false);}finally{f.close();}
});

