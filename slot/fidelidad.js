import {fidelidadApi,hasSession} from './auth.js?v=1.0.20-fidelidad';
import {spinCylinder} from './spin-cylinder.js?v=1.0.19';
import {celebrate} from './confetti.js?v=1.0.19';

const $=id=>document.getElementById(id);
const PENDING='andino_fidelidad_giro_pendiente_v1';
let fecha='',participants=[],winners=[],busy=false,ready=false,stopConfetti=null;
const label=(name)=>String(name||'').trim();

function sabadoCaracas(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Caracas',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 const d=new Date(Date.UTC(+v.year,+v.month-1,+v.day));
 const day=d.getUTCDay(),delta=day===0?-1:6-day;
 d.setUTCDate(d.getUTCDate()+delta);
 return d.toISOString().slice(0,10);
}
function weekLabel(sabado){
 const sat=new Date(sabado+'T12:00:00Z'),mon=new Date(sat);
 mon.setUTCDate(mon.getUTCDate()-5);
 const f=d=>d.toLocaleDateString('es-VE',{timeZone:'UTC',day:'2-digit',month:'short'});
 return f(mon)+' – '+f(sat)+' de '+sat.getUTCFullYear();
}
function status(message){$('loyaltyStatus').textContent=message;}
function setBusy(value){
 busy=value;
 $('verify').disabled=value;
 $('spin').disabled=value||!ready||winners.length>=participants.length;
 $('prize').disabled=value;
 $('duration').disabled=value;
}
function escaped(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function render(){
 const used=new Set(winners.map(w=>String(w.ticket)));
 $('eligibleCount').textContent=ready?String(participants.length):'—';
 $('winnerCount').textContent=String(winners.length);
 $('remaining').textContent=ready?(participants.length-winners.length)+' personas disponibles':'—';
 $('participants').innerHTML=participants.map(p=>'<div class="'+(used.has(String(p.ticket))?'won':'')+'"><span>'+
  escaped(p.name)+'</span><b>Cartón '+escaped(p.ticket)+'</b></div>').join('');
 $('winners').innerHTML=winners.length?winners.map((w,i)=>'<article><small>#'+(i+1)+'</small><b>'+
  escaped(w.name)+'</b><span>🎟️ Cartón '+escaped(w.ticket)+'</span><span>🏆 '+escaped(w.prize)+'</span></article>').join(''):
  '<p>Todavía no se ha sorteado ningún premio de Fidelidad esta semana.</p>';
 $('copy').disabled=!winners.length;
 $('spin').disabled=busy||!ready||winners.length>=participants.length;
 if(winners.length===participants.length&&ready)status('Ya se eligieron todas las personas elegibles esta semana.');
}
async function verificar(){
 if(busy)return;
 setBusy(true);status('Verificando los seis días y los ganadores publicados…');
 try{
  if(!hasSession())throw new Error('Abre primero el tragamonedas e ingresa con contraseña y código del correo. Luego vuelve a Fidelidad.');
  const result=await fidelidadApi('estado',{sabado:fecha});
  if(!result.ready){
   ready=false;participants=[];winners=[];
   $('loyaltyContent').hidden=true;$('blocked').hidden=false;
   const missing=Array.isArray(result.faltan)&&result.faltan.length?
    ' Días pendientes: '+result.faltan.join(', ')+'.':'';
   $('blockedReason').textContent=(result.error||'La información todavía no está completa.')+missing;
   status('🔒 Fidelidad permanece bloqueada.');
  }else{
   participants=result.participants||[];winners=result.winners||[];ready=true;
   $('blocked').hidden=true;$('loyaltyContent').hidden=false;
   const draft=readPending();
   if(draft&&winners.some(w=>w.drawId===draft.drawId))sessionStorage.removeItem(PENDING);
   status('✅ Los seis días están registrados. Sin ganadores de rondas ni consolación entre los participantes.');
  }
  render();
 }catch(e){
  ready=false;participants=[];winners=[];
  $('loyaltyContent').hidden=true;$('blocked').hidden=false;
  $('blockedReason').textContent=e.message;
  status('🔒 No se pudo verificar la lista. No se autoriza ningún giro.');
 }finally{setBusy(false);}
}
function readPending(){
 try{
  const p=JSON.parse(sessionStorage.getItem(PENDING)||'null');
  if(p?.sabado===fecha&&/^[0-9a-f-]{36}$/i.test(p.drawId)&&typeof p.premio==='string')return p;
  sessionStorage.removeItem(PENDING);
 }catch{sessionStorage.removeItem(PENDING);}
 return null;
}
async function girar(){
 if(busy||!ready||winners.length>=participants.length)return;
 const prize=label($('prize').value);
 if(!prize||prize.length>60){status('Escribe un premio válido de máximo 60 caracteres.');return;}
 if(!confirm('¿Sortear un nuevo ganador de Fidelidad? Esta acción queda guardada y no se puede repetir para la misma persona.'))return;
 setBusy(true);
 let ticketWinner=null;
 try{
  const pending=readPending()||{sabado:fecha,drawId:crypto.randomUUID(),premio:prize};
  sessionStorage.setItem(PENDING,JSON.stringify(pending));
  status('El servidor está eligiendo y guardando al ganador…');
  const result=await fidelidadApi('girar',{sabado:fecha,drawId:pending.drawId,premio:pending.premio});
  ticketWinner=result.winner;
  const selected=participants.find(x=>String(x.ticket)===String(ticketWinner.ticket))||
   {name:ticketWinner.name,ticket:String(ticketWinner.ticket),personId:'server-winner'};
  const already=new Set(winners.map(w=>String(w.ticket)));
  const pool=participants.filter(x=>!already.has(String(x.ticket)));
  const ms=Number($('duration').value)*1000;
  $('slotName').textContent='Girando…';$('slotTicket').textContent='¡Mucha suerte!';
  $('slotPrize').textContent=pending.premio;
  status('🎰 Girando el tragamonedas de Fidelidad…');
  try{
   await spinCylinder($('loyaltyReel'),{participants:pool,winner:selected,
    prize:pending.premio,duration:ms,
    reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches});
  }catch{ /* Si la animación falla, el resultado del servidor prevalece. */ }
  $('slotName').textContent=ticketWinner.name;
  $('slotTicket').textContent='CARTÓN '+ticketWinner.ticket;
  $('slotPrize').textContent=ticketWinner.prize;
  stopConfetti?.();
  stopConfetti=celebrate($('celebration'),{
   reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches});
  sessionStorage.removeItem(PENDING);
  status('🏆 Ganador confirmado y guardado. ¡Felicitaciones!');
  // Actualiza historial y lista desde el servidor, incluso si otro teléfono giró.
  const state=await fidelidadApi('estado',{sabado:fecha});
  if(state.ready){participants=state.participants||participants;winners=state.winners||winners;}
 }catch(e){
  if(ticketWinner&&!winners.some(w=>w.drawId===ticketWinner.drawId))winners.push(ticketWinner);
  status('⚠️ '+e.message+' Si el servidor pudo guardar el giro, al reintentar se recuperará el mismo ganador.');
  // No borramos el identificador pendiente: el reintento es idempotente.
 }finally{
  render();setBusy(false);
 }
}
async function copiar(){
 if(!winners.length)return;
 const message='💜🎰 GANADORES DE FIDELIDAD · BINGO ANDINO 75\n'+
  'Semana del '+weekLabel(fecha)+'\n\n'+winners.map((w,i)=>
   (i+1)+'. '+w.name+'\n🎟️ Cartón '+w.ticket+'\n🏆 '+w.prize).join('\n\n')+
   '\n\n¡Gracias por acompañarnos los seis días, familia binguera! 💜';
 try{await navigator.clipboard.writeText(message);status('✅ Anuncio de Fidelidad copiado.');}
 catch{status('No se pudo copiar automáticamente. Revisa el permiso del portapapeles.');}
}
fecha=sabadoCaracas();
$('weekRange').textContent=weekLabel(fecha);
$('verify').addEventListener('click',verificar);
$('spin').addEventListener('click',girar);
$('copy').addEventListener('click',copiar);
verificar();
