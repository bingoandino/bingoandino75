export function isFreeCardPrize(prize){return typeof prize==='string'&&prize.normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ').replace('cartón','carton')==='1 carton gratis';}
export function pendingFreeWinners(s){const done=new Set((s.awards||[]).map(a=>a.drawId));return s.winners.filter(w=>isFreeCardPrize(w.prize)&&!done.has(w.drawId));}
