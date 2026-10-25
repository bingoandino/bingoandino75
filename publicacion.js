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

// El mensaje solo contiene la fecha pública y un enlace estable; nunca copia datos de pago.
function fechaEnlace(){
 try {const valor=new URL(root.location.href).searchParams.get('ganadores');return valor?fechaISO(valor):null;}catch{return null;}
}
function mensajeCompartir(fecha){
 const iso=fechaISO(fecha);
 const dia=new Date(iso+'T12:00:00Z').toLocaleDateString('es-VE',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Caracas'});
 return '🏆 BingoAndino75 · Nuestros ganadores\n📅 '+dia+'\n\nConsulta los resultados oficiales, cartones y premios aquí:\nhttps://bingoandino75.com/?ganadores='+iso+'\n\n🎉 ¡Felicitaciones a todos nuestros ganadores!';
}
function compartir(container,fecha){
 const mensaje=mensajeCompartir(fecha);
 const caja=document.createElement('div');caja.className='ganadores-compartir';
 const copiar=document.createElement('button');copiar.type='button';copiar.textContent='📣 Compartir al canal de WhatsApp';
 const ayuda=document.createElement('p');ayuda.textContent='Copia el mensaje con el enlace y pégalo en tu canal de WhatsApp.';
 const estado=document.createElement('p');estado.setAttribute('role','status');estado.setAttribute('aria-live','polite');
 const texto=document.createElement('textarea');texto.value=mensaje;texto.readOnly=true;texto.hidden=true;texto.rows=7;texto.setAttribute('aria-label','Mensaje y enlace de los ganadores para copiar');
 copiar.onclick=async()=>{
  copiar.disabled=true;estado.textContent='';
  try{
   if(!root.navigator.clipboard?.writeText)throw Error('sin portapapeles');
   await root.navigator.clipboard.writeText(mensaje);
   estado.textContent='Mensaje copiado. Abre WhatsApp → Novedades → tu canal, pega el mensaje y publícalo.';
  }catch{
   texto.hidden=false;texto.focus();texto.select();
   estado.textContent='Mantén pulsado el mensaje y elige Copiar (o Ctrl+C). Luego pégalo en tu canal de WhatsApp.';
  }finally{copiar.disabled=false;}
 };
 caja.append(copiar,ayuda,texto,estado);
 if(typeof root.navigator.share==='function'){
  const otros=document.createElement('button');otros.type='button';otros.className='compartir-opciones';otros.textContent='Otras opciones para compartir';
  otros.onclick=async()=>{
   otros.disabled=true;
   try{await root.navigator.share({title:'Ganadores · BingoAndino75',text:mensaje});}
   catch(e){if(e.name!=='AbortError')estado.textContent='No se pudo abrir Compartir. Usa el botón para copiar el mensaje.';}
   finally{otros.disabled=false;}
  };
  caja.appendChild(otros);
 }
 container.appendChild(caja);
}
async function cargarGanadoresCompartibles() {
  const box=document.getElementById('listaGanadores');box.replaceChildren();
  const tools=document.createElement('details');tools.className='ganadores-historial';const summary=document.createElement('summary');summary.textContent='Consultar otra fecha';tools.appendChild(summary);box.appendChild(tools);const status=document.createElement('div');status.className='ganadores-estado';status.textContent='Cargando historial…';tools.appendChild(status);
  const {data,error}=await root.supabase.from('resultados_publicos_con_nombres').select('fecha').order('fecha',{ascending:false}).limit(100);
  if(error){status.textContent='No se pudo cargar el historial. Intenta nuevamente.';return}
  if(!data.length){status.textContent='Aún no hay resultados publicados.';return}
  status.textContent='Selecciona la fecha del sorteo';
  const select=document.createElement('select');select.setAttribute('aria-label','Fecha del sorteo');
  data.forEach(r=>{const o=document.createElement('option');o.value=r.fecha;o.textContent=r.fecha.split('-').reverse().join('/');select.appendChild(o)});
  tools.appendChild(select);const fecha=document.createElement('input');fecha.type='date';fecha.setAttribute('aria-label','Buscar cualquier fecha publicada');fecha.value=fechaEnlace()||select.value;if(Array.from(select.options).some(o=>o.value===fecha.value))select.value=fecha.value;tools.appendChild(fecha);const results=document.createElement('div');box.appendChild(results);
  let request=0;
  async function cargar(){
    const current=++request;const elegida=fecha.value;results.textContent='Cargando resultados…';
    const {data,error}=await root.supabase.from('resultados_publicos_con_nombres').select('resultado').eq('fecha',elegida).single();
    if(current!==request)return;
    if(error){results.textContent='No se pudieron cargar los resultados.';return}
    mostrar(results,data.resultado);
    compartir(results,elegida);
  }
  select.onchange=()=>{fecha.value=select.value;cargar()};fecha.onchange=cargar;await cargar();
}

function abrirEnlace(){
 if(typeof root.cargarGanadores==='function')root.cargarGanadores=cargarGanadoresCompartibles;
 const estilo=document.createElement('style');estilo.textContent='\n.ganadores-compartir{margin:18px auto;padding:18px;max-width:850px;border:2px solid #d5e7de;border-radius:18px;background:#f6fbf8;color:#18372b;text-align:center}\n.ganadores-compartir button{width:100%;max-width:540px;margin:8px auto;padding:16px;background:#16834d;color:#fff;font-size:18px;border-radius:12px}\n.ganadores-compartir button:disabled{opacity:.65}\n.ganadores-compartir .compartir-opciones{background:#e3f1e9;color:#145b39;font-size:16px}\n.ganadores-compartir p{font-size:15px;line-height:1.5;margin:10px 0}\n.ganadores-compartir textarea{box-sizing:border-box;width:100%;max-width:none;padding:12px;font-size:16px;background:#fff;color:#182d24;border:1px solid #8fada0;border-radius:10px;text-align:left}\n.ganadores-compartir textarea[hidden]{display:none}\n';document.head.appendChild(estilo);
 if(!fechaEnlace()||typeof root.mostrarSeccion!=='function')return;
 const modal=document.getElementById('modal-terminos');
 const ocultarTerminos=()=>{if(!document.getElementById('ganadores')?.classList.contains('oculto') && modal && !modal.classList.contains('oculto'))modal.classList.add('oculto');};
 modal?.classList.add('oculto');
 if(modal)new root.MutationObserver(ocultarTerminos).observe(modal,{attributes:true,attributeFilter:['class']});
 const overlay=document.getElementById('overlay-carga');if(overlay)overlay.style.display='none';
 root.mostrarSeccion('ganadores');
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',abrirEnlace,{once:true});else root.queueMicrotask?.(abrirEnlace);
}

root.ResultadosPublicos={fechaISO,cartones,dinero,preparar,mostrar,fechaEnlace,mensajeCompartir,compartir};
if(typeof module!=='undefined')module.exports=root.ResultadosPublicos;
})(typeof window!=='undefined'?window:globalThis);

