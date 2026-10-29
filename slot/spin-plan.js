// Display choreography only. The winner has already been selected by the server.
export function spinSeconds(settings={}){
 const seconds=Number(settings.speed);
 if(settings.speedRevision===3&&[3,5,8].includes(seconds))return seconds;
 if(settings.speed==='fast')return 3;
 if(settings.speed==='normal')return 5;
 return 5;
}
function randomIndex(n){
 const limit=Math.floor(4294967296/n)*n,bytes=new Uint32Array(1);
 do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);
 return bytes[0]%n;
}
function shuffled(items,pick){const deck=[...items];for(let i=deck.length-1;i>0;i--){const j=pick(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;}
const person=p=>p.personId||p.name||String(p.ticket);
export function animationParticipants(session,winner,{uniquePerson=true,excludeWinners=true}={}){
 const previous=new Set(session.winners.filter(w=>w.drawId!==winner.drawId).map(w=>uniquePerson?w.personId:w.ticket));
 return session.participants.filter(p=>!excludeWinners||!previous.has(uniquePerson?p.personId:p.ticket));
}
export function createSpinPlan(participants,winner,duration,pick=randomIndex){
 if(!participants.length)throw new Error('No hay participantes cargados.');
 const groups=new Map();for(const p of participants){const key=person(p);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 const people=[...groups.values()],finalIndex=Math.round(duration/1000*12),rows=[];
 // Shuffle people across the entire pool instead of repeating neighbouring tickets.
 while(rows.length<finalIndex+5){const deck=shuffled(people,pick).map(cards=>cards[pick(cards.length)]);
  if(deck.length>1&&rows.length&&person(deck[0])===person(rows.at(-1)))[deck[0],deck[1]]=[deck[1],deck[0]];
  rows.push(...deck.slice(0,finalIndex+5-rows.length));
 }
 const index=finalIndex+2;rows[index]=winner;
 if(people.length>1)for(const i of [index-1,index+1])if(person(rows[i])===person(winner))rows[i]=people.find(cards=>person(cards[0])!==person(winner))[0];
 return {finalIndex,panel:i=>rows[Math.max(0,Math.min(rows.length-1,i+2))]};
}
