const test=require("node:test");
const assert=require("node:assert/strict");
const Brief=require("../andy-chatgpt-brief.js");
test("Marketing produce briefs premium por formato sin asumir que crea videos",()=>{
  const base={title:"Así vivimos nuestro bingo",body:"Bolitas manuales · Bombo real",
    caption:"Una noche con la familia binguera 💜",cta:"Conoce el juego",script:"Escena 1: bombo",date:"2026-11-04"};
  const post=Brief.editorBrief({...base,format:"post"});
  const story=Brief.editorBrief({...base,format:"story"});
  const reel=Brief.editorBrief({...base,format:"reel"});
  assert.match(post,/1080 × 1080/);
  assert.match(story,/1080 × 1920/);
  assert.match(reel,/PORTADA DE REEL/);
  assert.match(reel,/no un video generado/i);
  assert.match(reel,/Escena 1: bombo/);
  for(const s of [post,story,reel]){
    assert.match(s,/morado profundo, marfil cálido y dorado metálico/);
    assert.match(s,/Bingo Andino 75/);
    assert.match(s,/bingoandino75.com/);
    assert.match(s,/Bolitas manuales/);
    assert.doesNotMatch(s,/OPENAI_API_KEY|api.openai.com/);
  }
  assert.throws(()=>Brief.editorBrief({format:"post"}),/Escribe al menos/);
});
test("El sorteo envía cifras exactas y mantiene el pozo separado",()=>{
  const d={format:"post",date:"2026-11-02",rounds:6,tickets:700,priceBs:890,
    total:540,pot:100,final:210,group1:50,group2:70,consolCount:4,consolValue:10,
    balls:52,hour:"20:00",saturday:false};
  const prompt=Brief.sorteoBrief(d);
  for(const phrase of ["$540 USD","$100 USD","$210 USD","890 Bs","700",
    "3: $50 USD","Rondas 4 y 5: $70 USD","52 bolitas"])
    assert.ok(prompt.includes(phrase),"Falta: "+phrase);
  assert.match(prompt,/no sumarlo al total a repartir/);
  assert.match(prompt,/literalmente; nunca las recalcules/);
  assert.throws(()=>Brief.sorteoBrief({...d,pot:110,total:999}),/Los premios no coinciden/);
  assert.match(Brief.sorteoBrief({...d,format:"story",saturday:true}),/SÁBADO ESPECIAL/);
});
test("Cinco rondas incluye exactamente cuatro llenos y un lleno final",()=>{
  const d={format:"story",date:"2026-11-03",rounds:5,tickets:1000,priceBs:400,
    total:340,pot:110,final:150,group1:40,group2:0,consolCount:3,consolValue:10,balls:52,hour:"20:00"};
  const prompt=Brief.sorteoBrief(d);
  assert.match(prompt,/Rondas 1, 2, 3 y 4: \$40 USD/);
  assert.match(prompt,/RONDA 5 · LLENO FINAL: \$150 USD/);
  assert.match(prompt,/POZO ACUMULADO: \$110 USD/);
  assert.doesNotMatch(prompt,/Rondas 4 y 5: \$0/);
  assert.throws(()=>Brief.sorteoBrief({...d,final:155}),/no coinciden/);
});
