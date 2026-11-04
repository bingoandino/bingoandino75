/* ANDY Sorteo Diario: cálculo local y plantilla rápida, sin servicios externos. */
(function () {
  'use strict';
  const R = window.AndySorteoRules;
  const root = document.getElementById('andy-sorteo-diario');
  if (!R || !root) return;
  const $ = (s) => root.querySelector('#andy-sd-' + s);
  const STORAGE = 'bingo_andy_sorteo_diario_borrador_v1';
  let lastValidDate = ''; 
  const locale = new Intl.NumberFormat('es-VE',{maximumFractionDigits:2});
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
    $('total-manual').value='';
    $('rondas-info').textContent=p.special?'✨ Sábado especial · morado y dorado con mayor brillo':'💜 Estilo tradicional · morado, marfil y dorado';
    $('pozo-manual').value='';
    $('premio-a').value=''; $('premio-b').value=''; $('premio-final').value='';
    calc();
  }
  function read() {
    return {date:$('fecha').value,rounds:number('rondas'),tickets:number('cartones'),gifted:number('ruleta')+number('dinamicas')+number('video'),
      priceBs:number('precio'),rateBs:number('tasa'),manualTotal:$('total-manual').value.trim()};
  }
  function calc() {
    const data=read();
    const b=R.budget(data);
    $('total-manual-wrap').hidden=data.rounds===6;
    const p=R.suggest(b.rounded||0,data.rounds);
    $('base').textContent=data.gifted+' cartones base · '+Math.max(0,data.tickets-data.gifted)+' para el cálculo';
    $('presupuesto').textContent=b.error?'Pendiente':money(b.rounded);
    $('presupuesto-sub').textContent=b.error?b.error:b.marginVerified?'Reserva del 20%: '+money(b.kept20)+' · Aporte al pozo: $10 · Antes del redondeo: '+money(b.available):'Total elegido manualmente · No es posible verificar el 20% sin conocer la tasa de cambio. Recuerda reservar $10 adicionales para el pozo fuera de los premios anunciados.';
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
    if (pot===null) error = error || 'Escribe el monto del pozo acumulado (USD).';
    if (!data.date || !data.tickets || !data.priceBs) error=error||'Completa los datos del sorteo.';
    if (!Number.isInteger(number('max-bolas')) || number('max-bolas')<1 || number('max-bolas')>75) error=error||'El máximo de bolitas debe estar entre 1 y 75.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test($('hora').value)) error=error||'Indica una hora válida.';
    $('validacion').textContent=error?'⚠️ '+error:b.marginVerified?'✅ Premios y presupuesto calculados. Prepara las instrucciones para ChatGPT.':'✅ Los premios cuadran con tu total manual; el margen del 20% no está verificado sin tasa BCV.';
    $('validacion').dataset.valid=error?'false':'true';
    const good=!error;
    $('preparar-chatgpt').disabled=!good;
    $('copiar-redes').disabled=!good;
    $('copiar-whatsapp').disabled=!good;
    return {data,b,p,pot,good,error,totalPrize};
  }
  function projectPot() {
    // El pozo anunciado es el monto introducido por el usuario; no se incrementa automáticamente.
    const raw=$('pozo-manual').value.trim();
    if (!raw) return null;
    const amount=Number(raw);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
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
    const fields=['fecha','rondas','cartones','ruleta','dinamicas','video','precio','tasa','total-manual','pozo-manual','premio-a','premio-b','premio-final','max-bolas','hora'];
    const d={};fields.forEach(k=>d[k]=$(k).value);
    try { localStorage.setItem(STORAGE,JSON.stringify(d)); }
    catch {mark('No se pudo guardar el borrador en este navegador.',true);}
  }
  function restore() {
    try {
      const d=JSON.parse(localStorage.getItem(STORAGE)||'null');
      if (!d || typeof d!=='object' || !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha||'')) return false;
      const fields=['fecha','rondas','cartones','ruleta','dinamicas','video','precio','tasa','total-manual','pozo-manual','premio-a','premio-b','premio-final','max-bolas','hora'];
      fields.forEach(k=>{if(Object.hasOwn(d,k))$(k).value=d[k];});
      const p=R.programForDate($('fecha').value);
      $('rondas-info').textContent=p.special?'✨ Sábado especial · morado y dorado con mayor brillo':'💜 Estilo tradicional · morado, marfil y dorado';
      lastValidDate=$('fecha').value;
      return true;
    } catch {return false;}
  }
  function draw() {
    // La imagen se genera aquí en ChatGPT, no en Canvas.
    // Si cambian los datos, ya no se considera vigente el brief anterior.
    const result=$('resultado-chatgpt');
    if(result)result.hidden=true;
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
  async function copyPrompt() {
    const field=$('prompt');
    if(!field.value){mark('Primero prepara las instrucciones para ChatGPT.',true);return;}
    try{
      await navigator.clipboard.writeText(field.value);
      mark('Instrucciones copiadas. Pégalas aquí en ChatGPT para generar la imagen profesional.');
    }catch{
      field.focus?.();field.select?.();
      mark('Copia manualmente las instrucciones del cuadro y pégalas en ChatGPT.');
    }
  }
  async function prepareChatGPT() {
    const x=calc();
    if(!x.good){mark(x.error||'Completa y revisa las cifras antes de preparar el anuncio.',true);return;}
    if(!window.AndyChatGPTBrief){mark('El generador de instrucciones no cargó. Actualiza ANDY.',true);return;}
    const data={
      format:$('vista-formato').value,rounds:x.data.rounds,
      tickets:x.data.tickets,priceBs:x.data.priceBs,total:x.b.rounded,pot:x.pot,
      final:number('premio-final'),group1:number('premio-a'),
      group2:x.data.rounds===6?number('premio-b'):0,
      consolCount:x.data.rounds===6?4:3,consolValue:10,balls:number('max-bolas'),
      date:x.data.date,hour:$('hora').value,saturday:R.programForDate(x.data.date).special
    };
    try{
      $('prompt').value=window.AndyChatGPTBrief.sorteoBrief(data);
      $('resultado-chatgpt').hidden=false;
      await copyPrompt();
    }catch(err){mark(err.message||'No se pudo preparar el anuncio.',true);}
  }
  function init() {
    // Único botón visible al inicio. El menú se abre solo por decisión del usuario.
    const opener=$('abrir'), menu=$('panel');
    menu.hidden=true;
    opener.setAttribute('aria-expanded','false');
    opener.addEventListener('click',()=>{
      const open=menu.hidden;
      menu.hidden=!open;
      opener.setAttribute('aria-expanded',String(open));
      if(open) draw();
    });
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
        $('total-manual').value='';
        $('premio-a').value='';$('premio-b').value='';$('premio-final').value='';
      }
      calc();draw();save();
    }));
    $('precio-bcv').addEventListener('click',()=>{
      const p=R.bcvCeiling(number('tasa'));
      if(p===null){mark('Escribe primero la tasa BCV correspondiente al próximo sorteo.',true);return;}
      $('precio').value=p;calc();draw();save();mark('Precio redondeado hacia arriba a '+p+' Bs. Puedes corregirlo manualmente.');
    });
    $('sugerir').addEventListener('click',suggestion);
    $('cuadrar').addEventListener('click',absorbFinal);
    $('preparar-chatgpt').addEventListener('click',()=>{void prepareChatGPT();});
    $('copiar-prompt').addEventListener('click',()=>{void copyPrompt();});
    $('copiar-redes').addEventListener('click',()=>copy(false));
    $('copiar-whatsapp').addEventListener('click',()=>copy(true));
    $('siguiente').addEventListener('click',()=>{defaults(next($('fecha').value));save();draw();mark('Próximo sorteo cargado. Escribe el precio en Bs y el pozo. La tasa BCV es opcional.');});
    draw();
  }
  init();
})();
