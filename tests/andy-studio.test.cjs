const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'andy-estudio.html'), 'utf8');
const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const studioJS = fs.readFileSync(path.join(root, 'andy-studio.js'), 'utf8');
const studioCSS = fs.readFileSync(path.join(root, 'andy-studio.css'), 'utf8');
const briefJS = fs.readFileSync(path.join(root, 'andy-chatgpt-brief.js'), 'utf8');
function fixture(initial = []) {
  const dom = new JSDOM(html, { url: 'https://bingoandino75.com/', runScripts:'outside-only' });
  const w = dom.window;
  w.confirm = () => true;
  const calls=[];
  w.fetch=(...args)=>{calls.push(args);throw new Error('Estudio no puede llamar servicios remotos');};
  if(initial.length) w.localStorage.setItem('bingo_andino_andy_borradores_v1',JSON.stringify(initial));
  w.eval(briefJS);
  w.eval(studioJS);
  const $ = (id) => w.document.getElementById(id);
  const saved=()=>JSON.parse(w.localStorage.getItem('bingo_andino_andy_borradores_v1')||'[]');
  return {w,dom,$,calls,saved,close:()=>dom.window.close()};
}
function input(f,id,value){
  f.$(id).value=value;
  f.$(id).dispatchEvent(new f.w.Event('input',{bubbles:true}));
}
test('ANDY se aísla del inicio y conserva intactas compras y administrador',()=>{
  assert.match(html,/id="tab-andy-estudio"/);
  assert.match(html,/andy-gate.js/);
  assert.match(html,/andy-studio.css/);
  assert.doesNotMatch(homepage,/andy-studio.js|andy-gate.js|tab-andy-estudio/);
  assert.match(homepage,/onclick="mostrarVentana\('inscripcion'\)"/);
  assert.match(homepage,/id="btnEnviarComprobante"/);
  assert.match(studioCSS,/#tab-andy-estudio/);
  assert.doesNotMatch(studioJS,/from\(["']inscripciones["']\)|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test('guarda borradores localmente y jamás intenta publicar',()=>{
  const f=fixture();
  try{
    input(f,'andy-titulo','Familia binguera');
    input(f,'andy-pie','Gracias por acompañarnos 💜');
    f.$('andy-guardar').click();
    assert.equal(f.saved().length,1);
    assert.equal(f.saved()[0].title,'Familia binguera');
    assert.equal(f.$('andy-cantidad').textContent,'1');
    assert.equal(f.calls.length,0);
    assert.match(f.$('andy-estado').textContent,/No se ha publicado/);
  }finally{f.close();}
});
test('la aprobación guarda la última versión de texto, sin publicar en Instagram',()=>{
  const f=fixture();
  try{
    input(f,'andy-titulo','Bienvenida');
    input(f,'andy-pie','Primera versión');
    f.$('andy-guardar').click();
    input(f,'andy-pie','Segunda versión revisada');
    f.$('andy-aprobar').click();
    assert.equal(f.saved()[0].state,'aprobado');
    assert.equal(f.saved()[0].caption,'Segunda versión revisada');
    assert.equal(f.$('andy-aprobados').textContent,'1');
    assert.equal(f.$('andy-aprobar').disabled,false);
    assert.equal(f.calls.length,0);
  }finally{f.close();}
});
test('genera seis propuestas con fecha y nunca las marca como publicadas',()=>{
  const f=fixture();
  try{
    f.$('andy-ideas').click();
    assert.equal(f.saved().length,6);
    assert.equal(new Set(f.saved().map(x=>x.format)).size,3);
    assert.equal(f.saved().every(x=>x.state==='borrador'),true);
    assert.equal(f.saved().every(x=>x.date && new Date(x.date+'T12:00:00Z').getUTCDay()!==0),true);
    assert.equal(f.$('andy-agendados').textContent,'6');
    assert.equal(f.calls.length,0);
  }finally{f.close();}
});
test('guion de reels visible al elegir Reel; no se ofrece una descarga PNG básica',()=>{
  const f=fixture();
  try{
    input(f,'andy-formato','reel');
    assert.equal(f.$('andy-formato').value,'reel');
    assert.equal(f.$('andy-guion-grupo').hidden,false);
    assert.equal(f.$('andy-descargar'),null);
    assert.equal(f.$('andy-vista'),null);
  }finally{f.close();}
});
test('un título malicioso se muestra como texto, no como HTML',()=>{
  const f=fixture();
  try{
    input(f,'andy-titulo','<img src=x onerror=alert(1)>');
    input(f,'andy-pie','texto seguro');
    f.$('andy-guardar').click();
    f.$('andy-preparar-chatgpt').click();
    assert.match(f.$('andy-chatgpt-prompt').value,/<img src=x onerror=alert\(1\)>/);
    assert.equal(f.$('andy-chatgpt-resultado').querySelector('img'),null);
    assert.equal(f.$('andy-lista').querySelector('img'),null);
    assert.equal(f.calls.length,0);
  }finally{f.close();}
});
test('mantiene borradores antiguos y nunca llama a red para recuperarlos',()=>{
  const f=fixture([{id:'offline-1',format:'story',theme:'seguridad',title:'Cuidado con estafas',
    body:'No compartas códigos',caption:'Recordatorio de seguridad',cta:'Cuidémonos',
    date:'2026-11-04',time:'18:00',state:'borrador',script:'',updatedAt:'2026-11-04T00:00:00Z'}]);
  try{
    assert.equal(f.$('andy-cantidad').textContent,'1');
    f.$('andy-lista').querySelector('button').click();
    assert.equal(f.$('andy-titulo').value,'Cuidado con estafas');
    assert.equal(f.$('andy-formato').value,'story');
    assert.equal(f.calls.length,0);
  }finally{f.close();}
});
test('no guarda si falta título o pie de Instagram',()=>{
  const f=fixture();
  try{
    f.$('andy-guardar').click();
    assert.equal(f.saved().length,0);
    assert.match(f.$('andy-estado').textContent,/Escribe un título/);
  }finally{f.close();}
});

test('editar una pieza aprobada invalida su aprobación hasta revisar de nuevo',()=>{
 const f=fixture();
 try {
   input(f,'andy-titulo','Mensaje inicial');
   input(f,'andy-pie','Primer contenido');
   f.$('andy-guardar').click();
   f.$('andy-aprobar').click();
   assert.equal(f.saved()[0].state,'aprobado');
   input(f,'andy-pie','Nuevo contenido sin aprobar');
   f.$('andy-guardar').click();
   assert.equal(f.saved()[0].state,'revision');
   assert.equal(f.$('andy-aprobados').textContent,'0');
 }finally{f.close();}
});
test('una instrucción nueva no sobrescribe el borrador seleccionado',()=>{
 const f=fixture();
 try {
   input(f,'andy-titulo','Primer borrador');
   input(f,'andy-pie','Texto primero');
   f.$('andy-guardar').click();
   input(f,'andy-orden','Una historia sobre seguridad');
   f.$('andy-brief-crear').click();
   assert.equal(f.$('andy-formato').value,'story');
   assert.equal(f.$('andy-tema').value,'seguridad');
   f.$('andy-guardar').click();
   assert.equal(f.saved().length,2);
   assert.equal(f.saved().some(v=>v.title==='Primer borrador'),true);
   assert.equal(f.calls.length,0);
 }finally{f.close();}
});

test('agenda de siete días enseña propuestas y permite abrirlas',()=>{
 const f=fixture();
 try {
   f.$('andy-ideas').click();
   const days=f.$('andy-agenda').querySelectorAll('.andy-day');
   assert.equal(days.length,7);
   const scheduled=f.$('andy-agenda').querySelectorAll('button.andy-day-item');
   assert.ok(scheduled.length>=4);
   scheduled[0].click();
   assert.ok(f.$('andy-titulo').value.length>0);
   assert.equal(f.calls.length,0);
 }finally{f.close();}
});

test('prepara instrucciones profesionales para copiar aquí en ChatGPT sin llamar a una API',()=>{
 const f=fixture();
 try{
   input(f,'andy-formato','story');
   input(f,'andy-titulo','¡Familia binguera!');
   input(f,'andy-mensaje','Bombo real y bolitas manuales');
   input(f,'andy-pie','Hoy acompañamos a la familia binguera.');
   f.$('andy-preparar-chatgpt').click();
   assert.equal(f.$('andy-chatgpt-resultado').hidden,false);
   const prompt=f.$('andy-chatgpt-prompt').value;
   assert.match(prompt,/1080 × 1920/);
   assert.match(prompt,/morado profundo, marfil cálido y dorado metálico/);
   assert.match(prompt,/Bombo real y bolitas manuales/);
   assert.match(prompt,/ChatGPT|Bingo Andino 75/);
   assert.equal(f.calls.length,0);
   input(f,'andy-titulo','Cambié el texto');
   assert.equal(f.$('andy-chatgpt-resultado').hidden,true,
     'No se debe mantener a la vista un brief con información desactualizada');
 }finally{f.close();}
});
