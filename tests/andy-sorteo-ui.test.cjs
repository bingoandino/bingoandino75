const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const base=path.resolve(__dirname,"..");
const R=require(path.join(base,"andy-sorteo-rules.js"));
const B=require(path.join(base,"andy-chatgpt-brief.js"));
test("ANDY sorteo prepara datos exactos para ChatGPT sin generar PNG",()=>{
  const html=fs.readFileSync(path.join(base,"andy-estudio.html"),"utf8");
  const ids=[...html.matchAll(/id="andy-sd-([^"]+)"/g)].map(x=>x[1]);
  const elements=Object.fromEntries(ids.map(id=>[id,{
    id:"andy-sd-"+id,value:"",textContent:"",dataset:{},disabled:false,hidden:false,_events:{},
    addEventListener(ev,f){this._events[ev]=f;},setAttribute(){},focus(){},select(){}
  }]));
  const root={querySelector:s=>elements[s.slice(9)],querySelectorAll:()=>Object.values(elements)};
  elements.hora.value="20:00";elements["max-bolas"].value="52";elements["vista-formato"].value="post";
  const stored={};
  const sandbox={window:{AndySorteoRules:R,AndyChatGPTBrief:B},
    document:{getElementById:id=>id==="andy-sorteo-diario"?root:null},
    localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>{stored[k]=v;}},console};
  vm.runInNewContext(fs.readFileSync(path.join(base,"andy-sorteo.js"),"utf8"),sandbox);
  assert.ok(!ids.includes("canvas")&&!ids.includes("descargar-cuadrado")&&!ids.includes("descargar-historia"));
  assert.equal(elements.panel.hidden,true);
  elements.abrir._events.click();assert.equal(elements.panel.hidden,false);
  elements.abrir._events.click();assert.equal(elements.panel.hidden,true);
  elements.abrir._events.click();assert.equal(elements.panel.hidden,false);

  elements.fecha.value="2026-11-02";elements.fecha._events.input();
  for(const [id,v] of Object.entries({precio:"890","pozo-manual":"100"})){
    elements[id].value=v;elements[id]._events.input();
  }
  elements.sugerir._events.click();
  assert.equal(elements.presupuesto.textContent,"$540");
  assert.equal(elements["premio-final"].value,210);
  assert.equal(elements["preparar-chatgpt"].disabled,false);
  elements["preparar-chatgpt"]._events.click();
  assert.equal(elements["resultado-chatgpt"].hidden,false);
  assert.match(elements.prompt.value,/POZO ACUMULADO: \$100 USD/);
  assert.match(elements.prompt.value,/LLENO FINAL: \$210 USD/);
  assert.match(elements.prompt.value,/1080 × 1080/);
  elements["vista-formato"].value="story";elements["vista-formato"]._events.input();
  assert.equal(elements["resultado-chatgpt"].hidden,true);
  elements["preparar-chatgpt"]._events.click();
  assert.match(elements.prompt.value,/1080 × 1920/);

  elements.fecha.value="2026-11-07";elements.fecha._events.input();
  for(const [id,v] of Object.entries({precio:"890","pozo-manual":"130"})){
    elements[id].value=v;elements[id]._events.input();
  }
  elements.sugerir._events.click();
  assert.equal(elements.presupuesto.textContent,"$620");
  assert.equal(elements["premio-final"].value,270);
  elements["preparar-chatgpt"]._events.click();
  assert.match(elements.prompt.value,/POZO ACUMULADO: \$130 USD/);
  assert.match(elements.prompt.value,/SÁBADO ESPECIAL/);
  elements["pozo-manual"].value="";elements["pozo-manual"]._events.input();
  assert.equal(elements["preparar-chatgpt"].disabled,true);

  elements.fecha.value="2026-11-03";elements.fecha._events.input();
  for(const [id,v] of Object.entries({precio:"400","total-manual":"340","pozo-manual":"140"})){
    elements[id].value=v;elements[id]._events.input();
  }
  elements.sugerir._events.click();
  assert.equal(elements.presupuesto.textContent,"$340");
  assert.equal(elements["premio-final"].value,150);
  assert.equal(elements["preparar-chatgpt"].disabled,false);
  elements["preparar-chatgpt"]._events.click();
  assert.match(elements.prompt.value,/POZO ACUMULADO: \$140 USD/);
  assert.match(elements.prompt.value,/RONDA 5 · LLENO FINAL: \$150 USD/);
  elements["total-manual"].value="";elements["total-manual"]._events.input();
  assert.equal(elements["preparar-chatgpt"].disabled,true);
  assert.ok(!ids.includes("pozo-resultado")&&!ids.includes("pozo"));
});
