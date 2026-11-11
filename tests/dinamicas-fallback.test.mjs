import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/dinamicas-ia/handler.mjs';
import {reviewedFallback,fallbackThemes} from '../supabase/functions/dinamicas-ia/fallback.mjs';
const ADMIN='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5';
const levels=['Fácil','Media','Difícil','Muy difícil'];
const types=['Adivinanza','Trivia','Foto en casa','Acertijo','Palabra desordenada'];
const expected={
 'Objetos del hogar':['Cremallera','Tornillo','Termómetro','Brújula'],
 'Animales':['Ornitorrinco','Ajolote','Caballito de mar','Luciérnaga'],
 'Comida y frutas':['Casabe','Merengue','Levadura','Emulsión'],
 'Naturaleza':['Estalactita','Liquen','Estoma','Eclipse lunar'],
 'Venezuela':['Canaima','Coro','Tepuy','Araguaney'],
 'Palabras y lenguaje':['Anagrama','Palíndromo','Elipsis','Polisemia'],
 'Números y lógica':['Número primo','Hipotenusa','Número perfecto','Mínimo común múltiplo']
};
const env=k=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public',GEMINI_API_KEY:'test'})[k];
const request=body=>new Request('https://test.supabase.co/functions/v1/dinamicas-ia',{method:'POST',headers:{origin:'https://bingoandino75.com',authorization:'Bearer test'},body:JSON.stringify(body)});
const input=(type,theme,difficulty,previous=[])=>({action:'generate',type,theme,difficulty,previous});
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
test('180 combinaciones: cinco tipos, nueve temas y cuatro niveles funcionan con Gemini saturado',async()=>{
 assert.equal(fallbackThemes.length,9);
 for(const type of types)for(const theme of fallbackThemes)for(const difficulty of levels){
  let modelCalls=0;
  const h=createHandler(env,async url=>{if(url.includes('/auth/'))return Response.json({id:ADMIN,email_confirmed_at:'yes'});assert(url.includes('googleapis'));modelCalls++;return new Response('',{status:503});});
  const r=await h(request(input(type,theme,difficulty)));
  assert.equal(r.status,200,[type,theme,difficulty].join(' / '));const d=await r.json();
  assert(d.question&&d.answer&&d.explanation&&d.source);assert(d.question.length<2000);assert(d.answer.length<2000);assert(d.explanation.length<2000);assert(!d.error);
  if(['Acertijo','Palabra desordenada'].includes(type)){assert.equal(modelCalls,0);continue;}
  assert.equal(modelCalls,2);
  assert.match(d.source,/respaldo/);
  if(type==='Foto en casa'){
   const n=levels.indexOf(difficulty)+2;
   assert.match(d.question,new RegExp('RETO-\\d{4}'));
   assert.equal(d.question.split('\n').filter(s=>/^\d+\./.test(s)).length,n-1);
   assert.match(d.answer,new RegExp('los '+n+' objetos'));
   assert.match(d.question,/sin apilar/);
  }else if(type==='Adivinanza'&&theme==='Números y lógica'){
   assert.equal(d.answer.length,levels.indexOf(difficulty)+2);
  }else{
   const answers=d.answer.split('\n').map(s=>s.replace(/^\d+\. /,''));
   assert.equal(answers.length,{'Fácil':1,'Media':1,'Difícil':2,'Muy difícil':4}[difficulty]);
   if(expected[theme])for(const answer of answers)assert(expected[theme].includes(answer));
   for(const answer of answers)assert(!norm(d.question).includes(norm(answer)),[type,theme,answer].join(' / '));
  }
 }
});
test('la pausa de 60 segundos después del fallo evita insistir en los modelos caídos',async()=>{
 let calls=0,now=Date.now();
 const h=createHandler(env,async url=>{if(url.includes('/auth/'))return Response.json({id:ADMIN,email_confirmed_at:'yes'});calls++;return new Response('',{status:503});},()=>now);
 const body=input('Trivia','Animales','Muy difícil');
 assert.equal((await h(request(body))).status,200);assert.equal(calls,2);
 now+=4000;assert.equal((await h(request(body))).status,200);assert.equal(calls,2);
 now+=61000;assert.equal((await h(request(body))).status,200);assert.equal(calls,4);
});
test('sin clave configurada se puede usar la biblioteca con el mismo acceso de administrador',async()=>{
 let calls=0;const h=createHandler(k=>k==='GEMINI_API_KEY'?undefined:env(k),async url=>{assert(url.includes('/auth/'));calls++;return Response.json({id:ADMIN,email_confirmed_at:'yes'});});
 const r=await h(request(input('Trivia','Venezuela','Muy difícil')));assert.equal(r.status,200);assert.equal(calls,1);assert.match((await r.json()).source,/Biblioteca/);
});
test('agotar las variaciones avisa de repetición y mantiene las cuatro respuestas del nivel',()=>{
 const previous=[];let repeated=false;
 for(let i=0;i<32;i++){
  const d=reviewedFallback('Adivinanza','Animales','Muy difícil',previous);
  assert.equal(d.answer.split('\n').length,4);
  if(d.source.includes('ya utilizada')){repeated=true;break;}
  previous.push(d.question);
 }
 assert(repeated);
});
