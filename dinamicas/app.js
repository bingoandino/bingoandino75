const BASE='https://dbkixcpwirjwjvjintkr.supabase.co';
const PUBLIC_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRia2l4Y3B3aXJqd2p2amludGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjYxNDksImV4cCI6MjA2MTY0MjE0OX0.QJmWLWSe-pRYwxWeel8df7JLhNUvMKaTpL0MCDorgho";
const ENDPOINT=BASE+'/functions/v1/dinamicas-ia';
let auth=null;try{auth=JSON.parse(sessionStorage.getItem('ba75-dinamicas-auth')||'null')}catch{}
function rememberAuth(data){auth={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+Number(data.expires_in||3600)*1000};sessionStorage.setItem('ba75-dinamicas-auth',JSON.stringify(auth));}
async function authRequest(path,body){const r=await fetch(BASE+'/auth/v1/'+path,{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.msg||d.error_description||'No se pudo verificar el acceso.');return d;}
async function api(body,token=PUBLIC_KEY){const r=await fetch(ENDPOINT,{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'No se pudo completar la solicitud.'),{status:r.status});return d;}
async function accessToken(){if(!auth?.access_token)throw Object.assign(Error('Ingresa con tu correo de administrador para usar la IA.'),{status:401});if(auth.expires_at<Date.now()+60000){try{rememberAuth(await authRequest('token?grant_type=refresh_token',{refresh_token:auth.refresh_token}))}catch{auth=null;sessionStorage.removeItem('ba75-dinamicas-auth');throw Object.assign(Error('Tu acceso venció. Solicita otro código.'),{status:401})}}return auth.access_token;}

const $=id=>document.getElementById(id);let type='Adivinanza',busy=false,activeId=null,origin='Ejemplo',toastTimer;let history=[];try{const h=JSON.parse(localStorage.getItem('ba75-dinamicas-v1')||'[]');if(Array.isArray(h))history=h.filter(x=>x&&typeof x.message==='string'&&typeof x.answer==='string').slice(0,300)}catch{}
const TYPES=['Foto en casa','Adivinanza','Trivia','Palabra desordenada','Acertijo'];
function toast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800)}
function format(q){const prize='1 cartón gratis';return '🧩 *¡DINÁMICA, FAMILIA BINGUERA!*\n\n'+q+(prize?'\n\n🎁 *Premio: '+prize+'*':'')+(type==='Foto en casa'?'\n\n👇 ¡Envía tu foto al grupo!':'\n\n👇 ¡Escribe tu respuesta!')}
function setDraft(q,a,e,s){$('message').value=format(q);$('answer').value=a;$('explanation').textContent=e||'';$('source').textContent=s;origin=s;activeId=null;$('solution').open=false;$('solution').querySelector('summary').textContent=type==='Foto en casa'?'🔒 Criterio de revisión · solo para ti':'🔒 Ver respuesta · solo para ti'}

