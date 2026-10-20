/* Contrato público v1. Nunca recibe registros de compradores ni textos libres. */
(function(root){
'use strict';
function fechaISO(text){
 const raw=String(text).trim(); let y,m,d;
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){[y,m,d]=raw.split('-').map(Number)}
 else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)){[d,m,y]=raw.split('/').map(Number)}
 else throw Error('Escribe la fecha como dd/mm/aaaa.');
 const date=new Date(Date.UTC(y,m-1,d));
 if(y<2020||y>2100||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw Error('Fecha inválida.');
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function cartones(raw){
 if(!/^\s*\d+(?:[\s,;]+\d+)*\s*$/.test(raw))throw Error('Revisa la lista de cartones. Solo admite números separados por espacios, comas o punto y coma.');
 const ns=raw.trim().split(/[\s,;]+/).map(Number);
 if(ns.some(n=>!Number.isInteger(n)||n<1||n>9999)||new Set(ns).size!==ns.length)throw Error('Hay cartones inválidos o repetidos.');
 return ns.sort((a,b)=>a-b);
}
function dinero(raw){
 const s=String(raw).trim();
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))throw Error('Monto inválido. Usa formato venezolano: 1.000,50.');
 const n=Number(s.replace(/\./g,'').replace(',','.'));
 if(!Number.isFinite(n)||n<=0||n>1000000000)throw Error('El premio debe ser mayor que cero.');
 return n;
}
function preparar(form,validarCarton){
 const fecha=fechaISO(form.fecha);const grupos=[];
 if(!Array.isArray(form.rondas)||form.rondas.length<2||form.rondas.length>6)throw Error('Cantidad de rondas inválida.');
 function agregar(tipo,orden,raw,monto,individual){
  const cs=cartones(raw),p=dinero(monto);
  cs.forEach(c=>{if(!validarCarton(c))throw Error(`El cartón ${c} no tiene una compra aprobada única. Actualiza los aprobados.`)});
  // Coincide con los pagos existentes: premio compartido redondeado hacia abajo a Bs enteros.
  const premio=individual?Math.round(p*100):Math.round((cs.length===1?Math.round(p):Math.floor(p/cs.length))*100);
  if(premio<1)throw Error('Premio individual insuficiente.');
  grupos.push({tipo,orden,ganadores:cs.map(carton=>({carton,premio_centimos:premio}))});
 }
 form.rondas.forEach((r,i)=>agregar(i===form.rondas.length-1?'final':'ronda',i+1,r.cartones,r.premio,false));
 for(const [key,tipo] of [['consolacion','consolacion'],['pozo','pozo']]){
  const g=form[key];if(g&&String(g.cartones).trim())agregar(tipo,0,g.cartones,g.premio,tipo==='consolacion');
 }
 return {version:1,fecha,grupos};
}
function titulo(g){return g.tipo==='ronda'?`${g.orden}ª ronda`:({final:'Cartón lleno final',consolacion:'Consolación',pozo:'Pozo acumulado'})[g.tipo]}
function mostrar(container,payload){
 container.replaceChildren();
 const h=document.createElement('h3');h.textContent=`BingoAndino75 · ${payload.fecha.split('-').reverse().join('/')}`;container.appendChild(h);
 payload.grupos.forEach(g=>{
  const card=document.createElement('div');card.className='resultado-publico';
  const title=document.createElement('strong');title.textContent=titulo(g);card.appendChild(title);
  g.ganadores.forEach(w=>{const line=document.createElement('div');line.textContent=`Cartón ${w.carton} · ${(w.premio_centimos/100).toLocaleString('es-VE',{minimumFractionDigits:2})} Bs`;card.appendChild(line)});
  container.appendChild(card);
 });
}
root.ResultadosPublicos={fechaISO,cartones,dinero,preparar,mostrar};
if(typeof module!=='undefined')module.exports=root.ResultadosPublicos;
})(typeof window!=='undefined'?window:globalThis);
