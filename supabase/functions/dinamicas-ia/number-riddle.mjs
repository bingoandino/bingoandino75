// A verified numeric riddle for general/numeric themes when Gemini is
// unavailable. Every candidate is enumerated; clues never reveal a digit.
const sizes={'Fácil':2,'Media':3,'Difícil':4,'Muy difícil':5};
const positions=['primera','segunda','tercera','cuarta','quinta'];
const cache=new Map();
function candidates(n){if(cache.has(n))return cache.get(n);let rows=[[]];for(let i=0;i<n;i++)rows=rows.flatMap(row=>[1,2,3,4,5,6,7,8,9].filter(x=>!row.includes(x)).map(x=>[...row,x]));cache.set(n,rows);return rows;}
function random(n){const b=new Uint32Array(1);crypto.getRandomValues(b);return b[0]%n;}
function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function matches(row,c){return c.kind==='total'?row.reduce((a,b)=>a+b,0)===c.value:c.kind==='sum'?row[c.a]+row[c.b]===c.value:c.kind==='difference'?row[c.a]-row[c.b]===c.value:2*row[c.a]+row[c.b]===c.value;}
function wording(c){return c.kind==='total'?'La suma de todas mis cifras es '+c.value+'.':c.kind==='sum'?'Mi '+positions[c.a]+' cifra más mi '+positions[c.b]+' cifra suman '+c.value+'.':c.kind==='difference'?'Mi '+positions[c.a]+' cifra supera a mi '+positions[c.b]+' cifra en '+c.value+'.':'El doble de mi '+positions[c.a]+' cifra más mi '+positions[c.b]+' cifra da '+c.value+'.';}
export function numberRiddle(theme,difficulty,previous=[]){
 if(!['','Cultura general','Números y lógica'].includes(theme))return null;
 const n=sizes[difficulty];if(!n)throw Error('difficulty');const all=candidates(n);
 for(let attempt=0;attempt<80;attempt++){
  const target=all[random(all.length)],answer=target.join('');if(previous.some(p=>p.includes('Reto numérico '+answer)))continue;
  const pool=[{kind:'total',value:target.reduce((a,b)=>a+b,0)}];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   pool.push({kind:'sum',a:i,b:j,value:target[i]+target[j]});
   const a=target[i]>target[j]?i:j,b=a===i?j:i;pool.push({kind:'difference',a,b,value:target[a]-target[b]});
   if(n>=4)pool.push({kind:'double',a:i,b:j,value:2*target[i]+target[j]});
  }
  let remaining=all,clues=[];
  for(const c of shuffle(pool)){const next=remaining.filter(row=>matches(row,c));if(next.length<remaining.length){clues.push(c);remaining=next;}if(remaining.length===1)break;}
  if(remaining.length!==1)continue;
  for(const c of [...clues]){const rest=clues.filter(x=>x!==c);if(all.filter(row=>rest.every(x=>matches(row,x))).length===1)clues=rest;}
  if(clues.length<n)continue;
  const text=shuffle(clues).map((c,i)=>(i+1)+'. '+wording(c)).join('\n');
  const fingerprint=clues.map(wording).sort().join('|');
  if(previous.some(p=>p.split('\n').filter(s=>/^\d+\. /.test(s)).map(s=>s.replace(/^\d+\. /,'')).sort().join('|')===fingerprint))continue;
  return {question:'🧩 Soy un número de '+n+' cifras. Todas son distintas y ninguna es cero.\nMis posiciones se cuentan de izquierda a derecha.\n\n'+text+'\n\n¿Qué número soy?',answer,explanation:'Mis cifras de izquierda a derecha son '+target.join(', ')+'.\n'+clues.map(c=>wording(c)).join('\n')+'\nSe comprobaron los '+all.length+' números posibles con estas reglas: únicamente '+answer+' satisface todas las pistas. Ninguna pista es redundante.',source:'Adivinanza numérica · respaldo comprobado'};
 }
 throw Error('number_riddle_unavailable');
}
