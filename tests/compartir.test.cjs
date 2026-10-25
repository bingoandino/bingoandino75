const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function fixture(query=''){
 const dom=new JSDOM('<section id="bienvenida"></section><section id="ganadores" class="oculto"><div id="listaGanadores"></div></section><div id="modal-terminos" class="oculto"></div><div id="overlay-carga"></div>',{url:'https://bingoandino75.com/'+query,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.scrollTo=()=>{};
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
 const f=fixture('?ganadores=2026-10-23&secreto=NO-COPIAR');try{let copied;Object.defineProperty(f.w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});await f.w.cargarGanadores();await f.w.document.querySelector('.ganadores-compartir button').onclick();assert.match(copied,/https:\/\/bingoandino75.com\/\?ganadores=2026-10-23/);assert.doesNotMatch(copied,/NO-COPIAR|PRIVADO|secreto/);assert.match(f.w.document.querySelector('[role="status"]').textContent,/Mensaje copiado/);
 const input=f.w.document.querySelector('input[type=date]');input.value='2026-10-24';await input.onchange();await f.w.document.querySelector('.ganadores-compartir button').onclick();assert.match(copied,/ganadores=2026-10-24/);
 f.fail();input.value='2026-10-22';await input.onchange();assert.equal(f.w.document.querySelector('.ganadores-compartir'),null);
 }finally{f.close();}
});
test('si se deniega el portapapeles ofrece copiar manualmente y no afirma que publicó',async()=>{
 const f=fixture();try{Object.defineProperty(f.w.navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}}});await f.w.cargarGanadores();await f.w.document.querySelector('.ganadores-compartir button').onclick();const text=f.w.document.querySelector('textarea');assert.equal(text.hidden,false);assert.equal(text.selectionStart,0);assert.equal(text.selectionEnd,text.value.length);assert.match(f.w.document.querySelector('[role="status"]').textContent,/elige Copiar/);}finally{f.close();}
});
test('una fecha inválida no abre automáticamente ganadores y cancelar Compartir no muestra error',async()=>{
 const f=fixture('?ganadores=2026-02-31');try{assert.equal(f.w.ResultadosPublicos.fechaEnlace(),null);Object.defineProperty(f.w.navigator,'share',{value:async()=>{const e=Error('cancelado');e.name='AbortError';throw e;}});await f.w.cargarGanadores();await f.w.document.querySelector('.compartir-opciones').onclick();assert.equal(f.w.document.querySelector('[role="status"]').textContent,'');}finally{f.close();}
});
