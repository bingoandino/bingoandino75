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
// Una sola composición SVG para la web y el PNG: mismos textos, colores y posiciones.
function nombrePublico(valor){
 return String(valor||'').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim().toLocaleLowerCase('es').replace(/(^|[\s-])(\p{L})/gu,(_,a,b)=>a+b.toLocaleUpperCase('es'));
}
function componerGanadores(payload){
 const NS='http://www.w3.org/2000/svg',W=1080,M=28,CW=W-2*M;
 const svg=document.createElementNS(NS,'svg');
 const node=(tag,attrs={},text,parent=svg)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;parent.appendChild(e);return e;};
 svg.setAttribute('xmlns',NS);svg.setAttribute('viewBox','0 0 1080 1500');svg.setAttribute('width','1080');svg.setAttribute('height','1500');svg.setAttribute('role','img');svg.setAttribute('aria-label','Ganadores de BingoAndino75');svg.classList.add('ganadores-poster');
 node('title',{},'Nuestros ganadores · BingoAndino75');
 const defs=node('defs');
 const gradient=(id,colors)=>{const g=node('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'},undefined,defs);colors.forEach((c,i)=>node('stop',{offset:Math.round(i/(colors.length-1)*100)+'%','stop-color':c},undefined,g));};
 gradient('ganadores-teal',['#078b94','#005663']);gradient('ganadores-gold',['#ffeaa1','#e6ae31','#fff0af']);gradient('ganadores-cream',['#fffdf7','#fff4d7']);
 const rect=(x,y,w,h,fill,stroke='none',r=15,parent=svg)=>node('rect',{x,y,width:w,height:h,rx:r,fill,stroke,'stroke-width':2},undefined,parent);
 const text=(x,y,value,size=28,fill='#073e4b',weight=700,anchor='start',cls='',parent=svg)=>node('text',{x,y,fill,'font-family':'Arial, Helvetica, sans-serif','font-size':size,'font-weight':weight,'text-anchor':anchor,...(cls?{class:cls}:{})},value,parent);
 const ticket=(x,y,parent)=>{
  const icon=node('g',{transform:`translate(${x} ${y}) rotate(-15)`},undefined,parent);
  node('path',{d:'M0 0 H28 V6 Q21 10 28 14 V20 H0 V14 Q7 10 0 6 Z',fill:'#ffd671',stroke:'#bc861e','stroke-width':2},undefined,icon);
  node('path',{d:'M8 4 H20 V16 H8 Z',fill:'none',stroke:'#bc861e','stroke-width':1},undefined,icon);
 };
 const measure=document.createElement('canvas').getContext('2d');
 if(!measure)throw Error('No se pudo preparar el diseño.');
 function wrap(value,width,size=28){
  measure.font='700 '+size+'px Arial, Helvetica, sans-serif';
  const out=[];let line='';
  for(const word of String(value).split(/\s+/)){
   if(line&&measure.measureText(line+' '+word).width>width){out.push(line);line='';}
   for(const char of Array.from((line?' ':'')+word)){
    if(line&&measure.measureText(line+char).width>width){out.push(line);line='';}line+=char;
   }
  }if(line)out.push(line);return out;
 }
 function lines(x,y,parts,size,fill,cls,parent=svg){const el=text(x,y,'',size,fill,700,'start',cls,parent);parts.forEach((s,i)=>node('tspan',{x,dy:i?size*1.2:0},s,el));return el;}
 const bs=c=>(c/100).toLocaleString('es-VE',{maximumFractionDigits:2})+' Bs';
 const date=new Date(fechaISO(payload.fecha)+'T12:00:00Z').toLocaleDateString('es-VE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'America/Caracas'});
 const fondo=rect(0,0,W,1500,'#fffdf7','none',0);
 rect(0,0,W,242,'url(#ganadores-teal)','none',0);
 // Cintas discretas y una marca tipográfica; el contenido sigue siendo texto seleccionable.
 for(const x of [56,1000]){node('path',{d:`M${x} 35 l16 18 -7 15 -16 -18 Z`,fill:'#efc761'});node('path',{d:`M${x+15} 159 l-12 12 7 17 12 -12 Z`,fill:'#efc761'});}
 text(W/2,69,'BingoAndino75',57,'#ffdf83',800,'middle','ganadores-marca');
 text(W/2,133,'NUESTROS GANADORES',51,'#fffdf7',800,'middle','ganadores-titulo');
 rect(216,153,648,43,'url(#ganadores-gold)','none',22);
 text(W/2,183,date.charAt(0).toUpperCase()+date.slice(1),27,'#083e49',700,'middle','ganadores-fecha');
 text(W/2,225,'Resultados oficiales',25,'#fffdf7',600,'middle','ganadores-subtitulo');
 let y=258;
 const ordered=[...payload.grupos.filter(g=>g.tipo==='ronda'),...payload.grupos.filter(g=>g.tipo==='final'),...payload.grupos.filter(g=>!['ronda','final'].includes(g.tipo))];
 for(const g of ordered){
  if(!g.ganadores?.length)continue;
  const group=node('g',{class:'resultado-publico resultado-'+g.tipo,'data-tipo':g.tipo});
  const same=g.ganadores.every(w=>w.premio_centimos===g.ganadores[0].premio_centimos);
  const individual=g.tipo==='consolacion'&&same;
  const total=individual?g.ganadores[0].premio_centimos:g.ganadores.reduce((n,w)=>n+w.premio_centimos,0);
  if(g.tipo==='ronda'){
   const rows=g.ganadores.map(w=>({w,name:wrap(nombrePublico(payload.nombres?.[String(w.carton)]),342,27)}));
   const heights=rows.map(row=>Math.max(52,row.name.length*33+16)+(!same&&rows.length>1?28:0));const h=Math.max(60,heights.reduce((n,v)=>n+v,0));
   rect(M,y,CW,h,'#fffdf7','#d6ad54',13,group);rect(M+3,y+3,190,h-6,'url(#ganadores-teal)','none',10,group);rect(M+195,y+3,239,h-6,'url(#ganadores-gold)','none',9,group);
   text(M+98,y+h/2+10,titulo(g),29,'#fff',800,'middle','ganadores-categoria',group);
   text(M+315,y+h/2+11,bs(total),33,'#103e46',800,'middle','ganadores-premio',group);
   let ry=y;
   for(let i=0;i<rows.length;i++){
    const {w,name}=rows[i],rh=heights[i];
    if(i)node('path',{d:`M${M+446} ${ry} H${W-M-12}`,stroke:'#e6d5ac'},undefined,group);
    lines(M+460,ry+(rh-name.length*33)/2+27,name,27,'#103e46','ganadores-nombre',group);
    ticket(W-M-216,ry+rh/2-8,group);
    text(W-M-18,ry+rh/2+9,'Cartón '+w.carton,25,'#103e46',600,'end','ganadores-carton',group);
    if(!same&&rows.length>1)text(W-M-18,ry+rh/2+35,bs(w.premio_centimos),21,'#66521b',600,'end','ganadores-individual',group);
    ry+=rh;
   }
   y+=h;
   if(same&&rows.length>1){text(W-M-8,y+25,bs(g.ganadores[0].premio_centimos)+' por ganador',23,'#625128',600,'end','ganadores-reparto',group);y+=36;}
   y+=10;continue;
  }
  const final=g.tipo==='final',start=y;
  const cardBackground=rect(M,y,CW,100,final?'url(#ganadores-gold)':'url(#ganadores-cream)','#cf9e35',23,group);
  text(W/2,y+49,titulo(g),39,'#073e4b',800,'middle','ganadores-categoria',group);
  // Trofeo vectorial, idéntico en el PNG y en la página.
  for(const x of [M+52,W-M-100]){
   node('path',{d:`M${x} ${y+22} h45 v22 q0 25 -22 26 q-23 -1 -23 -26 Z M${x+17} ${y+70} v12 h-12 v7 h34 v-7 h-12 v-12 M${x} ${y+29} h-12 v10 q0 18 16 18 M${x+45} ${y+29} h12 v10 q0 18 -16 18`,fill:'#f3bd43',stroke:'#9a6a13','stroke-width':3},undefined,group);
  }
  const amount=bs(total);rect(M+176,y+66,CW-352,67,'url(#ganadores-teal)','none',23,group);
  text(W/2,y+114,amount,final?50:43,'#ffe08b',800,'middle','ganadores-premio',group);
  y+=158;
  if(!individual&&g.ganadores.length>1){text(W/2,y,'Total a repartir',22,'#5e4b1c',600,'middle','',group);y+=34;}
  if(individual||same&&g.ganadores.length>1){
   const label=individual?'Por ganador':bs(g.ganadores[0].premio_centimos)+' por ganador';
   text(W/2,y,label,29,'#073e4b',700,'middle','ganadores-reparto',group);y+=22;
  }
  const people=node('g',{class:'ganadores-personas'},undefined,group);const gap=14,cw=(CW-42)/2;
  for(let i=0;i<g.ganadores.length;i+=2){
   const row=g.ganadores.slice(i,i+2).map(w=>({w,name:wrap(nombrePublico(payload.nombres?.[String(w.carton)]),cw-32,28)}));
   const h=Math.max(...row.map(p=>Math.max(1,p.name.length)*34+55+(!same&&g.ganadores.length>1?30:0)));
   row.forEach(({w,name},j)=>{const x=M+14+j*(cw+gap);const p=node('g',{class:'ganadores-persona'},undefined,people);rect(x,y,cw,h,'#fffdf7','#d6ad54',13,p);lines(x+16,y+35,name,28,'#103e46','ganadores-nombre',p);ticket(x+18,y+h-36,p);text(x+58,y+h-17,'Cartón '+w.carton,25,'#103e46',600,'start','ganadores-carton',p);if(!same&&g.ganadores.length>1)text(x+16,y+h-49,bs(w.premio_centimos),24,'#66521b',600,'start','ganadores-individual',p);});
   y+=h+12;
  }
  y+=5;cardBackground.setAttribute('height',y-start);y+=15;
 }
 text(W/2,y+34,'¡Felicidades a nuestros ganadores!',39,'#005b69',700,'middle','ganadores-pie');
 rect(314,y+57,452,45,'url(#ganadores-teal)','#d2a13c',23);
 text(W/2,y+88,'bingoandino75.com',28,'#fffdf7',700,'middle');
 const H=Math.ceil(y+123);if(H>16000)throw Error('Hay demasiados resultados para una sola imagen.');
 fondo.setAttribute('height',H);svg.setAttribute('height',H);svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
 return svg;
}
function mostrar(container,payload){
 const sheet=document.createElement('article');sheet.className='ganadores-resumen';sheet.setAttribute('aria-label','Resumen de ganadores');sheet.appendChild(componerGanadores(payload));container.replaceChildren(sheet);
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
// Dibujo local con campos públicos explícitos; no captura formularios ni datos bancarios.
function crearImagen(payload){
 const svg=componerGanadores(payload);
 const markup=new root.XMLSerializer().serializeToString(svg);
 return new Promise((resolve,reject)=>{
  const image=new root.Image();
  image.onload=()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=Number(svg.getAttribute('height'));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar la imagen.');
    ctx.drawImage(image,0,0);
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error('No se pudo generar la imagen.')),'image/png');
   }catch(error){reject(error);}
  };
  image.onerror=()=>reject(Error('No se pudo preparar la imagen.'));
  image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup);
 });
}

