// Ordering puzzles are generated from a complete solution, then independently
// enumerated. No AI assertion is used as proof of uniqueness.
const sizes={'Fácil':3,'Media':4,'Difícil':5,'Muy difícil':6};
const motifs={
 'Objetos del hogar':['taza','libro','cuchara','peine','media','plato'],
 'Animales':['jaguar','turpial','iguana','delfín','tortuga','venado'],
 'Comida y frutas':['arepa','hallaca','cachapa','quesillo','empanada','golfeado'],
 'Naturaleza':['río','montaña','bosque','laguna','cascada','sabana'],
 'Venezuela':['Mérida','Coro','Valencia','Maracay','Caracas','Trujillo'],
 'Palabras y lenguaje':['novela','poema','cuento','fábula','ensayo','crónica'],
 'Números y lógica':['círculo','cuadrado','triángulo','rombo','óvalo','estrella']
};
function pick(n){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n;}
function shuffled(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=pick(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function permutations(a){if(a.length===0)return [[]];return a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(p=>[v,...p]));}
export function holds(order,c){const a=order.indexOf(c.a),b=order.indexOf(c.b);return c.kind==='before'?a<b:c.kind==='gap'?Math.abs(a-b)===c.distance:c.kind==='apart'?Math.abs(a-b)!==1:b-a===1;}
function render(c){return c.kind==='before'?c.a+' está a la izquierda de '+c.b+'.':c.kind==='gap'?'Entre '+c.a+' y '+c.b+' hay exactamente '+(c.distance-1)+' tarjeta(s), sin indicar cuál está a la izquierda.':c.kind==='apart'?c.a+' y '+c.b+' no están juntas.':c.b+' está inmediatamente a la derecha de '+c.a+'.';}
const fingerprint=q=>q.split('\n').filter(s=>/^\d+\. /.test(s)).map(s=>s.replace(/^\d+\. /,'')).sort().join('|');
export function createLogic(theme,difficulty,previous=[]){
 const n=sizes[difficulty];if(!n)throw Error('difficulty');
 const names=(motifs[theme]||['Ana','Bruno','Carla','Diego','Elena','Fabián']).slice(0,n);
 const all=permutations(names);
 for(let attempt=0;attempt<80;attempt++){
  const target=shuffled(names),pool=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   pool.push({kind:'before',a:target[i],b:target[j]});
   if(j-i>1){pool.push({kind:'gap',a:target[i],b:target[j],distance:j-i});pool.push({kind:'apart',a:target[i],b:target[j]});}
   else if(n<5)pool.push({kind:'next',a:target[i],b:target[j]});
  }
  // Random useful clues followed by an irredundancy pass. Hard levels have no
  // immediate-neighbour clue or explicit positions to reveal the ordering.
  let remaining=all,clues=[];
  for(const c of shuffled(pool)){
   const narrowed=remaining.filter(p=>holds(p,c));
   if(narrowed.length<remaining.length){clues.push(c);remaining=narrowed;}
   if(remaining.length===1)break;
  }
  if(remaining.length!==1)continue;
  for(const c of [...clues]){
   const rest=clues.filter(x=>x!==c);
   if(all.filter(p=>rest.every(x=>holds(p,x))).length===1)clues=rest;
  }
  if(clues.length<n-1||n>=5&&!clues.some(c=>c.kind==='gap'))continue;
  const answer=target.join(' → ');
  const question='🧠 Hay '+n+' tarjetas en una fila, todas distintas: '+shuffled(names).join(', ')+'.\nLa izquierda y la derecha se leen como las ves en la pantalla.\n\n'+shuffled(clues).map((c,i)=>(i+1)+'. '+render(c)).join('\n')+'\n\n¿Cuál es el orden completo de izquierda a derecha?';
  if(previous.some(p=>p.includes(answer)||fingerprint(p)===fingerprint(question)))continue;
  const steps=clues.map(c=>{const a=target.indexOf(c.a)+1,b=target.indexOf(c.b)+1;return render(c)+' Posiciones: '+c.a+' = '+a+', '+c.b+' = '+b+'.';});
  return {question,answer,explanation:'Orden: '+answer+'.\n'+steps.join('\n')+'\nSe comprobaron las '+all.length+' distribuciones posibles: solo esta cumple todas las pistas. Cada pista es necesaria para determinar el orden completo.',source:'Lógica comprobada',clues,names};
 }
 throw Error('logic_unavailable');
}
