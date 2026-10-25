const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
test('una lista extensa se comparte completa en partes cortas, reintenta cancelaciones y reinicia si cambian los datos',async()=>{
 const d=setup(false);try{
  const w=d.window,table=w.document.createElement('table'),body=w.document.createElement('tbody');table.appendChild(body);w.document.querySelector('#contenedor-aprobados').appendChild(table);
  for(let i=1;i<=1200;i++){const tr=w.document.createElement('tr');for(const value of [String(i),'Participante Prueba '+i,'CEDULA-PRIVADA']){const td=w.document.createElement('td');td.textContent=value;tr.appendChild(td);}body.appendChild(tr);}
  const enviados=[];let cancelar=true;w.navigator.share=async data=>{if(cancelar){cancelar=false;const e=Error();e.name='AbortError';throw e;}enviados.push(data.text);};
  await w.compartirListaAprobados();const select=w.document.querySelector('select');assert.equal(select.value,'0');assert.ok(select.options.length>1);
  const n=select.options.length;for(let i=0;i<n;i++)await w.compartirListaAprobados();
  assert.equal(enviados.length,n);assert.ok(enviados.every(t=>t.length<2800));
  const all=enviados.join('\n');for(let i=1;i<=1200;i++)assert.equal(all.split('Cartón '+i+' ·').length-1,1);assert.doesNotMatch(all,/CEDULA-PRIVADA/);assert.match(all,/Parte 1 de/);assert.match(all,/Cartón 1200/);
  body.firstChild.remove();await w.compartirListaAprobados();assert.match(enviados.at(-1),/Parte 1 de/);assert.doesNotMatch(enviados.at(-1),/Cartón 1 ·/);
 }finally{d.window.close();}
});
function setup(rows=true){
 const dom=new JSDOM(`<button id="btnCompartirAprobados"></button><p id="estadoCompartirAprobados"></p><textarea id="textoCompartirAprobados" hidden></textarea><div id="contenedor-aprobados">${rows?'<table><tbody><tr><td>3</td><td>Ana Prueba</td><td>CEDULA-PRIVADA</td></tr><tr><td>750</td><td>Luz Prueba</td><td>TELEFONO-PRIVADO</td></tr></tbody></table>':''}</div>`,{runScripts:'outside-only'});
 const s=fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');dom.window.eval(s.slice(s.indexOf('function textoListaAprobados()'),s.indexOf('async function copiarListaAprobados()')));return dom;
}
test('comparte cartones y nombres sin cédulas ni información bancaria',async()=>{const d=setup();try{let data;d.window.navigator.share=async v=>{data=v;};await d.window.compartirListaAprobados();assert.match(data.text,/Cartón 3 · Ana Prueba/);assert.match(data.text,/Cartón 750 · Luz Prueba/);assert.match(data.text,/Total: 2 cartones/);assert.doesNotMatch(data.text,/PRIVAD/);assert.equal(d.window.document.querySelector('button').disabled,false);}finally{d.window.close();}});
test('sin compartir nativo copia la lista y si se deniega ofrece selección manual',async()=>{const d=setup();try{let text;d.window.navigator.clipboard={writeText:async t=>{text=t;}};await d.window.compartirListaAprobados();assert.match(text,/Ana Prueba/);assert.match(d.window.document.querySelector('p').textContent,/Lista copiada/);d.window.navigator.clipboard.writeText=async()=>{throw Error('denied');};await d.window.compartirListaAprobados();const area=d.window.document.querySelector('textarea');assert.equal(area.hidden,false);assert.equal(area.selectionEnd,area.value.length);assert.match(area.value,/Total: 2/);}finally{d.window.close();}});
test('cancelar no copia ni presenta éxito y una lista vacía no se comparte',async()=>{const d=setup();try{d.window.navigator.share=async()=>{const e=Error();e.name='AbortError';throw e;};await d.window.compartirListaAprobados();assert.equal(d.window.document.querySelector('p').textContent,'');d.window.document.querySelector('#contenedor-aprobados').replaceChildren();await d.window.compartirListaAprobados();assert.match(d.window.document.querySelector('p').textContent,/No hay aprobados/);}finally{d.window.close();}});
