/* ANDY Sorteo Diario. Borrador autónomo: ninguna llamada a compras, pagos o Supabase. */
(function () {
  'use strict';
  const R = window.AndySorteoRules;
  const root = document.getElementById('andy-sorteo-diario');
  if (!R || !root) return;
  const $ = (s) => root.querySelector('#andy-sd-' + s);
  const STORAGE = 'bingo_andy_sorteo_diario_borrador_v1';
  let lastValidDate = ''; 
  const locale = new Intl.NumberFormat('es-VE',{maximumFractionDigits:2});
  let generated = false;
  function todayVE() {
    const p = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const m = Object.fromEntries(p.map(x=>[x.type,x.value]));
    return m.year+'-'+m.month+'-'+m.day;
  }
  const money = (v) => '$'+locale.format(v);
  const fmt = (v) => locale.format(v);
  const number = (key) => Number($(key).value);
  function mark(msg, bad) {const n=$('estado');n.textContent=msg;n.dataset.error=bad?'true':'false';}
  function next(date) { try {return R.nextDrawDate(date);} catch {return R.nextDrawDate(todayVE());} }
  function defaults(date) {
    let p;
    try {p=R.programForDate(date);} catch {return;}
    $('fecha').value=date;lastValidDate=date;
    $('rondas').value=p.rounds;
    $('cartones').value=p.tickets;
    const gifts=R.defaultGifts(p.rounds);
    $('ruleta').value=gifts.roulette;
    $('dinamicas').value=gifts.dynamics;
    $('video').value=gifts.video;
    $('precio').value=p.lowPrice?'400':'';
    $('tasa').value=''; // Nunca conservar una tasa posiblemente vencida.
    $('rondas-info').textContent=p.special?'✨ Sábado especial · morado y dorado con mayor brillo':'💜 Estilo tradicional · morado, marfil y dorado';
    $('pozo-resultado').value='pending';
    $('pozo').value='';
    $('pozo-manual').value='';
    $('premio-a').value=''; $('premio-b').value=''; $('premio-final').value='';
    generated=false;
    calc();
  }
  function read() {
    return {date:$('fecha').value,rounds:number('rondas'),tickets:number('cartones'),gifted:number('ruleta')+number('dinamicas')+number('video'),
      priceBs:number('precio'),rateBs:number('tasa')};
  }
  function calc() {
    const data=read();
    const b=R.budget(data);
    const p=R.suggest(b.rounded||0,data.rounds);
    $('base').textContent=data.gifted+' cartones base · '+Math.max(0,data.tickets-data.gifted)+' para el cálculo';
    $('presupuesto').textContent=b.error?'Pendiente':money(b.rounded);
    $('presupuesto-sub').textContent=b.error?b.error:'Reserva del 20%: '+money(b.kept20)+' · Aporte al pozo: $10 · Antes del redondeo: '+money(b.available);
    $('reparto-info').textContent=data.rounds===6?'4 consolaciones · 3 llenos A · 2 llenos B · lleno final':'3 consolaciones · 4 llenos iguales · lleno final';
    $('bloque-b').hidden=data.rounds===5;
    $('cantidad-a').textContent=data.rounds===6?'3 llenos de':'4 llenos de';
    const totalPrize = (data.rounds===6?4:3)*10+(data.rounds===6?3:4)*number('premio-a')+(data.rounds===6?2:0)*number('premio-b')+number('premio-final');
    $('suma').textContent=money(totalPrize);
    const result=R.validatePrizes(b.rounded||0,{
      consolCount:p.consolCount,consolValue:10,group1Count:p.group1Count,group1:number('premio-a'),
      group2Count:p.group2Count,group2:data.rounds===6?number('premio-b'):0,final:number('premio-final')
    });
    let error = b.error || result.error;
    const pot=projectPot();
    if (pot===null) error = error || 'Confirma el pozo del siguiente sorteo.';
    if (!data.date || !data.tickets || !data.priceBs) error=error||'Completa los datos del sorteo.';
    if (!Number.isInteger(number('max-bolas')) || number('max-bolas')<1 || number('max-bolas')>75) error=error||'El máximo de bolitas debe estar entre 1 y 75.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test($('hora').value)) error=error||'Indica una hora válida.';
    $('validacion').textContent=error?'⚠️ '+error:'✅ Cifras verificadas. El anuncio está listo para revisar y descargar.';
    $('validacion').dataset.valid=error?'false':'true';
    const good=!error;
    $('descargar-cuadrado').disabled=!good;
    $('descargar-historia').disabled=!good;
    $('copiar-redes').disabled=!good;
    $('copiar-whatsapp').disabled=!good;
    return {data,b,p,pot,good,error,totalPrize};
  }
  function projectPot() {
    const manual=$('pozo-manual').value.trim();
    if (manual) {
      const n=Number(manual);
      return Number.isFinite(n)&&n>0?n:null;
    }
    const current=Number($('pozo').value);
    return R.nextPot(current,$('pozo-resultado').value,null);
  }
  function suggestion() {
    const x=calc();
    if (x.b.error) {mark('No se pueden sugerir premios todavía: '+x.b.error,true);return;}
    const s=R.suggest(x.b.rounded,x.data.rounds);
    $('premio-a').value=s.group1;
    $('premio-b').value=s.group2;
    $('premio-final').value=Math.max(0,s.final);
    calc();draw();save();
    mark('Distribución tradicional sugerida. Revisa los premios antes de utilizarla.');
  }
  function absorbFinal() {
    const x=calc();
    if (x.b.error) {mark(x.b.error,true);return;}
    const s=R.suggest(x.b.rounded,x.data.rounds);
    $('premio-final').value=x.b.rounded - s.consolCount*10 - s.group1Count*number('premio-a') - s.group2Count*(x.data.rounds===6?number('premio-b'):0);
    calc();draw();save();
    mark('Se ajustó el lleno final para cuadrar el total. Comprueba que sea el premio más grande.');
  }
  function save() {
    const fields=['fecha','rondas','cartones','ruleta','dinamicas','video','precio','tasa','pozo','pozo-resultado','pozo-manual','premio-a','premio-b','premio-final','max-bolas','hora'];
    const d={};fields.forEach(k=>d[k]=$(k).value);
    try { localStorage.setItem(STORAGE,JSON.stringify(d)); }
    catch {mark('No se pudo guardar el borrador en este navegador.',true);}
  }
  function restore() {
    try {
      const d=JSON.parse(localStorage.getItem(STORAGE)||'null');
      if (!d || typeof d!=='object' || !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha||'')) return false;
      const fields=['fecha','rondas','cartones','ruleta','dinamicas','video','precio','tasa','pozo','pozo-resultado','pozo-manual','premio-a','premio-b','premio-final','max-bolas','hora'];
      fields.forEach(k=>{if(Object.hasOwn(d,k))$(k).value=d[k];});
      const p=R.programForDate($('fecha').value);
      $('rondas-info').textContent=p.special?'✨ Sábado especial · morado y dorado con mayor brillo':'💜 Estilo tradicional · morado, marfil y dorado';
      lastValidDate=$('fecha').value;
      return true;
    } catch {return false;}
  }
  const C={deep:'#280835',violet:'#4d1660',purple:'#310b4b',gold:'#f2c960',goldDark:'#ab6a1b',ivory:'#fff6e6',plum:'#5d1563'};
  function rect(ctx,x,y,w,h,r,color,stroke) {
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
    ctx.fillStyle=color;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=4;ctx.stroke();}
  }
  function text(ctx,s,x,y,size,color=C.ivory,weight=800,align='left',maxWidth=Infinity) {
    ctx.font=weight+' '+size+'px system-ui,Arial,sans-serif';ctx.fillStyle=color;ctx.textAlign=align;
    if (Number.isFinite(maxWidth)) ctx.fillText(String(s),x,y,maxWidth);
    else ctx.fillText(String(s),x,y);
  }
  function drawDrum(ctx,cx,cy,r) {
    ctx.save();
    ctx.shadowColor='#f6c95099';ctx.shadowBlur=20;
    const gradient=ctx.createRadialGradient(cx-r*.35,cy-r*.4,3,cx,cy,r);
    gradient.addColorStop(0,'#a777a9');gradient.addColorStop(.65,'#3e0e53');gradient.addColorStop(1,'#160923');
    ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.fillStyle=gradient;ctx.fill();
    ctx.shadowBlur=0;
    const pts=[[-.36,-.45,75],[.2,-.48,16],[.52,-.1,23],[-.53,.12,8],[.1,.19,42],[.39,.5,61],[-.27,.51,3]];
    pts.forEach(([a,b,n],i)=>{
      const xx=cx+a*r, yy=cy+b*r,rad=r*.19;
      ctx.beginPath();ctx.arc(xx,yy,rad,0,Math.PI*2);ctx.fillStyle=i%2?C.ivory:C.gold;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=C.goldDark;ctx.stroke();
      text(ctx,n,xx,yy+rad*.39,rad*1.13,C.purple,900,'center');
    });
    ctx.strokeStyle=C.gold;ctx.lineWidth=Math.max(3,r*.045);
    for(let j=-2;j<=2;j++){
      ctx.beginPath();ctx.ellipse(cx,cy,r*.23*Math.abs(j)+r*.12,r,0,0,Math.PI*2);ctx.stroke();
    }
    for(let k=-2;k<=2;k++){
      ctx.beginPath();ctx.ellipse(cx,cy,r,r*.22*Math.abs(k)+r*.1,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.lineWidth=Math.max(5,r*.065);ctx.strokeStyle=C.goldDark;ctx.stroke();
    ctx.restore();
  }
  function poster(ctx,orientation,x) {
    if (window.AndySorteoArt?.poster) {
      return window.AndySorteoArt.poster(ctx,orientation,{
        date:x.data.date,rounds:x.data.rounds,tickets:x.data.tickets,priceBs:x.data.priceBs,
        hour:$('hora').value,balls:number('max-bolas'),final:number('premio-final'),
        group1:number('premio-a'),group2:x.data.rounds===6?number('premio-b'):0,
        total:x.b.rounded,pot:x.pot,
        saturday:R.programForDate(x.data.date).special
      });
    }
    const story=orientation==='story',w=1080,h=story?1920:1080;
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,story?'#21052f':'#3d104d');g.addColorStop(.56,'#4b1760');g.addColorStop(1,'#1a0727');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    const halo=ctx.createRadialGradient(740,story?240:150,10,600,story?500:420,750);
    halo.addColorStop(0,'#d8985638');halo.addColorStop(1,'#d8985600');ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#ad713a33';ctx.beginPath();ctx.moveTo(0,h*.82);ctx.lineTo(200,h*.65);ctx.lineTo(335,h*.75);ctx.lineTo(560,h*.56);ctx.lineTo(780,h*.75);ctx.lineTo(940,h*.61);ctx.lineTo(w,h*.67);ctx.lineTo(w,h);ctx.closePath();ctx.fill();
    for(let i=0;i<80;i++){
      const px=(i*293+11)%w, py=(i*177+65)%h;
      ctx.beginPath();ctx.arc(px,py,i%4===0?3.5:1.5,0,2*Math.PI);ctx.fillStyle=i%3?'#f0c47188':'#fff4df88';ctx.fill();
    }
    ctx.strokeStyle=C.gold;ctx.lineWidth=7;ctx.strokeRect(20,20,w-40,h-40);
    const special=R.programForDate(x.data.date).special;
    if(special){
      for(let i=0;i<35;i++){
        const px=(i*61+44)%w,py=(i*97+54)%h;
        ctx.fillStyle=i%2?'#f6d780':'#fff3df';ctx.fillRect(px,py,12+(i%4)*3,4+(i%3)*2);
      }
    }
    const titleY=story?120:107;
    text(ctx,'♛  BINGO  ♛',55,titleY,39,C.gold,900);
    text(ctx,'ANDINO',55,titleY+103,108,C.ivory,950);
    text(ctx,'75',540,titleY+103,130,C.gold,950);
    text(ctx,'TU MEJOR JUGADA',60,titleY+150,28,C.gold,800);
    drawDrum(ctx,story?823:846,story?265:145,story?155:110);
    if(special)text(ctx,'✨ SÁBADO ESPECIAL',55,story?398:247,31,C.gold,900);
    const finalY=story?450:285,finalH=story?590:275;
    ctx.save();ctx.shadowColor='#09000cbb';ctx.shadowBlur=30;ctx.shadowOffsetY=11;
    rect(ctx,40,finalY,1000,finalH,32,'#fff3d6',C.gold);ctx.restore();
    const inset=ctx.createLinearGradient(46,finalY,1030,finalY+finalH);
    inset.addColorStop(0,'#5b176a');inset.addColorStop(1,'#270638');
    rect(ctx,51,finalY+11,978,finalH-22,25,inset,'#eabb62');
    text(ctx,'👑  LLENO FINAL  ·  RONDA '+x.data.rounds,w/2,finalY+(story?104:66),story?53:40,C.ivory,900,'center');
    text(ctx,'$'+fmt(number('premio-final')),w/2,finalY+(story?398:212),story?260:158,C.gold,950,'center',920);
    text(ctx,'USD  ·  EL PREMIO MÁS GRANDE',w/2,finalY+finalH-(story?81:24),story?42:24,C.ivory,800,'center');
    const sumY=story?1072:585, sumH=story?215:126;
    rect(ctx,40,sumY,480,sumH,22,C.ivory,C.gold);
    rect(ctx,540,sumY,500,sumH,22,C.ivory,C.gold);
    text(ctx,'TOTAL A REPARTIR',62,sumY+(story?54:34),story?39:26,C.purple,900);
    text(ctx,money(x.b.rounded),62,sumY+(story?153:101),story?115:74,C.purple,950);
    text(ctx,'POZO ACUMULADO',562,sumY+(story?54:34),story?38:26,C.purple,900);
    text(ctx,money(x.pot),562,sumY+(story?151:101),story?102:70,C.plum,950);
    const infoY=story?1310:730,infoH=story?175:118;
    rect(ctx,40,infoY,1000,infoH,20,C.ivory,C.gold);
    const dt=new Date(x.data.date+'T12:00:00Z');
    const day=new Intl.DateTimeFormat('es-VE',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'long'}).format(dt).toUpperCase();
    text(ctx,day,63,infoY+(story?65:49),story?41:33,C.purple,900,'left',550);
    text(ctx,'EN VIVO · '+$('hora').value+' · YOUTUBE',63,infoY+(story?132:91),story?36:29,C.plum,800);
    text(ctx,x.data.tickets+' CARTONES',1015,infoY+(story?68:48),story?50:34,C.purple,900,'right');
    text(ctx,fmt(x.data.priceBs)+' Bs / CARTÓN',1015,infoY+(story?133:89),story?46:31,C.plum,900,'right');
    const prizesY=story?1514:868,prizeH=story?263:142;
    const prizeBoxes=x.data.rounds===6?3:2;
    const space=14, boxW=(1000-space*(prizeBoxes-1))/prizeBoxes;
    const items=[{label:(x.data.rounds===6?4:3)+' CONSOLACIONES',amount:10,desc:'CADA UNA'},
      {label:(x.data.rounds===6?'3 LLENOS':'4 LLENOS'),amount:number('premio-a'),desc:'CADA UNO'}];
    if(x.data.rounds===6) items.push({label:'2 LLENOS',amount:number('premio-b'),desc:'CADA UNO'});
    items.forEach((v,i)=>{
      const xx=40+i*(boxW+space);
      rect(ctx,xx,prizesY,boxW,prizeH,17,C.ivory,C.gold);
      text(ctx,v.label,xx+boxW/2,prizesY+(story?68:36),story?36:25,C.purple,900,'center',boxW-22);
      text(ctx,money(v.amount),xx+boxW/2,prizesY+(story?184:103),story?102:70,C.plum,950,'center',boxW-26);
      text(ctx,v.desc,xx+boxW/2,prizesY+prizeH-(story?28:8),story?25:18,C.purple,800,'center');
    });
    if(story){
      text(ctx,'MÁXIMO '+fmt(number('max-bolas'))+' BOLITAS PARA EL POZO',w/2,1843,30,C.gold,850,'center');
      text(ctx,'BINGOANDINO75.COM  ·  BOLAS MANUALES  ·  PAGOS AL INSTANTE',w/2,1886,24,C.ivory,800,'center',960);
    } else {
      text(ctx,'POZO: HASTA '+fmt(number('max-bolas'))+' BOLITAS  ·  BINGOANDINO75.COM',w/2,1046,25,C.ivory,800,'center',980);
    }
  }
  function draw() {
    const x=calc();
    const format=$('vista-formato').value;
    const c=$('canvas');
    c.width=1080;c.height=format==='story'?1920:1080;
    const ctx=c.getContext('2d');
    if(!ctx)return;
    ctx.clearRect(0,0,c.width,c.height);
    if(x.good)poster(ctx,format,x);
    else {
      const g=ctx.createLinearGradient(0,0,1080,c.height);g.addColorStop(0,C.purple);g.addColorStop(1,C.deep);
      ctx.fillStyle=g;ctx.fillRect(0,0,1080,c.height);
      rect(ctx,55,c.height*.34,970,330,25,C.ivory,C.gold);
      text(ctx,'BINGO ANDINO 75',540,c.height*.34+95,62,C.purple,900,'center');
      text(ctx,'COMPLETA LOS DATOS',540,c.height*.34+168,57,C.plum,900,'center');
      text(ctx,'para ver el anuncio con cifras verificadas',540,c.height*.34+225,28,C.purple,500,'center');
    }
    $('canvas').setAttribute('aria-label',x.good?'Vista previa del sorteo del '+x.data.date:'Vista previa pendiente de datos');
  }
  function socialText(short) {
    const x=calc();
    if(!x.good)return '';
    const d=new Intl.DateTimeFormat('es-VE',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(x.data.date+'T12:00:00Z'));
    const lines=short?[`🎱 ¡Próximo sorteo de Bingo Andino 75!`,`📅 ${d} · ${$('hora').value}`,
      `🏆 Lleno final: ${money(number('premio-final'))}`,
      `💰 ${money(x.b.rounded)} a repartir · Pozo: ${money(x.pot)}`,
      `🎫 ${x.data.tickets} cartones · ${fmt(x.data.priceBs)} Bs`,
      `👉 bingoandino75.com`]:[
      `💜🎱 ¡Familia binguera! Este ${d} tenemos un nuevo sorteo de Bingo Andino 75.`,
      `👑 ¡LLENO FINAL DE ${money(number('premio-final'))}!`,
      `💰 Total a repartir: ${money(x.b.rounded)} USD.`,
      `🍀 Pozo acumulado: ${money(x.pot)} USD (máximo ${fmt(number('max-bolas'))} bolitas).`,
      `🎁 ${x.data.rounds===6?4:3} consolaciones de $10 y ${x.data.rounds} rondas para ganar.`,
      `🎫 ${x.data.tickets} cartones disponibles · ${fmt(x.data.priceBs)} Bs por cartón.`,
      `🔴 En vivo a las ${$('hora').value} por YouTube. ¡Con un cartón participas en todas las rondas!`,
      `🌐 bingoandino75.com #BingoAndino75`];
    return lines.join('\n');
  }
  async function copy(short) {
    const s=socialText(short);
    if(!s){mark('Completa y verifica los datos antes de copiar los anuncios.',true);return;}
    try {await navigator.clipboard.writeText(s);mark(short?'Mensaje de WhatsApp copiado.':'Texto para Instagram y Facebook copiado.');}
    catch { $('texto-copia').hidden=false;$('texto-copia').value=s;mark('Selecciona el texto del cuadro para copiarlo.',true); }
  }
  function download(format) {
    $('vista-formato').value=format;draw();
    const x=calc();
    if(!x.good){mark(x.error||'Revisa los datos.',true);return;}
    const c=$('canvas');
    c.toBlob((blob)=>{
      if(!blob){mark('No se pudo crear el archivo PNG.',true);return;}
      const url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url;a.download='bingo-andino75-'+x.data.date+'-'+(format==='story'?'historia':'cuadrada')+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
      generated=true;mark('PNG descargado. ANDY no ha publicado nada en la página ni en redes sociales.');
    },'image/png');
  }
  function init() {
    const d=next(todayVE());
    if(!restore())defaults(d);
    else {calc();mark('Borrador restaurado desde este dispositivo.');}
    root.querySelectorAll('input,select').forEach(input=>input.addEventListener('input',()=>{
      if(input.id==='andy-sd-fecha'){
        try {R.programForDate(input.value);}catch {input.value=lastValidDate;mark('No se programan sorteos los domingos o con fecha inválida.',true);return;}
        defaults(input.value);
      } else if(input.id==='andy-sd-rondas') {
        const gifts=R.defaultGifts(number('rondas'));
        $('video').value=gifts.video;
        $('precio').value=number('rondas')===5?'400':'';
        $('premio-a').value='';$('premio-b').value='';$('premio-final').value='';
      }
      if(input.id!=='andy-sd-vista-formato')generated=false;
      calc();draw();save();
    }));
    $('precio-bcv').addEventListener('click',()=>{
      const p=R.bcvCeiling(number('tasa'));
      if(p===null){mark('Escribe primero la tasa BCV correspondiente al próximo sorteo.',true);return;}
      $('precio').value=p;calc();draw();save();mark('Precio redondeado hacia arriba a '+p+' Bs. Puedes corregirlo manualmente.');
    });
    $('sugerir').addEventListener('click',suggestion);
    $('cuadrar').addEventListener('click',absorbFinal);
    $('descargar-cuadrado').addEventListener('click',()=>download('post'));
    $('descargar-historia').addEventListener('click',()=>download('story'));
    $('copiar-redes').addEventListener('click',()=>copy(false));
    $('copiar-whatsapp').addEventListener('click',()=>copy(true));
    $('siguiente').addEventListener('click',()=>{defaults(next($('fecha').value));save();draw();mark('Próximo sorteo cargado. Completa la tasa y confirma el pozo.');});
    draw();
  }
  init();
})();
