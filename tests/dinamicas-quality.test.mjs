import test from 'node:test';
import assert from 'node:assert/strict';
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
function harness(sequence){const calls=[];const handler=createHandler(env,async(url,opts)=>{if(url.includes('/auth/'))return Response.json({id:'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',email_confirmed_at:'yes'});calls.push(JSON.parse(opts.body));const item=sequence.shift();assert(item,'unexpected model request');return item instanceof Response?item:completion(item)});return {handler,calls};}
test('una propuesta fácil se descarta y se regenera automáticamente; revisor no ve solución del autor',async()=>{
 const {handler,calls}=harness([{...draft},{...good,notObvious:false},{...draft},good]);
 const r=await handler(req());assert.equal(r.status,200);assert.equal(calls.length,4);
 for(const i of [1,3]){const data=JSON.parse(calls[i].contents[0].parts[0].text);assert.deepEqual(Object.keys(data).sort(),['question','theme']);assert(!JSON.stringify(data).includes(draft.answer));}
 assert.equal((await r.json()).explanation,good.explanation);
});
test('dos soluciones discrepantes no se publican como éxito',async()=>{
 const {handler,calls}=harness([{...draft},{...good,answer:'Espejo'},{...draft},{...good,answer:'Telescopio'}]);
 const r=await handler(req());assert.equal(r.status,422);assert.equal(calls.length,4);assert(!(await r.json()).question);
});
test('un error de cuota del proveedor no provoca más llamadas',async()=>{
 const {handler,calls}=harness([new Response('',{status:429})]);assert.equal((await handler(req())).status,502);assert.equal(calls.length,1);
});
test('acertijos y anagramas se comprueban sin pedirle al modelo que invente la solución',async()=>{
 for(const type of ['Acertijo','Palabra desordenada']){
  const {handler,calls}=harness([]);const r=await handler(req({...input,type,theme:'Venezuela',previous:['x'.repeat(1800)]}));
  assert.equal(r.status,200);const d=await r.json();assert(d.answer);assert(d.question);assert.equal(calls.length,0);
 }
});
