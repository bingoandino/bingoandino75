/* ANDY Sorteo Diario: reglas de cálculo aisladas, sin dependencias del administrador. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AndySorteoRules = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const PROGRAM = Object.freeze({
    1: { name:'Lunes', rounds:6, tickets:700, lowPrice:false, special:false },
    2: { name:'Martes', rounds:5, tickets:1000, lowPrice:true, special:false },
    3: { name:'Miércoles', rounds:6, tickets:600, lowPrice:false, special:false },
    4: { name:'Jueves', rounds:5, tickets:1050, lowPrice:true, special:false },
    5: { name:'Viernes', rounds:5, tickets:1050, lowPrice:true, special:false },
    6: { name:'Sábado', rounds:6, tickets:800, lowPrice:false, special:true }
  });
  const EPS = 1e-8;
  const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) &&
    new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s;
  function weekday(s) { if (!validISO(s)) throw new Error('Fecha inválida.'); return new Date(s+'T12:00:00Z').getUTCDay(); }
  function nextDrawDate(s) {
    if (!validISO(s)) throw new Error('Fecha inválida.');
    const d = new Date(s+'T12:00:00Z');
    do { d.setUTCDate(d.getUTCDate()+1); } while (d.getUTCDay() === 0);
    return d.toISOString().slice(0,10);
  }
  function programForDate(date) {
    const day = weekday(date);
    if (day === 0) throw new Error('Los domingos no hay sorteo habitual.');
    return { ...PROGRAM[day] };
  }
  const finitePositive = (x) => Number.isFinite(Number(x)) && Number(x) > 0;
  function budget(input) {
    const { rounds, tickets, priceBs, rateBs, gifted } = input;
    if (![5,6].includes(Number(rounds))) return {error:'Selecciona 5 o 6 rondas.'};
    const nTickets = Number(tickets), nGift = Number(gifted);
    if (!Number.isSafeInteger(nTickets) || nTickets < 1 || !Number.isSafeInteger(nGift) || nGift < 0 || nGift >= nTickets)
      return {error:'Revisa cartones y regalos; los regalados deben ser menos que el total.'};
    if (!finitePositive(priceBs)) return {error:'Indica el precio del cartón en Bs.'};
    if (!finitePositive(rateBs)) return {error:'Indica la tasa oficial BCV del día para calcular el presupuesto en USD.'};
    // Los días de $1 se calculan como un dólar por cartón, redondeando su precio en Bs hacia arriba.
    // Los días de precio bajo se convierten a dólares con la tasa BCV indicada por el operador.
    const unitUsd = Number(rounds) === 6 ? 1 : Number(priceBs) / Number(rateBs);
    const gross = (nTickets - nGift) * unitUsd;
    const kept20 = gross * .2;
    const forPrizesAndPot = gross * .8;
    const potContribution = 10;
    const available = forPrizesAndPot - potContribution;
    const rounded = Math.floor((available + EPS) / 5) * 5;
    if (rounded < 0) return {error:'No hay presupuesto suficiente.'};
    return {paidTickets:nTickets-nGift,unitUsd,gross,kept20,forPrizesAndPot,potContribution,
      available,rounded,realMargin:gross-potContribution-rounded};
  }
  function defaultGifts(rounds) { return Number(rounds) === 5 ? {roulette:7,dynamics:3,video:4} : {roulette:7,dynamics:3,video:2}; }
  function suggest(total, rounds) {
    const six = Number(rounds) === 6;
    const consolCount = six ? 4 : 3;
    const group1Count = six ? 3 : 4;
    const group2Count = six ? 2 : 0;
    const group1 = six ? (total <= 480 ? 40 : 50) : 40;
    const group2 = six ? (total <= 480 ? 50 : total <= 575 ? 70 : 80) : 0;
    const final = total - consolCount*10 - group1Count*group1 - group2Count*group2;
    return {consolCount,consolValue:10,group1Count,group1,group2Count,group2,final};
  }
  function validatePrizes(total, p) {
    const nums = ['consolCount','consolValue','group1Count','group1','group2Count','group2','final'];
    if (nums.some(k=> !Number.isFinite(Number(p[k])) || Number(p[k])<0)) return {ok:false,error:'Hay premios o cantidades inválidos.'};
    if (!Number.isInteger(Number(p.consolCount)) || !Number.isInteger(Number(p.group1Count)) || !Number.isInteger(Number(p.group2Count)))
      return {ok:false,error:'Las cantidades de premios deben ser enteras.'};
    if (['consolValue','group1','group2','final'].some(k=>Number(p[k])%5!==0)) return {ok:false,error:'Los premios deben ser múltiplos de $5.'};
    const sum=Number(p.consolCount)*Number(p.consolValue) + Number(p.group1Count)*Number(p.group1) + Number(p.group2Count)*Number(p.group2) + Number(p.final);
    if (Math.abs(sum-Number(total)) > EPS) return {ok:false,error:'Los premios suman $'+sum+' y el total disponible es $'+total+'.',sum};
    if (!(Number(p.final)>Math.max(Number(p.group1),Number(p.group2),Number(p.consolValue))))
      return {ok:false,error:'El lleno final debe ser el premio más grande.',sum};
    return {ok:true,sum};
  }
  function nextPot(current, status, resetAmount=null) {
    if (!finitePositive(current)) return null;
    if (status === 'no') return Number(current)+10;
    if (status === 'yes') return finitePositive(resetAmount) ? Number(resetAmount) : null;
    return null; // Nunca interpretar falta de publicación como «no hubo ganador».
  }
  function bcvCeiling(rate) { return finitePositive(rate) ? Math.ceil(Number(rate)-EPS) : null; }
  return Object.freeze({PROGRAM,weekday,nextDrawDate,programForDate,budget,defaultGifts,suggest,validatePrizes,nextPot,bcvCeiling});
});
