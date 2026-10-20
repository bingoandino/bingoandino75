const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('lector público usa únicamente resultados_publicados y renderiza texto seguro',async()=>{
 const dom=new JSDOM('<div id="listaGanadores"></div>',{runScripts:'outside-only'});const w=dom.window;
 try{
 const queried=[];const payload={fecha:'2026-10-19',grupos:[{tipo:'final',orden:2,ganadores:[{carton:3,premio_centimos:100}]}]};
 w.supabase={from:table=>{queried.push(table);return {select:fields=>{assert.ok(['fecha','resultado'].includes(fields));return {order:()=>({limit:async()=>({data:[{fecha:'2026-10-19'}]})}),eq:()=>({single:async()=>({data:{resultado:payload}})})}}}}};
 w.eval(read('publicacion.js'));
 const web=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
 w.eval('var supabase=window.supabase;'+web.slice(web.indexOf('async function cargarGanadores()'),web.indexOf('\nfunction toggleFormularioGanador')));
 await w.cargarGanadores();assert.deepEqual(queried,['resultados_publicados','resultados_publicados']);assert.match(w.document.body.textContent,/Cartón 3/);assert.ok(w.document.querySelector('select[aria-label="Fecha del sorteo"]'));
 }finally{w.close()}
});
