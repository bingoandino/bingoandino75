const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const M=require("../andy-marketing-pro.js");
test("ANDY Marketing Pro: próximos seis días excluyen el domingo",()=>{
 assert.deepEqual(M.comingDrawDates("2026-11-07",6),
  ["2026-11-07","2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13"]);
 assert.equal(M.mondayOf("2026-11-04"),"2026-11-02");
 assert.equal(M.mondayOf("2026-11-08"),"2026-11-02");
 assert.throws(()=>M.comingDrawDates("2026-13-90"),/Fecha/);
});
test("ANDY Marketing Pro: recomendaciones adaptadas a cada objetivo",()=>{
 const t=M.planFor("2026-11-03","ventas");
 assert.equal(t.day,"Martes");
 assert.equal(t.format,"reel");
 assert.match(t.title,/cartones/i);
 assert.match(t.caption,/bingoandino75.com/);
 assert.match(M.planFor("2026-11-03","alcance").caption,/Comparte este contenido/);
 assert.match(M.planFor("2026-11-07","fidelidad").caption,/Gracias por acompañarnos/);
 assert.throws(()=>M.planFor("2026-11-08","ventas"),/domingo/);
});
test("ANDY Marketing Pro: KPI manuales distinguen ausencia de dato de cero",()=>{
 const records=[
  {date:"2026-11-02",cards:700,purchases:400,inquiries:60,reach:2800},
  {date:"2026-11-03",cards:0,purchases:0,inquiries:null,reach:1200},
  {date:"2026-11-04",cards:550,purchases:320,inquiries:70,reach:null},
  {date:"2026-10-30",cards:99,purchases:99,inquiries:99,reach:99}
 ];
 const x=M.analyze(records,"2026-11-04");
 assert.equal(x.days,3);
 assert.equal(x.totals.cards,1250);
 assert.equal(x.totals.purchases,720);
 assert.equal(x.totals.inquiries,130);
 assert.equal(x.totals.reach,4000);
 assert.equal(x.lowest.date,"2026-11-03");
 assert.equal(x.highest.date,"2026-11-02");
 const no=M.analyze([],"2026-11-04");
 assert.equal(no.covered.cards,false);
 assert.equal(no.days,0);
});
test("No hay integración de API de pago en el editor del sorteo",()=>{
 const root=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"andy-estudio.html"),"utf8");
 const js=fs.readFileSync(path.join(root,"andy-sorteo.js"),"utf8");
 const endpoint=fs.readFileSync(path.join(root,"supabase/functions/andy-imagen-ia/index.ts"),"utf8");
 assert.match(html,/ANDY Marketing Pro/);
 assert.match(html,/id="andy-marketing-pro"/);
 assert.doesNotMatch(html,/andy-sd-ia-post|andy-sd-ia-story|andy-sd-ia-both/);
 assert.doesNotMatch(js,/api\.openai|generateAi\(|andy-imagen-ia|OPENAI_API_KEY/);
 assert.match(endpoint,/status:410/);
 assert.doesNotMatch(endpoint,/api\.openai|OPENAI_API_KEY/);
});
