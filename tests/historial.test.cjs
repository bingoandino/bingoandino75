const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('lector público usa únicamente resultados_publicos_con_nombres y renderiza texto seguro',async()=>{
 const dom=new JSDOM('<div id="listaGanadores"></div>',{runScripts:'outside-only'});const w=dom.window;w.HTMLCanvasElement.prototype.getContext=()=>({font:'',measureText:t=>({width:t.length*14})});
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
 const dom=new JSDOM('<div id="resultado"></div>',{runScripts:'outside-only'});const w=dom.window;w.HTMLCanvasElement.prototype.getContext=()=>({font:'',measureText:t=>({width:t.length*14})});
 try{w.eval(read('publicacion.js'));const payload={fecha:'2026-10-19',nombres:{'1':'Ana Prueba','2':'<img src=x onerror=alert(1)>','3':'Luz Prueba'},grupos:[{tipo:'ronda',orden:1,ganadores:[{carton:1,premio_centimos:2202500},{carton:2,premio_centimos:2202500}]},{tipo:'final',orden:2,ganadores:[{carton:3,premio_centimos:9250500}]},{tipo:'consolacion',orden:0,ganadores:[{carton:1,premio_centimos:881000},{carton:2,premio_centimos:881000}]}]};w.ResultadosPublicos.mostrar(w.document.getElementById('resultado'),payload);
 assert.equal(w.document.querySelector('.resultado-ronda .ganadores-premio').textContent,'44.050 Bs');assert.equal(w.document.querySelector('.resultado-ronda .ganadores-reparto').textContent,'22.025 Bs por ganador');assert.equal(w.document.querySelector('.resultado-consolacion .ganadores-premio').textContent,'8.810 Bs');assert.equal(w.document.querySelectorAll('.ganadores-nombre').length,5);assert.equal(w.document.querySelectorAll('img').length,0);assert.match(w.document.querySelector('.ganadores-fecha').textContent,/19 de octubre de 2026/);
 }finally{w.close()}
});
test('una verificación inicial tardía no vuelve a mostrar inicio encima del historial y la navegación vuelve arriba',async()=>{
 const dom=new JSDOM('<section id="bienvenida"><div id="redes-sociales"></div></section><section id="ganadores" class="oculto"></section><section id="admin-panel" class="oculto"></section><section id="admin-login" class="oculto"></section>',{runScripts:'outside-only',url:'https://bingoandino75.com',pretendToBeVisual:true});const w=dom.window;w.HTMLCanvasElement.prototype.getContext=()=>({font:'',measureText:t=>({width:t.length*14})});
 try{let loads=0,scrolls=0;w.cargarGanadores=()=>loads++;w.scrollTo=()=>scrolls++;const web=read('script.js');w.eval(web.slice(web.indexOf('function mostrarSeccion(id)'),web.indexOf('async function cargarListaAprobadosSeccion')));w.eval(web.slice(web.indexOf('async function verificarSesionInicial()'),web.indexOf('// ==================== FUNCIONES FALTANTES')));
 w.mostrarSeccion('ganadores');await w.verificarSesionInicial();assert.equal(w.document.getElementById('bienvenida').classList.contains('oculto'),true);assert.equal(w.document.getElementById('ganadores').classList.contains('oculto'),false);assert.equal(loads,1);assert.equal(scrolls,1);
 w.mostrarSeccion('bienvenida');assert.equal(w.document.getElementById('ganadores').classList.contains('oculto'),true);assert.equal(w.document.getElementById('bienvenida').classList.contains('oculto'),false);assert.equal(w.document.getElementById('redes-sociales').style.display,'flex');
 }finally{w.close()}
});

