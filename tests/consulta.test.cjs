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
  w.createImageBitmap=async()=>({width:240,height:320,close(){}});
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.toBlob=function(fn){fn(new Blob(['PNG'],{type:'image/png'}));};
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

test('compartir prepara imágenes de toda la compra, incluidas las miniaturas no desplegadas, y reutiliza descargas',async()=>{
 const f=fixture({data:[{estado:'aprobado',cartones:Array.from({length:12},(_,i)=>String(i+1))},{estado:'pendiente',cartones:['99']}]});
 try{let fetches=0,sent;f.w.urlCartonWebP=()=> 'https://example.test/imagen-compartida.webp';f.w.Blob=Blob;f.w.File=File;f.w.TextEncoder=TextEncoder;f.w.fetch=async()=>{fetches++;return{ok:true,blob:async()=>new Blob(['PNG'],{type:'image/png'})};};f.w.navigator.canShare=()=>true;f.w.navigator.share=async data=>{sent=data;};await f.w.consultarCartones();const button=f.cont.querySelector('[data-accion=compartir-cartones]');await button.onclick();assert.equal(sent.files.length,3);assert.equal(fetches,12);assert.equal(sent.files.at(-1).name,'BingoAndino75-cartones-9-10-11-12.png');assert.ok(sent.files.every(x=>x.type==='image/png'));await button.onclick();assert.equal(fetches,12);assert.equal(f.cont.querySelector('[data-estado=pendiente] .compra-acciones'),null);}finally{f.close();}
});
test('el ZIP incluye cada imagen una vez y el nombre del archivo no contiene datos de la compra',async()=>{
 const f=fixture({data:[{estado:'aprobado',cartones:['58','719','565','600','700']}]});
 try{let saved,filename;f.w.Blob=Blob;f.w.File=File;f.w.TextEncoder=TextEncoder;f.w.fetch=async()=>({ok:true,blob:async()=>new Blob(['DATOS-PNG'],{type:'image/png'})});f.w.URL.createObjectURL=blob=>{saved=blob;return'blob:prueba';};f.w.URL.revokeObjectURL=()=>{};f.w.HTMLAnchorElement.prototype.click=function(){filename=this.download;};await f.w.consultarCartones();await f.cont.querySelector('[data-accion=descargar-cartones]').onclick();assert.equal(filename,'BingoAndino75-cartones-en-grupos-de-4.zip');assert.equal(saved.type,'application/zip');const data=Buffer.from(await saved.arrayBuffer());assert.equal(data.readUInt32LE(0),0x04034b50);assert.equal(data.readUInt32LE(data.length-22),0x06054b50);assert.equal(data.readUInt16LE(data.length-12),2);assert.ok(data.includes(Buffer.from('BingoAndino75-cartones-58-719-565-600.png')));assert.ok(data.includes(Buffer.from('BingoAndino75-carton-700.png')));assert.match(f.cont.textContent,/ZIP con 2 imágenes/);}finally{f.close();}
});
test('un error de imagen no comparte una compra incompleta y permite reintentar',async()=>{
 const f=fixture({data:[{estado:'aprobado',cartones:['58']}]});
 try{let fail=true,calls=0;f.w.Blob=Blob;f.w.File=File;f.w.fetch=async()=>({ok:!fail,blob:async()=>new Blob(['PNG'],{type:'image/png'})});f.w.navigator.canShare=()=>true;f.w.navigator.share=async()=>{calls++;};await f.w.consultarCartones();const b=f.cont.querySelector('[data-accion=compartir-cartones]');await b.onclick();assert.equal(calls,0);assert.equal(b.disabled,false);assert.match(f.cont.textContent,/No se pudo completar/);fail=false;await b.onclick();assert.equal(calls,1);}finally{f.close();}
});

test('preparar sin activación permite compartir en la siguiente pulsación y cancelar no muestra éxito',async()=>{
 const f=fixture({data:[{estado:'aprobado',cartones:['58']}]});
 try{let activo=false,calls=0;f.w.Blob=Blob;f.w.File=File;f.w.fetch=async()=>({ok:true,blob:async()=>new Blob(['PNG'],{type:'image/png'})});f.w.navigator.canShare=()=>true;Object.defineProperty(f.w.navigator,'userActivation',{value:{get isActive(){return activo;}}});f.w.navigator.share=async()=>{calls++;const e=Error();e.name='AbortError';throw e;};await f.w.consultarCartones();const b=f.cont.querySelector('[data-accion=compartir-cartones]');await b.onclick();assert.equal(calls,0);assert.match(f.cont.textContent,/Cartones listos/);activo=true;await b.onclick();assert.equal(calls,1);assert.equal(f.cont.querySelector('.compra-archivo-estado').textContent,'');assert.equal(b.disabled,false);f.w.navigator.canShare=()=>false;await b.onclick();assert.match(f.cont.textContent,/no permite compartir estas imágenes/);}finally{f.close();}
});

test('la cuadrícula dibuja las cuatro imágenes originales sin recortar ni redimensionar',async()=>{
 const f=fixture({data:[{estado:'aprobado',cartones:['1','2','3','4']}]});
 try{f.w.Blob=Blob;f.w.File=File;const imagenes=[],dibujos=[];let cierres=0,canvas;f.w.fetch=async()=>({ok:true,blob:async()=>new Blob(['PNG'],{type:'image/png'})});f.w.createImageBitmap=async file=>{const bitmap={width:240,height:320,name:file.name,close(){cierres++;}};imagenes.push(bitmap);return bitmap;};f.w.HTMLCanvasElement.prototype.getContext=function(){canvas=this;return{fillRect(){},drawImage(...args){dibujos.push(args);}};};f.w.navigator.canShare=()=>true;f.w.navigator.share=async()=>{};await f.w.consultarCartones();await f.cont.querySelector('[data-accion=compartir-cartones]').onclick();assert.equal(imagenes.length,4);assert.equal(dibujos.length,4);dibujos.forEach((args,i)=>{assert.equal(args[0],imagenes[i]);assert.equal(args.length,3);});assert.deepEqual(dibujos.map(x=>x.slice(1)),[[24,24],[288,24],[24,368],[288,368]]);assert.equal(canvas.width,552);assert.equal(canvas.height,712);assert.equal(cierres,4);}finally{f.close();}
});

