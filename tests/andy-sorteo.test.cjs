const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../andy-sorteo-rules.js');
test('lunes: 700 cartones, 12 regalos, 20%, aporte de 10 y total 540',()=>{
  const x=R.budget({rounds:6,tickets:700,gifted:12,priceBs:890,rateBs:890});
  assert.equal(x.paidTickets,688);assert.equal(x.gross,688);
  assert.equal(x.rounded,540);assert.equal(x.kept20,137.6);assert.equal(x.realMargin,138);
  const prizes=R.suggest(x.rounded,6);
  assert.deepEqual(prizes,{consolCount:4,consolValue:10,group1Count:3,group1:50,group2Count:2,group2:70,final:210});
  assert.equal(R.validatePrizes(x.rounded,prizes).ok,true);
});
test('martes: 1000 cartones, 14 regalos, 400 Bs, 5 rondas, total 340',()=>{
  const x=R.budget({rounds:5,tickets:1000,gifted:14,priceBs:400,rateBs:890});
  assert.equal(x.rounded,340);
  const prizes=R.suggest(x.rounded,5);
  assert.equal(prizes.group1Count,4);assert.equal(prizes.group2Count,0);assert.equal(prizes.final,150);
  assert.equal(R.validatePrizes(x.rounded,prizes).ok,true);
});
test('calendario y sábado especial',()=>{
  assert.equal(R.nextDrawDate('2026-11-07'),'2026-11-09');
  assert.equal(R.programForDate('2026-11-07').special,true);
  assert.equal(R.programForDate('2026-11-04').tickets,600);
});
test('pozo exige confirmación y no duplica aportes',()=>{
  assert.equal(R.nextPot(120,'pending'),null);
  assert.equal(R.nextPot(120,'no'),130);
  assert.equal(R.nextPot(120,'yes'),null);
  assert.equal(R.nextPot(120,'yes',10),10);
});
test('precios BCV y consistencia de premios',()=>{
  assert.equal(R.bcvCeiling(893.22),894);
  const wrong={consolCount:4,consolValue:10,group1Count:3,group1:50,group2Count:2,group2:80,final:260};
  assert.equal(R.validatePrizes(620,wrong).ok,false);
  assert.equal(R.validatePrizes(610,wrong).ok,true);
});

test('lunes de seis rondas: el BCV no es obligatorio',()=>{
  const x=R.budget({rounds:6,tickets:700,gifted:12,priceBs:895,rateBs:0,manualTotal:''});
  assert.equal(x.error,undefined);
  assert.equal(x.rounded,540);
  assert.equal(x.marginVerified,true);
  assert.equal(x.gross,688);
});
test('cinco rondas: sin tasa usa total manual, sin afirmar que protege el 20%',()=>{
  const x=R.budget({rounds:5,tickets:1000,gifted:14,priceBs:400,rateBs:0,manualTotal:'340'});
  assert.equal(x.error,undefined);
  assert.equal(x.rounded,340);
  assert.equal(x.marginVerified,false);
  assert.equal(x.kept20,null);
  assert.equal(R.validatePrizes(x.rounded,R.suggest(340,5)).ok,true);
  assert.match(R.budget({rounds:5,tickets:1000,gifted:14,priceBs:400,rateBs:0,manualTotal:''}).error,/total a repartir/i);
});
test('con tasa BCV se conserva el cálculo y el margen mínimo',()=>{
  const a={rounds:5,tickets:1000,gifted:14,priceBs:400,rateBs:890};
  assert.equal(R.budget({...a,manualTotal:''}).rounded,340);
  assert.equal(R.budget({...a,manualTotal:'340'}).marginVerified,true);
  assert.match(R.budget({...a,manualTotal:'345'}).error,/20%/);
  assert.match(R.budget({...a,manualTotal:'341'}).error,/múltiplo de \$5/);
});
