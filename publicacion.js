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
 const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const bs=c=>(c/100).toLocaleString('es-VE',{maximumFractionDigits:2})+' Bs';
 const sheet=make('article','ganadores-resumen');sheet.setAttribute('aria-label','Resumen de ganadores');
 const head=make('header','ganadores-cabecera');
 head.appendChild(make('div','ganadores-titulo','Nuestros ganadores'));
 head.appendChild(make('div','ganadores-subtitulo','BingoAndino75 · Resultados oficiales'));
 let fecha=new Date(payload.fecha+'T12:00:00Z').toLocaleDateString('es-VE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'America/Caracas'});
 fecha=fecha.charAt(0).toLocaleUpperCase('es')+fecha.slice(1);
 head.appendChild(make('div','ganadores-fecha',fecha));sheet.appendChild(head);
 const grid=make('div','ganadores-cuadricula');const rondas=payload.grupos.filter(g=>g.tipo==='ronda');
 payload.grupos.forEach(g=>{
  const card=make('div','resultado-publico resultado-'+g.tipo);card.dataset.tipo=g.tipo;
  if(g.tipo==='ronda'&&rondas.length%2===1&&g===rondas[rondas.length-1])card.classList.add('ronda-ancha');
  if(g.tipo==='consolacion'&&!payload.grupos.some(x=>x.tipo==='pozo'))card.classList.add('extra-ancho');
  card.appendChild(make('div','ganadores-categoria',g.tipo==='final'?'Cartón lleno final':titulo(g)));
  const iguales=g.ganadores.every(w=>w.premio_centimos===g.ganadores[0].premio_centimos);
  const individual=g.tipo==='consolacion'&&iguales;
  const total=individual?g.ganadores[0].premio_centimos:g.ganadores.reduce((n,w)=>n+w.premio_centimos,0);
  card.appendChild(make('div','ganadores-premio',bs(total)));
  const list=make('div','ganadores-personas');
  g.ganadores.forEach(w=>{
   const item=make('div','ganadores-persona');
   const nombre=payload.nombres?.[String(w.carton)];
   if(nombre)item.appendChild(make('span','ganadores-nombre',nombre));
   item.appendChild(make('span','ganadores-carton','Cartón '+w.carton));
   if(!iguales&&g.ganadores.length>1)item.appendChild(make('span','ganadores-individual',bs(w.premio_centimos)));
   list.appendChild(item);
  });
  card.appendChild(list);
  if(individual)card.appendChild(make('div','ganadores-reparto','Por ganador'));
  else if(iguales&&g.ganadores.length>1)card.appendChild(make('div','ganadores-reparto',bs(g.ganadores[0].premio_centimos)+' por ganador'));
  grid.appendChild(card);
 });
 sheet.appendChild(grid);sheet.appendChild(make('footer','ganadores-pie','¡Felicitaciones a todos nuestros ganadores!'));
 container.appendChild(sheet);
}

root.ResultadosPublicos={fechaISO,cartones,dinero,preparar,mostrar};
if(typeof module!=='undefined')module.exports=root.ResultadosPublicos;
})(typeof window!=='undefined'?window:globalThis);
