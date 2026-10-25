const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function fixture(query=''){
 const dom=new JSDOM('<section id="bienvenida"></section><section id="ganadores" class="oculto"><div id="listaGanadores"></div></section><div id="modal-terminos" class="oculto"></div><div id="overlay-carga"></div>',{url:'https://bingoandino75.com/'+query,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.scrollTo=()=>{};
 w.HTMLCanvasElement.prototype.getContext=()=>({font:'',measureText:t=>({width:t.length*16}),beginPath(){},roundRect(){},fill(){},fillRect(){},fillText(){},drawImage(){}});w.HTMLCanvasElement.prototype.toBlob=function(cb){cb(new w.Blob(['PNG'],{type:'image/png'}));};
 w.Image=class {set src(value){this.source=value;queueMicrotask(()=>this.onload());}};
 const consulted=[],opened=[];let fail=false;w.mostrarSeccion=id=>{opened.push(id);w.document.getElementById(id).classList.remove('oculto');w.document.getElementById('bienvenida').classList.add('oculto');};
 w.supabase={from:table=>{assert.equal(table,'resultados_publicos_con_nombres');return {select:()=>({order:()=>({limit:async()=>({data:[{fecha:'2026-10-24'},{fecha:'2026-10-23'}]})}),eq:(key,date)=>({single:async()=>{consulted.push(date);return fail?{error:{message:'red'}}:{data:{resultado:{fecha:date,nombres:{'3':'Ana'},grupos:[{tipo:'final',orden:1,ganadores:[{carton:3,premio_centimos:100}]}],pago_banco:'PRIVADO',telefono:'NO-COPIAR'}}};}})})}}};
 w.eval(read('publicacion.js'));const source=read('script.js');w.eval('var supabase=window.supabase;'+source.slice(source.indexOf('async function cargarGanadores()'),source.indexOf('\nfunction toggleFormularioGanador')));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,consulted,opened,fail:()=>{fail=true;},close:()=>w.close()};
}
test('el enlace compartido abre su fecha aunque ya no esté entre las cien recientes',async()=>{
 const f=fixture('?ganadores=2026-09-01');try{assert.equal(f.opened[0],'ganadores');await f.w.cargarGanadores();assert.equal(f.consulted.at(-1),'2026-09-01');assert.match(f.w.document.querySelector('.ganadores-fecha').textContent,/1 de septiembre/);}finally{f.close();}
});
test('copia fecha y enlace exactos sin datos bancarios y cambia al elegir otro sorteo',async()=>{
 const f=fixture('?ganadores=2026-10-23&secreto=NO-COPIAR');try{let copied;Object.defineProperty(f.w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});await f.w.cargarGanadores();await f.w.document.querySelector('[data-accion=copiar]').onclick();assert.match(copied,/https:\/\/bingoandino75.com\/\?ganadores=2026-10-23/);assert.doesNotMatch(copied,/NO-COPIAR|PRIVADO|secreto/);assert.match(f.w.document.querySelector('[role="status"]').textContent,/Mensaje copiado/);
 const input=f.w.document.querySelector('input[type=date]');input.value='2026-10-24';await input.onchange();await f.w.document.querySelector('[data-accion=copiar]').onclick();assert.match(copied,/ganadores=2026-10-24/);
 f.fail();input.value='2026-10-22';await input.onchange();assert.equal(f.w.document.querySelector('.ganadores-compartir'),null);
 }finally{f.close();}
});
test('si se deniega el portapapeles ofrece copiar manualmente y no afirma que publicó',async()=>{
 const f=fixture();try{Object.defineProperty(f.w.navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}}});await f.w.cargarGanadores();await f.w.document.querySelector('[data-accion=copiar]').onclick();const text=f.w.document.querySelector('textarea');assert.equal(text.hidden,false);assert.equal(text.selectionStart,0);assert.equal(text.selectionEnd,text.value.length);assert.match(f.w.document.querySelector('[role="status"]').textContent,/elige Copiar/);}finally{f.close();}
});
test('una fecha inválida no abre automáticamente ganadores y cancelar el envío de imagen no muestra error',async()=>{
 const f=fixture('?ganadores=2026-02-31');try{assert.equal(f.w.ResultadosPublicos.fechaEnlace(),null);Object.defineProperty(f.w.navigator,'canShare',{value:()=>true});Object.defineProperty(f.w.navigator,'share',{value:async()=>{const e=Error('cancelado');e.name='AbortError';throw e;}});await f.w.cargarGanadores();await f.w.document.querySelector('.ganadores-compartir').preparacion();await f.w.document.querySelector('[data-accion=imagen]').onclick();assert.equal(f.w.document.querySelector('[role="status"]').textContent,'');}finally{f.close();}
});
test('comparte un archivo PNG y el enlace de la misma fecha con una sola pulsación',async()=>{
 const f=fixture('?ganadores=2026-10-23');try{let sent;Object.defineProperty(f.w.navigator,'canShare',{value:({files})=>files[0].type==='image/png'});Object.defineProperty(f.w.navigator,'share',{value:async data=>{sent=data;}});await f.w.cargarGanadores();const caja=f.w.document.querySelector('.ganadores-compartir');await caja.preparacion();await caja.querySelector('[data-accion=imagen]').onclick();assert.equal(sent.files[0].name,'ganadores-bingoandino75-2026-10-23.png');assert.equal(sent.files[0].type,'image/png');assert.match(sent.text,/ganadores=2026-10-23/);assert.doesNotMatch(sent.text,/PRIVADO|NO-COPIAR/);}finally{f.close();}
});
test('sin soporte para compartir archivos ofrece descargar y copiar sin enviar solo texto por error',async()=>{
 const f=fixture();try{let called=false;Object.defineProperty(f.w.navigator,'canShare',{value:()=>false});Object.defineProperty(f.w.navigator,'share',{value:async()=>{called=true;}});await f.w.cargarGanadores();const caja=f.w.document.querySelector('.ganadores-compartir');await caja.preparacion();await caja.querySelector('[data-accion=imagen]').onclick();assert.equal(called,false);assert.match(caja.querySelector('[role="status"]').textContent,/Descargar imagen/);assert.equal(caja.querySelector('.compartir-opciones').disabled,false);}finally{f.close();}
});
test('la imagen rasteriza la misma composición pública que muestra la página, sin datos adicionales',async()=>{
 const f=fixture();try{
 let source,drawn=false;f.w.Image=class {set src(value){source=decodeURIComponent(value.split(',').slice(1).join(','));queueMicrotask(()=>this.onload());}};
 f.w.HTMLCanvasElement.prototype.getContext=()=>({font:'',measureText:t=>({width:t.length*16}),drawImage(){drawn=true;}});
 const nombres={};const grupos=Array.from({length:5},(_,i)=>({tipo:'ronda',orden:i+1,ganadores:[{carton:i+1,premio_centimos:1000}]}));grupos.push({tipo:'final',ganadores:[{carton:6,premio_centimos:5000},{carton:7,premio_centimos:5000}]},{tipo:'consolacion',ganadores:[{carton:8,premio_centimos:100},{carton:9,premio_centimos:100}]},{tipo:'pozo',ganadores:[{carton:10,premio_centimos:9000}]});for(let i=1;i<=10;i++)nombres[i]='Ganador Prueba '+i;nombres[7]='Nombre Largo '.repeat(15);
 const payload={fecha:'2026-10-23',grupos,nombres,telefono:'PRIVADO',pago_banco:'PRIVADO'};
 const target=f.w.document.createElement('div');f.w.ResultadosPublicos.mostrar(target,payload);
 await f.w.ResultadosPublicos.crearImagen(payload);
 assert.equal(source,new f.w.XMLSerializer().serializeToString(target.querySelector('svg')));assert.ok(drawn);
 for(let i=1;i<=10;i++)assert.match(source,new RegExp('Cartón '+i+'<'));
 assert.match(source,/5ª ronda/);assert.match(source,/Cartón lleno final/);assert.match(source,/Consolación/);assert.match(source,/Pozo acumulado/);assert.doesNotMatch(source,/PRIVADO/);assert.ok(target.querySelectorAll('.ganadores-nombre tspan').length>15);
 }finally{f.close();}
});