function compartir(container,fecha,payload){
 const mensaje=mensajeCompartir(fecha);
 const caja=document.createElement('div');caja.className='ganadores-compartir';
 const copiar=document.createElement('button');copiar.type='button';copiar.textContent='📋 Copiar mensaje y enlace';copiar.dataset.accion='copiar';
 const ayuda=document.createElement('p');ayuda.textContent='Comparte la imagen con su enlace. Si WhatsApp no conserva el texto o no muestra tu canal, descarga la imagen y pega el mensaje al publicarla.';
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
 const enviar=document.createElement('button');enviar.type='button';enviar.dataset.accion='imagen';enviar.textContent='Preparando imagen…';enviar.disabled=true;
 const descargar=document.createElement('button');descargar.type='button';descargar.className='compartir-opciones';descargar.textContent='⬇ Descargar imagen';descargar.disabled=true;
 let archivo,imagen;
 const listo=Promise.resolve().then(()=>crearImagen(payload)).then(blob=>{
  imagen=blob;archivo=new root.File([blob],'ganadores-bingoandino75-'+fechaISO(fecha)+'.png',{type:'image/png'});
  enviar.disabled=false;descargar.disabled=false;enviar.textContent='🖼 Compartir imagen y enlace';
 }).catch(()=>{enviar.textContent='Imagen no disponible';estado.textContent='No se pudo preparar la imagen. Recarga para volver a intentar. Puedes copiar el enlace.';});
 caja.preparacion=()=>listo;
 enviar.onclick=async()=>{
  if(!archivo)return;
  let compatible=false;try{compatible=typeof root.navigator.share==='function' && root.navigator.canShare?.({files:[archivo]})===true;}catch{}
  if(!compatible){estado.textContent='Este navegador no permite compartir imágenes directamente. Pulsa Descargar imagen y Copiar mensaje y enlace; luego agrégalos a tu canal de WhatsApp.';return;}
  enviar.disabled=true;
  try{await root.navigator.share({files:[archivo],title:'Ganadores · BingoAndino75',text:mensaje});estado.textContent='Imagen y enlace enviados a la opción elegida. Revisa que WhatsApp conserve el enlace antes de publicar.';}
  catch(e){if(e.name!=='AbortError')estado.textContent='No se pudo compartir. Puedes descargar la imagen y copiar el mensaje con el enlace.';}
  finally{enviar.disabled=false;}
 };
 descargar.onclick=()=>{
  if(!imagen)return;
  const url=root.URL.createObjectURL(imagen),a=document.createElement('a');a.href=url;a.download=archivo.name;document.body.appendChild(a);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),60000);
  estado.textContent='Imagen preparada para descargar. Usa Copiar mensaje y enlace para añadir el enlace al publicarla en tu canal.';
 };
 caja.append(enviar,descargar,copiar,ayuda,texto,estado);
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
    compartir(results,elegida,data.resultado);
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

root.ResultadosPublicos={fechaISO,cartones,dinero,preparar,mostrar,fechaEnlace,mensajeCompartir,compartir,crearImagen,componerGanadores};
if(typeof module!=='undefined')module.exports=root.ResultadosPublicos;
})(typeof window!=='undefined'?window:globalThis);


