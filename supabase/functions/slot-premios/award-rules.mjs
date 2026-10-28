export function isFreeCardPrize(prize){return typeof prize==='string'&&prize.normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ').replace('cartón','carton')==='1 carton gratis';}
export function pendingFreeWinners(s){
 const identity=w=>w.personId||s.winners.find(x=>x.drawId===w.drawId)?.personId||'draw:'+w.drawId;
 const done=new Set((s.awards||[]).map(identity));
 return s.winners.filter(w=>{if(!isFreeCardPrize(w.prize)||done.has(identity(w)))return false;done.add(identity(w));return true;});
}
