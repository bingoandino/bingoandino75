import test from 'node:test';
import assert from 'node:assert/strict';
import {numberRiddle} from '../supabase/functions/dinamicas-ia/number-riddle.mjs';
import {createLogic} from '../supabase/functions/dinamicas-ia/logic.mjs';
import {acceptReview} from '../supabase/functions/dinamicas-ia/quality.mjs';
import {createHandler} from '../supabase/functions/dinamicas-ia/handler.mjs';
import {wordChoices,verifiedWord} from '../supabase/functions/dinamicas-ia/wordbank.mjs';
import {scramble,weakShuffle} from '../supabase/functions/dinamicas-ia/shuffle.mjs';

// Independent test solver parses the actual published wording, not the
// generator's constraints or its holds()/permutations() implementation.
function orders(items){let rows=[[]];for(const x of items)rows=rows.flatMap(row=>Array.from({length:row.length+1},(_,i)=>[...row.slice(0,i),x,...row.slice(i)]));return rows;}
function satisfies(row,text){
 let m;if(m=text.match(/^Entre (.+) y (.+) hay exactamente (\d+) tarjeta/))return Math.abs(row.indexOf(m[1])-row.indexOf(m[2]))===Number(m[3])+1;
 if(m=text.match(/^(.+) y (.+) no están juntas\./))return Math.abs(row.indexOf(m[1])-row.indexOf(m[2]))!==1;
 if(m=text.match(/^(.+) está inmediatamente a la derecha de (.+)\./))return row.indexOf(m[1])===row.indexOf(m[2])+1;
 if(m=text.match(/^(.+) está a la izquierda de (.+)\./))return row.indexOf(m[1])<row.indexOf(m[2]);
 throw Error('unparsed clue: '+text);
}
test('800 acertijos: el texto tiene una sola solución y ninguna pista sobra',()=>{
 for(const theme of ['', 'Venezuela','Animales','Naturaleza','Comida y frutas','Objetos del hogar','Palabras y lenguaje','Números y lógica']){
  for(const [level,n] of Object.entries({'Fácil':3,'Media':4,'Difícil':5,'Muy difícil':6}))for(let i=0;i<25;i++){
   const d=createLogic(theme,level),names=d.question.match(/todas distintas: (.+)\./)[1].split(', ');
   const clues=d.question.split('\n').filter(s=>/^\d+\. /.test(s)).map(s=>s.replace(/^\d+\. /,''));
   assert.equal(names.length,n);const candidates=orders(names);
   const solutions=candidates.filter(row=>clues.every(c=>satisfies(row,c)));
   assert.equal(solutions.length,1);assert.equal(solutions[0].join(' → '),d.answer);
   assert(clues.length>=n-1);
   for(let j=0;j<clues.length;j++)assert(candidates.filter(row=>clues.filter((_,k)=>j!==k).every(c=>satisfies(row,c))).length>1);
   if(n>=5){assert(!d.question.includes('inmediatamente'));assert(d.question.includes('Entre '));}
  }
 }
});
const good={answer:'Un caleidoscopio',explanation:'La combinación de todas las pistas permite identificar el caleidoscopio.',valid:true,unique:true,factsCertain:true,themeFits:true,notObvious:true,inferences:4,issues:''};
const draft={question:'Enunciado de prueba sin la solución a la vista.',answer:'Caleidoscopio',explanation:'Borrador',letters:'',category:''};
test('rechaza ambigüedad, datos dudosos, nivel bajo, tema incorrecto y respuestas discrepantes',()=>{
 assert.throws(()=>acceptReview({...draft,answer:'Un mapa'},{...good,answer:'Mapa'},'Adivinanza','Media'),/classic_riddle/);
 for(const patch of [{unique:false},{valid:false},{factsCertain:false},{themeFits:false},{notObvious:false},{inferences:1},{answer:'Telescopio'},{issues:'Pista incorrecta'}])assert.throws(()=>acceptReview({...draft},{...good,...patch},'Adivinanza','Muy difícil'));
 assert.throws(()=>acceptReview({...draft,question:'Describe este caleidoscopio.'},good,'Adivinanza','Media'));
 assert.equal(acceptReview({...draft},good,'Adivinanza','Muy difícil').explanation,good.explanation);
});
test('anagramas conservan letras y no admiten PASTELEA ni UQESILLO',()=>{
 const choices=wordChoices('Venezuela','Media');assert.throws(()=>verifiedWord({answer:'PASTELEA'},choices));
 assert(weakShuffle('QUESILLO','UQESILLO'));
 for(let i=0;i<100;i++){const s=scramble('QUESILLO','UQESILLO');assert(!weakShuffle('QUESILLO',s));assert.equal([...s].sort().join(''),[...'QUESILLO'].sort().join(''));}
});
test('fotos requieren el número de objetos del nivel, condiciones y papel de control',()=>{
 const r={...good,objectCount:5,conditionCount:4,controlPaper:true,safePhoto:true};
 assert.doesNotThrow(()=>acceptReview({...draft},r,'Foto en casa','Muy difícil'));
 for(const patch of [{objectCount:2},{conditionCount:1},{controlPaper:false},{safePhoto:false}])assert.throws(()=>acceptReview({...draft},{...r,...patch},'Foto en casa','Muy difícil'));
});
const env=k=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public',GEMINI_API_KEY:'test-only'})[k];
const input={action:'generate',type:'Adivinanza',theme:'',difficulty:'Muy difícil',previous:[]};
const req=(body=input)=>new Request('https://test.supabase.co/functions/v1/dinamicas-ia',{method:'POST',headers:{origin:'https://bingoandino75.com',authorization:'Bearer test'},body:JSON.stringify(body)});
const completion=d=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(d)}]}}]});
function harness(sequence){const calls=[],urls=[];const handler=createHandler(env,async(url,opts)=>{if(url.includes('/auth/'))return Response.json({id:'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',email_confirmed_at:'yes'});calls.push(JSON.parse(opts.body));urls.push(url);const item=sequence.shift();assert(item,'unexpected model request');if(item instanceof Error)throw item;return item instanceof Response?item:completion(item)});return {handler,calls,urls};}
test('una propuesta fácil se descarta y se regenera automáticamente; revisor no ve solución del autor',async()=>{
 const {handler,calls}=harness([{...draft},{...good,notObvious:false},{...draft},good]);
 const r=await handler(req());assert.equal(r.status,200);assert.equal(calls.length,4);
 for(const i of [1,3]){const data=JSON.parse(calls[i].contents[0].parts[0].text);assert.deepEqual(Object.keys(data).sort(),['question','theme']);assert(!JSON.stringify(data).includes(draft.answer));}
 assert.equal((await r.json()).explanation,good.explanation);
});
test('dos soluciones discrepantes no se publican como éxito',async()=>{
 const {handler,calls}=harness([{...draft},{...good,answer:'Espejo'},{...draft},{...good,answer:'Telescopio'}]);
 const r=await handler(req({...input,theme:'Naturaleza'}));assert.equal(r.status,422);assert.equal(calls.length,4);assert(!(await r.json()).question);
});
test('un error de cuota del proveedor no provoca más llamadas',async()=>{
 const {handler,calls}=harness([new Response('',{status:429})]);assert.equal((await handler(req())).status,502);assert.equal(calls.length,1);
});
test('saturación al revisar usa Gemini de respaldo sin regenerar la pregunta ni saltarse la revisión',async()=>{
 const {handler,calls,urls}=harness([{...draft},new Response('',{status:503}),good]);
 const response=await handler(req());assert.equal(response.status,200);assert.equal(calls.length,3);
 assert.match(urls[1],/gemini-3\.5-flash-lite/);assert.match(urls[2],/gemini-3\.6-flash/);assert.deepEqual(calls[1].contents,calls[2].contents);
 assert.deepEqual(calls[1].generationConfig.responseSchema,calls[2].generationConfig.responseSchema);
});
test('dos modelos saturados muestran indisponibilidad y no una dinámica sin revisar',async()=>{
 const {handler,calls}=harness([new Response('',{status:503}),new Response('',{status:503})]);
 const response=await handler(req({...input,theme:'Naturaleza'}));assert.equal(response.status,503);assert.equal(calls.length,2);
 const data=await response.json();assert.match(data.error,/saturado/);assert(!data.question);
});
test('errores de solicitud no se intentan con otro modelo',async()=>{
 const {handler,calls}=harness([new Response('',{status:400})]);
 assert.equal((await handler(req())).status,502);assert.equal(calls.length,1);
});
test('acertijos y anagramas se comprueban sin pedirle al modelo que invente la solución',async()=>{
 for(const type of ['Acertijo','Palabra desordenada']){
  const {handler,calls}=harness([]);const r=await handler(req({...input,type,theme:'Venezuela',previous:['x'.repeat(1800)]}));
  assert.equal(r.status,200);const d=await r.json();assert(d.answer);assert(d.question);assert.equal(calls.length,0);
 }
});

