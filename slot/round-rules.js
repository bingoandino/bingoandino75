export function isConsolationPrize(prize){return /^(?:10\s*(?:usd|\$)|\$\s*10)$/i.test(String(prize||'').trim());}
export function consolationPool(participants,prize,rounds){
 if(!isConsolationPrize(prize)||!rounds?.sent)return participants;
 const excluded=new Set((rounds.winners||[]).map(w=>w.personId));
 return participants.filter(p=>!excluded.has(p.personId));
}