function persist(){try{localStorage.setItem('ba75-dinamicas-v1',JSON.stringify(history))}catch{toast('No se pudo guardar. Exporta una copia del historial.')}renderHistory()}
function save(status){const message=$('message').value.trim(),answer=$('answer').value.trim();if(!message){toast('Escribe primero la dinámica.');return}let item=history.find(x=>x.id===activeId);if(!item)item=history.find(x=>x.message===message&&x.answer===answer);if(item){Object.assign(item,{message,answer,status:status||item.status})}else{item={id:typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),message,answer,explanation:$('explanation').textContent,type,origin,date:new Date().toISOString(),status:status||'Guardada'};history.unshift(item);history=history.slice(0,300)}activeId=item.id;persist();return item}
function tab(h){$('history').hidden=!h;$('creator').hidden=h;$('historyTab').classList.toggle('active',h);$('createTab').classList.toggle('active',!h);$('winners').hidden=true;$('winnersTab').classList.remove('active')}
function renderHistory(){$('count').textContent=history.length;const list=$('historyList');list.replaceChildren();if(!history.length){const box=document.createElement('div');box.className='empty';box.textContent='Tu próxima dinámica empieza aquí. Las que guardes aparecerán en este espacio.';list.append(box);return}for(const item of history){const row=document.createElement('article');row.className='history-item';const info=document.createElement('div'),meta=document.createElement('small'),p=document.createElement('p');meta.textContent=(item.type||'Dinámica')+' · '+new Date(item.date).toLocaleString('es-VE',{timeZone:'America/Caracas'})+' · '+item.status;p.textContent=item.message.slice(0,190);info.append(meta,p);const acts=document.createElement('div');acts.className='history-actions';const open=document.createElement('button');open.className='secondary';open.textContent='Abrir';open.onclick=()=>{type=TYPES.includes(item.type)?item.type:'Adivinanza';syncTypes();$('message').value=item.message;$('answer').value=item.answer;$('explanation').textContent=item.explanation||'';$('source').textContent=item.origin||'Guardada';origin=item.origin;activeId=item.id;$('solution').open=false;tab(false)};const del=document.createElement('button');del.className='textbtn';del.textContent='Eliminar';del.onclick=()=>{if(confirm('¿Eliminar esta dinámica del historial?')){history=history.filter(x=>x.id!==item.id);persist()}};acts.append(open,del);row.append(info,acts);list.append(row)}}
function syncTypes(){document.querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('selected',b.dataset.type===type);b.setAttribute('aria-pressed',b.dataset.type===type)})}
document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{type=b.dataset.type;syncTypes()});$('manual').onclick=()=>{setDraft('','','','Manual');$('message').value='';$('message').focus()};$('createTab').onclick=()=>tab(false);$('historyTab').onclick=()=>tab(true);$('save').onclick=()=>{if(save())toast('Dinámica guardada.')};$('copy').onclick=async()=>{if(!$('message').value.trim())return toast('Escribe primero la dinámica.');try{await navigator.clipboard.writeText($('message').value);save();toast('Texto copiado, sin la respuesta.')}catch{$('message').select();toast('Mantén pulsado el texto para copiarlo.')}};
$('share').onclick=()=>{if(!$('message').value.trim())return toast('Escribe primero la dinámica.');save('Compartir iniciado');window.open('https://wa.me/?text='+encodeURIComponent($('message').value),'_blank','noopener,noreferrer');toast('Elige tu grupo y confirma el envío en WhatsApp.')};
$('export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(history,null,2)],{type:'application/json'}));a.href=url;a.download='bingo-andino-dinamicas.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('generate').onclick=async()=>{if(busy)return;busy=true;setDraft('','','','Creando y revisando tu dinámica…');$('message').value='';$('generate').disabled=true;$('generate').textContent='✦ Creando y revisando…';try{const token=await accessToken();const d=await api({action:'generate',type,theme:$('theme').value,difficulty:$('difficulty').value,previous:history.slice(0,30).map(x=>x.message.slice(0,2000))},token);setDraft(d.question,d.answer,d.explanation,d.source||'Dinámica revisada');save('Generada');toast('Lista. Revisa la respuesta antes de compartir.')}catch(e){$('source').textContent='No se generó una dinámica nueva.';if(e.status===401){$('login').showModal();$('access').textContent='Acceso a la IA';}toast(e.name==='TimeoutError'?'La IA tardó demasiado. Inténtalo de nuevo.':e.message)}finally{busy=false;$('generate').disabled=false;$('generate').textContent='✦ Generar con IA'}};

async function refreshStatus(){try{const d=await api({action:'status'});$('aiStatus').textContent=d.ready?'IA y biblioteca de dinámicas · acceso de administrador':'IA pendiente de configuración';$('connection').hidden=d.ready;if(!d.ready)$('connection').textContent='La IA necesita configuración. Puedes generar dinámicas de la biblioteca revisada o escribir la tuya.';}catch{$('aiStatus').textContent='No se pudo comprobar la conexión.'}}
$('access').onclick=()=>{$('logout').hidden=!auth;$('login').showModal()};$('closeLogin').onclick=()=>$('login').close();$('logout').onclick=()=>{auth=null;sessionStorage.removeItem('ba75-dinamicas-auth');$('access').textContent='Acceso a la IA';$('login').close();panel=null;showWon=false;$('winnerList').replaceChildren();$('dailySummary').disabled=true;$('weeklySummary').disabled=true;$('verifyPrizes').disabled=true;$('stockStatus').textContent='Ingresa para consultar el sorteo.';toast('Acceso a IA cerrado en esta app.')};let codeSent=false;
$('loginForm').onsubmit=async e=>{e.preventDefault();const btn=$('loginSubmit');btn.disabled=true;$('loginError').textContent='';try{if(!codeSent){await authRequest('otp',{email:$('email').value.trim().toLowerCase(),create_user:false});codeSent=true;$('email').readOnly=true;$('codeFields').hidden=false;$('code').required=true;btn.textContent='Verificar código';$('loginError').textContent='Revisa tu correo e ingresa el código recibido.';$('code').focus();}else{const d=await authRequest('verify',{email:$('email').value.trim().toLowerCase(),token:$('code').value.trim(),type:'email'});if(d.user?.id!=='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5')throw Error('Acceso exclusivo del administrador de Bingo Andino 75.');await api({action:'check'},d.access_token);rememberAuth(d);$('code').value='';$('login').close();$('access').textContent='IA · acceso activo';toast('Acceso confirmado. Ya puedes generar dinámicas.');if(!$('winners').hidden)loadPanel();}}catch(e){$('loginError').textContent=e.message}finally{btn.disabled=false}};
refreshStatus();setDraft('','','','Elige el tema y la dificultad y genera una dinámica.');$('message').value='';renderHistory();if(auth)$('access').textContent='IA · acceso activo';
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

const ANNOUNCEMENT='📢 *¡Familia binguera, vienen las dinámicas!* 🧩\n\n🎁 El premio de cada dinámica es *1 cartón gratis*.\n\n📌 Cada persona solo puede ganar *una vez por semana*, de lunes a domingo. Si ya ganaste esta semana, dale la oportunidad a otro participante. 💜';
$('announcementText').value=ANNOUNCEMENT;
$('announcement').onclick=()=>$('announcementDialog').showModal();$('closeAnnouncement').onclick=()=>$('announcementDialog').close();
function shareText(text){if(!text.trim())return;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer')}
async function copyText(value,field){try{await navigator.clipboard.writeText(value);toast('Texto copiado.')}catch{$(field).focus();$(field).select();toast('Mantén pulsado el texto para copiarlo.')}}
$('copyAnnouncement').onclick=()=>copyText($('announcementText').value,'announcementText');$('shareAnnouncement').onclick=()=>shareText($('announcementText').value);
let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').textContent='Instalar app'});window.addEventListener('appinstalled',()=>{$('install').hidden=true;installPrompt=null;toast('App instalada.')});
if(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone)$('install').hidden=true;
$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else $('installDialog').showModal()};$('closeInstall').onclick=()=>$('installDialog').close();
let panel=null,panelFresh=false,viewToday=false,pending=null,awarding=false,showWon=false;
const winnerFields=['winnerName','winnerCedula','winnerPhone','winnerBank'];
try{const stored=JSON.parse(sessionStorage.getItem('ba75-dinamicas-pending')||'null');if(stored?.requestId&&stored.recipient&&stored.anchor){pending=stored;winnerFields.forEach((id,i)=>$(id).value=stored.recipient[['name','cedula','phone','bank'][i]]||'')}}catch{}
function needLogin(e){if(e.status===401){$('logout').hidden=!auth;$('login').showModal()}return e.message||'No se pudo completar la operación.'}
function lockRecipient(locked){winnerFields.forEach(id=>$(id).disabled=locked)}
if(pending){lockRecipient(true);$('reviewAward').textContent='Reintentar entrega pendiente';$('awardError').textContent='Hay una entrega sin confirmar. Consulta el resultado antes de crear otra.'}
function weekDate(value){return new Date(value+'T12:00:00-04:00').toLocaleDateString('es-VE',{day:'numeric',month:'long',timeZone:'America/Caracas'})}
async function loadPanel(){panelFresh=false;$('dailySummary').disabled=true;$('weeklySummary').disabled=true;$('verifyPrizes').disabled=true;$('refreshWinners').disabled=true;$('winnersError').hidden=true;try{const token=await accessToken();const data=await api({action:'dashboard'},token);if(!Array.isArray(data.winners)||!data.today||!data.anchor)throw Error('No se pudo leer el historial.');panel=data;panelFresh=true;$('stockStatus').textContent=data.salesOpen?data.available+' cartones disponibles de '+data.total+' · Ventas abiertas':'Ventas cerradas · abre el sorteo para entregar cartones.';$('weekLabel').textContent='Del '+weekDate(data.weekStart)+' al '+weekDate(data.weekEnd)+' · Hora de Venezuela';renderWinners();$('dailySummary').disabled=!data.winners.some(w=>w.dia===data.today);$('weeklySummary').disabled=!data.winners.length;$('verifyPrizes').disabled=!data.winners.length;return data}catch(e){$('winnersError').textContent=needLogin(e)+' Los datos anteriores, si aparecen, no están actualizados.';$('winnersError').hidden=false;return null}finally{$('refreshWinners').disabled=false}}
// El historial de resultados publicados separa premios de rondas,
 // cartón lleno final, consolación y pozo. No mostrar avisos para montos nulos.
function premiosDelCarton(ganador){
 const detalles=Array.isArray(ganador?.premios_detalle)?ganador.premios_detalle:[];
 const premios=[];
 for(const item of detalles){
  const centimos=Number(item?.premio_centimos);
  if(!Number.isSafeInteger(centimos)||centimos<=0)continue;
  const tipo=String(item?.tipo||'');
  const orden=Number(item?.orden);
  let descripcion,emoji;
  if(tipo==='ronda'){
   if(!Number.isInteger(orden)||orden<1||orden>6)continue;
   descripcion='Ganó en la ronda '+orden;emoji='🏆';
  }else if(tipo==='final'){
   descripcion='Ganó el cartón lleno final'+(Number.isInteger(orden)&&orden>0?' (ronda '+orden+')':'');emoji='🏆';
  }else if(tipo==='consolacion'){
   descripcion='Ganó en consolación';emoji='🎁';
  }else if(tipo==='pozo'){
   descripcion='Ganó el pozo acumulado';emoji='💰';
  }else if(tipo==='aproximacion'){
   descripcion='Ganó aproximación';emoji='🎯';
  }else continue;
  premios.push({descripcion,emoji,centimos});
 }
 // Compatibilidad temporal con el total anterior si todavía no llega el detalle.
 if(!detalles.length){
  const centimos=Number(ganador?.premio_centimos);
  if(Number.isSafeInteger(centimos)&&centimos>0)premios.push({
   descripcion:'Ganó',emoji:'🏆',centimos
  });
 }
 return premios;
}
function montoPremioBs(centimos){
 return new Intl.NumberFormat('es-VE',{
  minimumFractionDigits:0,maximumFractionDigits:2
 }).format(centimos/100)+' Bs';
}
function renderWinners(){
 const list=$('winnerList');list.replaceChildren();
 $('todayFilter').classList.toggle('selected-filter',viewToday);
 $('weekFilter').classList.toggle('selected-filter',!viewToday);
 if(!panel)return;
 const items=panel.winners.filter(w=>!viewToday||w.dia===panel.today);
 if(!items.length){
  const p=document.createElement('p');p.className='empty';
  p.textContent=viewToday?'Todavía no hay ganadores registrados hoy.':'Todavía no hay ganadores registrados esta semana.';
  list.append(p);return;
 }
 for(const w of items){
  const row=document.createElement('article');row.className='history-item';
  const info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('p');
  const badges=document.createElement('div');badges.className='winner-badges';
  const badge=document.createElement('span');
  name.textContent=w.nombre;meta.className='winner-meta';
  meta.textContent=weekDate(w.dia)+' · Cédula terminada en '+w.cedula.slice(-4);
  badge.className='carton-pill';badge.textContent='Cartón '+w.carton;
  info.append(name,meta);badges.append(badge);
  if(showWon){
   for(const p of premiosDelCarton(w)){
    const premio=document.createElement('span');premio.className='prize-won';
    premio.textContent=p.emoji+' '+p.descripcion+' · '+montoPremioBs(p.centimos);
    badges.append(premio);
   }
  }
  row.append(info,badges);list.append(row);
 }
}
$('winnersTab').onclick=()=>{$('creator').hidden=true;$('history').hidden=true;$('winners').hidden=false;['createTab','historyTab'].forEach(id=>$(id).classList.remove('active'));$('winnersTab').classList.add('active');loadPanel()};$('refreshWinners').onclick=loadPanel;$('todayFilter').onclick=()=>{viewToday=true;renderWinners()};$('weekFilter').onclick=()=>{viewToday=false;renderWinners()};
$('verifyPrizes').onclick=async()=>{
 const data=await loadPanel();
 if(!data)return;
 showWon=true;
 renderWinners();
 $('verifyPrizes').textContent='↻ Actualizar premios ganados';
};

function publicDailySummary(data){const items=data.winners.filter(w=>w.dia===data.today).slice().reverse();if(!items.length)return '';return '🎉 *GANADORES DE LAS DINÁMICAS*\n*Bingo Andino 75 · '+weekDate(data.today)+'*\n\n'+items.map((w,i)=>(i+1)+'. '+w.nombre+' — Cartón *'+w.carton+'* 🎁').join('\n')+'\n\n💜 ¡Felicidades! Cada ganador recibió *1 cartón gratis*.\n📌 Recuerda: solo puedes ganar una vez por semana.'}
function publicWeeklySummary(data){
 const start=String(data?.weekStart||''),end=String(data?.weekEnd||'');
 const byDay=new Map();
 for(const winner of data?.winners||[]){
  const day=String(winner?.dia||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<start||day>end)continue;
  if(typeof winner.nombre!=='string'||!winner.nombre.trim()||!Number.isInteger(Number(winner.carton))||Number(winner.carton)<1)continue;
  if(!byDay.has(day))byDay.set(day,[]);
  byDay.get(day).push(winner);
 }
 if(!byDay.size)return '';
 const lines=[...byDay.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([day,winners])=>{
  const label=new Date(day+'T12:00:00-04:00').toLocaleDateString('es-VE',{weekday:'long',day:'numeric',month:'numeric',timeZone:'America/Caracas'});
  const heading=label.charAt(0).toLocaleUpperCase('es')+label.slice(1);
  return '*'+heading+' · '+winners.length+' '+(winners.length===1?'ganador':'ganadores')+'*\n'+
   winners.slice().reverse().map(w=>'• '+w.nombre.trim()+' — Cartón '+w.carton).join('\n');
 });
 return '🏆 *GANADORES DE LA SEMANA*\n\n'+lines.join('\n\n');
}
$('dailySummary').onclick=async()=>{if(!await loadPanel())return;const text=publicDailySummary(panel);if(!text)return toast('Todavía no hay ganadores registrados hoy.');$('summaryTitle').textContent='Ganadores de hoy';$('summaryText').value=text;$('summaryDialog').showModal()};
$('weeklySummary').onclick=async()=>{
 const data=await loadPanel();
 if(!data)return;
 const text=publicWeeklySummary(data);
 if(!text)return toast('Todavía no hay ganadores registrados esta semana.');
 $('summaryTitle').textContent='Ganadores de la semana';
 $('summaryText').value=text;
 $('summaryDialog').showModal();
};$('closeSummary').onclick=()=>$('summaryDialog').close();$('copySummary').onclick=()=>copyText($('summaryText').value,'summaryText');$('shareSummary').onclick=()=>shareText($('summaryText').value);
function showDelivery(w){const box=$('deliveryResult');box.hidden=false;box.replaceChildren();const title=document.createElement('strong'),line=document.createElement('p');box.className='award-success';title.textContent='🎁 Cartón '+w.carton;line.textContent=w.nombre+' · Registrado y aprobado';box.append(title,line);pending=null;sessionStorage.removeItem('ba75-dinamicas-pending');lockRecipient(false);$('winnerForm').reset();$('reviewAward').textContent='🎁 Revisar entrega de cartón gratis';$('awardError').textContent='';$('confirmError').textContent='';$('confirmAward').close();toast('Cartón entregado y ganador guardado.');loadPanel()}
function newUUID(){if(crypto.randomUUID)return crypto.randomUUID();const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;return Array.from(a,(v,i)=>([4,6,8,10].includes(i)?'-':'')+v.toString(16).padStart(2,'0')).join('')}
function showPreview(data){const box=$('awardPreview');box.replaceChildren();const dl=document.createElement('dl');dl.className='award-facts';for(const [label,value] of [['Nombre',data.name],['Cédula',data.cedula],['Teléfono',data.phone],['Banco',data.bank],['Premio','1 cartón gratis']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd)}box.append(dl);$('cancelAward').textContent='Corregir datos';$('confirmError').textContent='';$('confirmAward').showModal()}
$('winnerForm').onsubmit=async e=>{e.preventDefault();if(awarding)return;awarding=true;$('reviewAward').disabled=true;$('awardError').textContent='';try{const token=await accessToken();if(pending){const r=await api({...pending,action:'award'},token);if(r.awarded)return showDelivery(r.winner);throw Error('No se pudo consultar la entrega pendiente.')}const latest=await loadPanel();if(!latest)return;if(!latest.salesOpen)throw Error('Abre las ventas del sorteo actual antes de entregar cartones.');const request={requestId:newUUID(),anchor:latest.anchor,recipient:{name:$('winnerName').value,cedula:$('winnerCedula').value,phone:$('winnerPhone').value,bank:$('winnerBank').value}};const result=await api({...request,action:'preview-award'},token);if(result.awarded)return showDelivery(result.winner);pending={...request,recipient:{name:result.name,cedula:result.cedula,phone:result.phone,bank:result.bank}};showPreview(result);}catch(e){$('awardError').textContent=needLogin(e)}finally{awarding=false;$('reviewAward').disabled=false}};
$('cancelAward').onclick=()=>{if(awarding)return;if(!sessionStorage.getItem('ba75-dinamicas-pending'))pending=null;$('confirmAward').close()};$('confirmAward').addEventListener('cancel',e=>{if(awarding)e.preventDefault();else if(!sessionStorage.getItem('ba75-dinamicas-pending'))pending=null});
$('confirmDelivery').onclick=async()=>{if(!pending||awarding)return;awarding=true;$('confirmDelivery').disabled=true;$('cancelAward').disabled=true;lockRecipient(true);$('confirmError').textContent='Confirmando entrega…';try{sessionStorage.setItem('ba75-dinamicas-pending',JSON.stringify(pending));const token=await accessToken();const result=await api({...pending,action:'award'},token);if(!result.awarded)throw Error('No se pudo confirmar la entrega.');showDelivery(result.winner)}catch(e){$('cancelAward').textContent='Cerrar y consultar';$('confirmError').textContent=needLogin(e);$('awardError').textContent='Entrega sin confirmar. Consulta el resultado con los mismos datos.';$('reviewAward').textContent='Reintentar entrega pendiente';if(e.status===400||e.status===409){pending=null;sessionStorage.removeItem('ba75-dinamicas-pending');lockRecipient(false);$('reviewAward').textContent='🎁 Revisar entrega de cartón gratis';$('awardError').textContent=e.message;}}finally{awarding=false;$('confirmDelivery').disabled=false;$('cancelAward').disabled=false}};


// Lista de ganadores: usa las operaciones individuales e idempotentes del servidor.
const QUEUE_KEY='ba75-dinamicas-award-queue-v1';let awardQueue=[],batchAnchor=null,batchRunning=false;
try{const saved=JSON.parse(sessionStorage.getItem(QUEUE_KEY)||'[]');if(Array.isArray(saved))awardQueue=saved.filter(j=>j&&j.id&&j.recipient&&typeof j.recipient.name==='string').map(j=>({...j,state:j.state==='sending'?'unknown':j.state}));}catch{}
function saveQueue(){try{sessionStorage.setItem(QUEUE_KEY,JSON.stringify(awardQueue))}catch{throw Error('No se pudo guardar la entrega pendiente en este navegador. Libera espacio o usa menos personas antes de continuar.')}}
function queued(){return awardQueue.filter(j=>j.state!=='done')}
function queueBusy(value){batchRunning=value;$('queueAdd').disabled=value;$('queueReview').disabled=value||!queued().length;$('queueClearDone').disabled=value;$('batchDeliver').disabled=value;$('batchCancel').disabled=value;}
function renderQueue(){const list=$('queueList');list.replaceChildren();if(!awardQueue.length){const p=document.createElement('p');p.textContent='Todavía no agregaste personas a esta lista.';p.style.fontSize='13px';list.append(p)}for(const [i,j] of awardQueue.entries()){const row=document.createElement('article');row.className='history-item';const info=document.createElement('div'),name=document.createElement('strong'),status=document.createElement('p');name.textContent=(i+1)+'. '+j.recipient.name;status.style.fontSize='12px';status.textContent=j.state==='done'?'🎁 Cartón '+j.winner.carton+' · Entregado':j.state==='unknown'||j.state==='sending'?'⚠️ Entrega sin confirmar: se consultará con el mismo identificador':j.error||'1 cartón gratis · Cédula terminada en '+j.recipient.cedula.replace(/\D/g,'').slice(-4);info.append(name,status);row.append(info);if(!['done','sending','unknown'].includes(j.state)){const remove=document.createElement('button');remove.className='textbtn';remove.textContent='Quitar';remove.disabled=batchRunning;remove.onclick=()=>{awardQueue=awardQueue.filter(x=>x.id!==j.id);saveQueue();renderQueue()};row.append(remove)}list.append(row)}$('queueReview').textContent='Revisar '+queued().length+' ganador'+(queued().length===1?'':'es');$('queueReview').disabled=batchRunning||!queued().length;$('queueClearDone').hidden=!awardQueue.some(j=>j.state==='done');}
$('queueAdd').onclick=async()=>{if(awarding||batchRunning)return;if(sessionStorage.getItem('ba75-dinamicas-pending'))return toast('Resuelve primero la entrega individual pendiente.');if(!$('winnerForm').reportValidity())return;if(!await checkPriorWinner(true))return;const person={name:$('winnerName').value.trim(),cedula:$('winnerCedula').value.trim(),phone:$('winnerPhone').value.trim(),bank:$('winnerBank').value};const ced=s=>s.replace(/\D/g,'').replace(/^0+/,'');if(awardQueue.some(j=>ced(j.recipient.cedula)===ced(person.cedula)))return toast('Esta cédula ya está en la lista.');const job={id:newUUID(),recipient:person,state:'draft'};awardQueue.push(job);try{saveQueue();$('winnerForm').reset();renderQueue();$('queueMessage').textContent='Persona agregada. Puedes llenar los datos de la siguiente.';$('winnerName').focus()}catch(e){awardQueue.pop();toast(e.message)}};
$('queueClearDone').onclick=()=>{if(batchRunning)return;awardQueue=queued();saveQueue();renderQueue()};
$('queueReview').onclick=async()=>{if(awarding||batchRunning)return;if(sessionStorage.getItem('ba75-dinamicas-pending'))return toast('Resuelve primero la entrega individual pendiente.');awarding=true;queueBusy(true);$('queueMessage').textContent='';try{await accessToken();const data=await loadPanel();if(!data)return;const jobs=queued();if(!jobs.length)return;const repeats=jobs.filter(j=>!['unknown','sending'].includes(j.state)&&data.winners.some(w=>normalizedCedula(w.cedula)===normalizedCedula(j.recipient.cedula)&&w.id!==j.id));if(repeats.length){for(const j of repeats){j.state='error';j.error=priorWinText(data.winners.find(w=>normalizedCedula(w.cedula)===normalizedCedula(j.recipient.cedula)));}saveQueue();renderQueue();throw Error(repeats.map(j=>j.recipient.name+': '+j.error).join(' '));}const unresolved=jobs.filter(j=>['unknown','sending'].includes(j.state));if(!unresolved.length&&!data.salesOpen)throw Error('Abre las ventas del sorteo actual antes de entregar cartones.');if(!unresolved.length&&data.available<jobs.length)throw Error('Hay '+data.available+' cartones disponibles para '+jobs.length+' personas. Reduce la lista o revisa el sorteo.');batchAnchor=data.anchor;$('batchPreview').textContent=jobs.map((j,i)=>(i+1)+'. '+j.recipient.name+'\nCédula: '+j.recipient.cedula+' · Teléfono: '+j.recipient.phone+' · Banco: '+j.recipient.bank+(j.state==='unknown'?'\nEntrega sin confirmar: se recuperará la misma operación.':'')).join('\n\n');$('batchError').textContent='';$('batchDeliver').textContent='Confirmar '+jobs.length+' entrega'+(jobs.length===1?'':'s');$('batchConfirm').showModal()}catch(e){$('queueMessage').textContent=needLogin(e)}finally{awarding=false;queueBusy(false)}};
$('batchCancel').onclick=()=>{if(!batchRunning)$('batchConfirm').close()};$('batchConfirm').addEventListener('cancel',e=>{if(batchRunning)e.preventDefault()});
$('batchDeliver').onclick=async()=>{if(awarding||batchRunning)return;awarding=true;queueBusy(true);$('batchError').textContent='';let completed=0,activeJob=null;try{for(const job of queued()){activeJob=job;$('batchError').textContent='Procesando a '+job.recipient.name+'…';const token=await accessToken();if(!['unknown','sending'].includes(job.state)){const current=await loadPanel();if(!current)throw Error('No se pudo actualizar el sorteo. La lista se conserva.');if(current.anchor!==batchAnchor)throw Error('El sorteo cambió. Revisa la lista antes de continuar.');if(!current.salesOpen)throw Error('Las ventas se cerraron. La lista se conserva.');const preview=await api({action:'preview-award',requestId:job.id,recipient:job.recipient,anchor:batchAnchor},token);if(preview.awarded){job.state='done';job.winner=preview.winner;saveQueue();completed++;renderQueue();continue;}job.recipient={name:preview.name,cedula:preview.cedula,phone:preview.phone,bank:preview.bank};job.anchor=preview.anchor;}
job.state='sending';job.error='';saveQueue();renderQueue();let result;try{result=await api({action:'award',requestId:job.id,recipient:job.recipient,anchor:job.anchor},token)}catch(e){job.state=[400,409].includes(e.status)?'error':'unknown';job.error=e.message;saveQueue();renderQueue();throw e}if(!result.awarded){job.state='unknown';saveQueue();throw Error('No se pudo confirmar la entrega. Reintenta la lista.');}job.state='done';job.winner=result.winner;saveQueue();completed++;if(job.anchor==='vacio')batchAnchor=String(result.winner.registration_id);renderQueue();}
$('batchError').textContent='';$('batchConfirm').close();$('queueMessage').textContent='🎁 Lista completada: '+completed+(completed===1?' cartón':' cartones')+' entregado'+(completed===1?'':'s')+'. Ya puedes compartir el resumen de hoy.';toast('Ganadores registrados.');}catch(e){if(activeJob&&!['done','sending','unknown'].includes(activeJob.state)){activeJob.state='error';activeJob.error=e.message;try{saveQueue()}catch{}}$('batchError').textContent=needLogin(e);$('queueMessage').textContent='La lista se detuvo. '+completed+' entrega'+(completed===1?'':'s')+' confirmada'+(completed===1?'':'s')+' en este intento. Los demás registros se conservan. '+e.message;}finally{awarding=false;queueBusy(false);renderQueue();loadPanel()}};
renderQueue();


let priorWinTimer,priorWinSequence=0;
function normalizedCedula(value){return String(value||'').replace(/\D/g,'').replace(/^0+/,'')}
function priorWinText(w){const date=new Date(w.dia+'T12:00:00-04:00').toLocaleDateString('es-VE',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Caracas'});return '⚠️ Esta persona ya ganó esta semana: el '+date+' recibió el cartón '+w.carton+'. Solo puede ganar una vez por semana.';}
function clearPriorWinner(){priorWinSequence++;clearTimeout(priorWinTimer);$('winnerPriorWin').hidden=true;$('winnerPriorWin').textContent='';$('winnerCedula').setCustomValidity('');$('winnerCedula').removeAttribute('aria-invalid');$('winnerCedula').style.borderColor='';}
async function checkPriorWinner(force=false){const cedula=normalizedCedula($('winnerCedula').value);if(cedula.length<5||sessionStorage.getItem('ba75-dinamicas-pending'))return true;if(!auth){if(force){$('winnerPriorWin').hidden=false;$('winnerPriorWin').textContent='Ingresa como administrador para comprobar si esta cédula ya ganó esta semana.';$('login').showModal();}return !force;}const sequence=++priorWinSequence;try{const token=await accessToken();const data=await api({action:'dashboard'},token);if(sequence!==priorWinSequence||cedula!==normalizedCedula($('winnerCedula').value))return false;if(!Array.isArray(data.winners))throw Error('No se pudo comprobar el historial semanal.');const winner=data.winners.find(w=>normalizedCedula(w.cedula)===cedula);if(winner){const message=priorWinText(winner);$('winnerPriorWin').textContent=message;$('winnerPriorWin').hidden=false;$('winnerCedula').setAttribute('aria-invalid','true');$('winnerCedula').style.borderColor='#bd3c3c';$('winnerCedula').setCustomValidity(message);return false;}clearPriorWinner();return true;}catch(e){if(sequence===priorWinSequence){$('winnerPriorWin').textContent='No se pudo comprobar si esta persona ya ganó. Intenta de nuevo antes de agregarla.';$('winnerPriorWin').hidden=false;}return false;}}
$('winnerCedula').addEventListener('input',()=>{clearPriorWinner();if(normalizedCedula($('winnerCedula').value).length>=5)priorWinTimer=setTimeout(()=>checkPriorWinner(),700)});
$('winnerCedula').addEventListener('blur',()=>{clearTimeout(priorWinTimer);checkPriorWinner()});
$('winnerForm').addEventListener('reset',clearPriorWinner);