const pos=['primera','segunda','tercera','cuarta','quinta'];
function numericCheck(d,line){let m;
 if(m=line.match(/La suma de todas mis cifras es (\d+)/))return d.reduce((a,b)=>a+b,0)===Number(m[1]);
 if(m=line.match(/Mi (\w+) cifra más mi (\w+) cifra suman (\d+)/))return d[pos.indexOf(m[1])]+d[pos.indexOf(m[2])]===Number(m[3]);
 if(m=line.match(/Mi (\w+) cifra supera a mi (\w+) cifra en (\d+)/))return d[pos.indexOf(m[1])]-d[pos.indexOf(m[2])]===Number(m[3]);
 if(m=line.match(/El doble de mi (\w+) cifra más mi (\w+) cifra da (\d+)/))return 2*d[pos.indexOf(m[1])]+d[pos.indexOf(m[2])]===Number(m[3]);
 throw Error('unparsed numeric clue');
}
test('respaldo numérico: el texto se resuelve de forma única en todos los niveles',()=>{
 for(const [level,n] of Object.entries({'Fácil':2,'Media':3,'Difícil':4,'Muy difícil':5})){
  const pool=[];for(let k=10**(n-1);k<10**n;k++){const a=String(k).split('').map(Number);if(!a.includes(0)&&new Set(a).size===n)pool.push(a);}
  for(let i=0;i<10;i++){const r=numberRiddle('',level),clues=r.question.split('\n').filter(x=>/^\d+\./.test(x));assert(clues.length>=n);const solutions=pool.filter(d=>clues.every(c=>numericCheck(d,c)));assert.equal(solutions.length,1);assert.equal(solutions[0].join(''),r.answer);for(let j=0;j<clues.length;j++)assert(pool.filter(d=>clues.filter((_,k)=>j!==k).every(c=>numericCheck(d,c))).length>1);}
 }
 assert.equal(numberRiddle('Naturaleza','Muy difícil'),null);
});
test('si ambos Gemini fallan, Sorpréndeme devuelve respaldo verificado del mismo nivel',async()=>{
 const {handler,calls}=harness([new Response('',{status:503}),new Response('',{status:503})]);const r=await handler(req());assert.equal(r.status,200);const data=await r.json();assert.match(data.source,/respaldo comprobado/);assert.match(data.answer,/^[1-9]{5}$/);assert.equal(calls.length,2);
});
