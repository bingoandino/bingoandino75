const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const path=require('node:path');
const base=fs.existsSync(path.join(__dirname,'andy-sorteo-snippet.html'))?__dirname:path.resolve(__dirname,'..');
const R=require(path.join(base,'andy-sorteo-rules.js'));
const htmlFile=fs.existsSync(path.join(base,'andy-sorteo-snippet.html'))?'andy-sorteo-snippet.html':'andy-estudio.html';
test('editor ANDY initializes and draws both PNG formats without Canvas errors',()=>{
  const ids=[...fs.readFileSync(path.join(base,htmlFile),'utf8').matchAll(/id="andy-sd-([^"]+)"/g)].map(x=>x[1]);
  const elements=Object.fromEntries(ids.map(id=>[id,{id:'andy-sd-'+id,value:'',textContent:'',dataset:{},disabled:false,hidden:false,_events:{},addEventListener(ev,f){this._events[ev]=f;},setAttribute(){}}]));
  const root={querySelector:s=>elements[s.slice(9)],querySelectorAll:()=>Object.values(elements)};
  elements['hora'].value='20:00';elements['max-bolas'].value='52';elements['vista-formato'].value='post';
  const no=()=>{}, gradient={addColorStop:no};let writes=0,printed=[];
  const ctx={beginPath:no,clip:no,translate:no,rotate:no,scale:no,clearRect:no,roundRect:no,fill:no,stroke:no,fillRect:no,strokeRect:no,strokeText:no,arc:no,ellipse:no,moveTo:no,lineTo:no,closePath:no,save:no,restore:no,
    createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,fillText(s,x,y,max){if(arguments.length===4&&!Number.isFinite(max))throw Error('Non-finite Canvas width');writes++;printed.push(String(s));}};
  elements.canvas.getContext=()=>ctx;
  const stored={};
  const sandbox={window:{AndySorteoRules:R,AndySorteoArt:require(path.join(base,'andy-sorteo-art.js'))},document:{getElementById:id=>id==='andy-sorteo-diario'?root:null},
    localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>{stored[k]=v;}},console};
  vm.runInNewContext(fs.readFileSync(path.join(base,'andy-sorteo.js'),'utf8'),sandbox);
  assert.match(elements.validacion.textContent,/datos|Premio|Completa|cifra|premios|falta|Confirma|Revisa|⚠️/i);
  elements.fecha.value='2026-11-02';elements.fecha._events.input();
  for(const [id,v] of Object.entries({tasa:'',precio:'890','pozo-manual':'100'})){
    elements[id].value=v;elements[id]._events.input();
  }
  elements.sugerir._events.click();
  assert.equal(elements.presupuesto.textContent,'$540');
  assert.equal(elements['premio-final'].value,210);
  assert.equal(elements['descargar-cuadrado'].disabled,false);
  assert.ok(printed.includes('$100'), 'ANDY debe mostrar $100 sin sumar $10');
  assert.ok(writes>25);
  elements['vista-formato'].value='story';elements['vista-formato']._events.input();
  assert.equal(elements.canvas.height,1920);
  elements.fecha.value='2026-11-07';elements.fecha._events.input();
  for (const [id,v] of Object.entries({tasa:'890',precio:'890','pozo-manual':'130'})){
    elements[id].value=v;elements[id]._events.input();
  }
  elements.sugerir._events.click();
  assert.equal(elements.presupuesto.textContent,'$620');
  assert.equal(elements['premio-final'].value,270);
  assert.ok(printed.includes('$130'), 'El pozo del sábado debe ser exactamente el escrito');
  assert.equal(elements['descargar-cuadrado'].disabled,false);
  elements['vista-formato'].value='story';elements['vista-formato']._events.input();
  assert.equal(elements.canvas.height,1920);
  elements['pozo-manual'].value='';elements['pozo-manual']._events.input();
  assert.equal(elements['descargar-cuadrado'].disabled,true,'Sin pozo no se puede descargar un anuncio');
  elements['pozo-manual'].value='140';elements['pozo-manual']._events.input();
  assert.equal(elements['descargar-cuadrado'].disabled,false);
  assert.ok(printed.includes('$140'));
  assert.ok(!ids.includes('pozo-resultado')&&!ids.includes('pozo'),'La pantalla solo debe tener un campo de pozo');
  elements.fecha.value='2026-11-03';elements.fecha._events.input();
  for(const [id,v] of Object.entries({tasa:'',precio:'400','total-manual':'340','pozo-manual':'140'})){
    elements[id].value=v;elements[id]._events.input();
  }
  elements.sugerir._events.click();
  assert.equal(elements.presupuesto.textContent,'$340');
  assert.equal(elements['premio-final'].value,150);
  assert.equal(elements['descargar-cuadrado'].disabled,false,'Cinco rondas manuales no exigen tasa BCV');
  elements['total-manual'].value='';elements['total-manual']._events.input();
  assert.equal(elements['descargar-cuadrado'].disabled,true,'Sin tasa ni total no se puede inventar el presupuesto');
  elements['total-manual'].value='340';elements['total-manual']._events.input();
  assert.equal(elements['descargar-historia'].disabled,false);
});
