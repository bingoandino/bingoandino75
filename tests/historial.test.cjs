const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('lector público usa únicamente resultados_publicos_con_nombres y renderiza texto seguro',async()=>{
 const dom=new JSDOM('<div id="listaGanadores"></div>',{runScripts:'outside-only'});const w=dom.window;
 try{
 const queried=[];const payload={nombres:{'3':'Ana Prueba'},fecha:'2026-10-19',grupos:[{tipo:'final',orden:2,ganadores:[{carton:3,premio_centimos:100}]}]};
 w.supabase={from:table=>{queried.push(table);return {select:fields=>{assert.ok(['fecha','resultado'].includes(fields));return {order:()=>({limit:async()=>({data:[{fecha:'2026-10-19'}]})}),eq:()=>({single:async()=>({data:{resultado:payload}})})}}}}};
 w.eval(read('publicacion.js'));
 const web=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
 w.eval('var supabase=window.supabase;'+web.slice(web.indexOf('async function cargarGanadores()'),web.indexOf('\nfunction toggleFormularioGanador')));
 await w.cargarGanadores();assert.deepEqual(queried,['resultados_publicos_con_nombres','resultados_publicos_con_nombres']);assert.match(w.document.body.textContent,/Ana Prueba/);assert.match(w.document.body.textContent,/Cartón 3/);assert.ok(w.document.querySelector('select[aria-label="Fecha del sorteo"]'));
 }finally{w.close()}
});
test('el diseño distingue el total compartido del premio individual y conserva todos los nombres como texto',()=>{
 const dom=new JSDOM('<div id="resultado"></div>',{runScripts:'outside-only'});const w=dom.window;
 try{w.eval(read('publicacion.js'));const payload={fecha:'2026-10-19',nombres:{'1':'Ana Prueba','2':'<img src=x onerror=alert(1)>','3':'Luz Prueba'},grupos:[{tipo:'ronda',orden:1,ganadores:[{carton:1,premio_centimos:2202500},{carton:2,premio_centimos:2202500}]},{tipo:'final',orden:2,ganadores:[{carton:3,premio_centimos:9250500}]},{tipo:'consolacion',orden:0,ganadores:[{carton:1,premio_centimos:881000},{carton:2,premio_centimos:881000}]}]};w.ResultadosPublicos.mostrar(w.document.getElementById('resultado'),payload);
 assert.equal(w.document.querySelector('.resultado-ronda .ganadores-premio').textContent,'44.050 Bs');assert.equal(w.document.querySelector('.resultado-ronda .ganadores-reparto').textContent,'22.025 Bs por ganador');assert.equal(w.document.querySelector('.resultado-consolacion .ganadores-premio').textContent,'8.810 Bs');assert.equal(w.document.querySelectorAll('.ganadores-nombre').length,5);assert.equal(w.document.querySelectorAll('img').length,0);assert.match(w.document.querySelector('.ganadores-fecha').textContent,/19 de octubre de 2026/);
 }finally{w.close()}
});
