import test from 'node:test';import assert from 'node:assert/strict';import {isFreeCardPrize,pendingFreeWinners} from '../slot/award-rules.js';
test('award eligibility never infers free cards from prize option index or money values',()=>{for(const p of ['1 cartón gratis',' 1 CARTON GRATIS ','1  cartón   gratis'])assert.equal(isFreeCardPrize(p),true);for(const p of ['10 USD','0 USD','2 cartones gratis','cartón gratis',null,'1 cartón gratis + 10 USD'])assert.equal(isFreeCardPrize(p),false);const w=[{drawId:'1',prize:'1 cartón gratis'},{drawId:'2',prize:'10 USD'},{drawId:'3',prize:'1 cartón gratis'}];assert.deepEqual(pendingFreeWinners({winners:w,awards:[{drawId:'1'}]}).map(x=>x.drawId),['3']);});

test('one free card per person despite different winning tickets, names or repeated draws',()=>{
 const winners=[{drawId:'cash',personId:'a',prize:'10 USD'},{drawId:'first',personId:'a',ticket:'1',name:'Ana',prize:'1 cartón gratis'},{drawId:'again',personId:'a',ticket:'2',name:'Otro nombre registrado',prize:'1 cartón gratis'},{drawId:'different',personId:'b',name:'Ana',prize:'1 cartón gratis'}];
 assert.deepEqual(pendingFreeWinners({winners}).map(w=>w.drawId),['first','different']);
 assert.deepEqual(pendingFreeWinners({winners,awards:[{drawId:'first',personId:'a'}]}).map(w=>w.drawId),['different']);
 assert.deepEqual(pendingFreeWinners({winners,awards:[{drawId:'first'}]}).map(w=>w.drawId),['different']);
});
