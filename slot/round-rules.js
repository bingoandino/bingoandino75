export function isConsolationPrize(prize,prizeType){if(prizeType==='consolation')return true;return /^(?:10\s*(?:usd|\$)|\$\s*10)$/i.test(String(prize||'').trim());}
export function consolationPool(participants,prize,rounds,prizeType){
 if(!isConsolationPrize(prize,prizeType)||!rounds?.sent)return participants;
 const excluded=new Set((rounds.winners||[]).map(w=>w.personId));
 return participants.filter(p=>!excluded.has(p.personId));
}
