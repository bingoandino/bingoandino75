/* ANDY Marketing Pro · planificador local sin API de pago. */
(function(root,factory){
 const app=factory();
 if(typeof module==="object"&&module.exports)module.exports=app;
 else{root.AndyMarketingPro=app;if(typeof document!=="undefined")app.init();}
})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 const KEY="bingo_andy_marketing_pro_v1";
 const GOALS={
  ventas:{label:"Aumentar compras",tip:"Prioriza instrucciones claras para comprar, preguntas frecuentes y enlace oficial.",ending:"Consulta cómo participar en bingoandino75.com."},
  alcance:{label:"Alcance y seguidores",tip:"Usa reels cortos del bombo, historias informativas y preguntas a la comunidad.",ending:"Comparte este contenido con la familia binguera."},
  fidelidad:{label:"Fidelización",tip:"Prioriza agradecimientos, tutoriales para volver y participación de la comunidad.",ending:"Gracias por acompañarnos cada semana, familia binguera. 💜"}
 };
 const DAYS={
  1:{day:"Lunes",theme:"Inicio de semana",format:"story",channel:"Instagram · Historias",time:"11:00",title:"¡Comienza una nueva semana binguera!",body:"La emoción del bombo real está de vuelta",caption:"💜🎱 ¡Feliz inicio de semana, familia binguera! Volvemos a compartir otra jornada con nuestro bombo real y bolitas manuales. Consulta los cartones disponibles y el horario del sorteo en bingoandino75.com.",cta:"Consulta los cartones"},
  2:{day:"Martes",theme:"Guía para nuevos compradores",format:"reel",channel:"Instagram · Reel",time:"12:00",title:"Comprar tus cartones es sencillo",body:"Conoce los pasos para participar",caption:"📲 ¿Es tu primera vez en Bingo Andino 75? Entra a bingoandino75.com, selecciona tus cartones y sigue las instrucciones de la página. Puedes consultar la verificación desde el mismo sitio. No compartas códigos de seguridad.",cta:"Aprende a comprar"},
  3:{day:"Miércoles",theme:"Confianza",format:"reel",channel:"Instagram · Reel",time:"14:00",title:"Así funciona nuestro bombo real",body:"Bolitas extraídas manualmente en vivo",caption:"🎱 En Bingo Andino 75 usamos un bombo real y las bolitas se extraen manualmente durante nuestras transmisiones. Conoce cómo se desarrolla el sorteo. 💜",cta:"Conoce nuestro bingo"},
  4:{day:"Jueves",theme:"Atención y soporte",format:"story",channel:"Instagram · Historias",time:"11:00",title:"¿Ya verificaste tus cartones?",body:"Consulta tu compra desde la web",caption:"✅ Consulta tu compra en la opción «Verificar tu compra» de bingoandino75.com. Las verificaciones se realizan en horario de atención. Si necesitas ayuda, escríbenos por los canales oficiales.",cta:"Verifica tu compra"},
  5:{day:"Viernes",theme:"Comunidad",format:"post",channel:"Instagram · Publicación",time:"16:00",title:"¡Qué bonita es nuestra familia binguera!",body:"Compartimos la emoción de cada jornada",caption:"✨ Cada jornada es especial gracias a nuestra familia binguera. ¿Qué es lo que más disfrutas de las transmisiones? Te leemos en los comentarios. 💜🎱",cta:"Te leemos"},
  6:{day:"Sábado",theme:"Especial de sábado",format:"story",channel:"Instagram · Historias",time:"12:00",title:"Sábado especial en Bingo Andino 75",body:"Un encuentro para disfrutar en familia",caption:"💜✨ ¡Feliz sábado, familia binguera! Consulta la programación y los cartones disponibles de hoy en bingoandino75.com. Nuestro bombo real nos acompaña en otra jornada especial.",cta:"Consulta el sorteo de hoy"}
 };
 const iso=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T12:00:00Z"))&&new Date(s+"T12:00:00Z").toISOString().slice(0,10)===s;
 const asNumber=(x,max=100000000)=>x===null||x===undefined||x===""?null:Number.isSafeInteger(Number(x))&&Number(x)>=0&&Number(x)<=max?Number(x):null;
 function todayVE(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Caracas",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return m.year+"-"+m.month+"-"+m.day;}
 function mondayOf(s){if(!iso(s))throw Error("Fecha inválida.");const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
 function comingDrawDates(s,count=6){if(!iso(s)||!Number.isInteger(count)||count<1||count>12)throw Error("Fecha inválida.");const d=new Date(s+"T12:00:00Z"),out=[];while(out.length<count){if(d.getUTCDay()!==0)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}return out;}
 function planFor(date,goal="ventas"){if(!iso(date)||!GOALS[goal])throw Error("Fecha u objetivo inválido.");const day=new Date(date+"T12:00:00Z").getUTCDay();if(day===0)throw Error("Sin sorteo habitual el domingo.");const p=DAYS[day];return {...p,date,goal,goalLabel:GOALS[goal].label,caption:p.caption+"\n\n"+GOALS[goal].ending+"\n🌐 bingoandino75.com #BingoAndino75"};}
 function analyze(records,week){const start=mondayOf(week),d=new Date(start+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+7);const end=d.toISOString().slice(0,10);
  const rows=(Array.isArray(records)?records:[]).filter(r=>r&&iso(r.date)&&r.date>=start&&r.date<end).sort((a,b)=>a.date.localeCompare(b.date));
  const totals={},covered={};for(const k of ["cards","purchases","inquiries","reach"]){covered[k]=rows.some(r=>r[k]!==null&&r[k]!==undefined);totals[k]=rows.reduce((a,r)=>a+(asNumber(r[k])||0),0);}
  const ranked=rows.filter(r=>asNumber(r.cards)!==null).sort((a,b)=>a.cards-b.cards);
  return{start,rows,totals,covered,days:rows.length,lowest:ranked.length>=2?ranked[0]:null,highest:ranked.length>=2?ranked[ranked.length-1]:null};
 }
 function init(){
  const root=document.getElementById("andy-marketing-pro");if(!root)return;
  const $=id=>root.querySelector("#andy-mp-"+id);
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const state={goal:"ventas",target:null,week:todayVE(),records:[],tasks:[]};
  function notice(t,bad=false){$("status").textContent=t;$("status").dataset.error=bad?"true":"false";}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{notice("No se pudieron guardar los datos. Exporta un respaldo.",true);return false;}}
  function restore(){try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(!s||typeof s!=="object")return;
    state.goal=GOALS[s.goal]?s.goal:"ventas";state.target=asNumber(s.target,1000000);state.week=iso(s.week)?s.week:todayVE();
    state.records=Array.isArray(s.records)?s.records.filter(r=>r&&iso(r.date)&&["cards","purchases","inquiries","reach"].every(k=>r[k]===null||asNumber(r[k])!==null)).slice(-90):[];
    state.tasks=Array.isArray(s.tasks)?s.tasks.filter(t=>t&&typeof t.id==="string"&&typeof t.title==="string"&&t.title.length<=90&&iso(t.date)&&typeof t.channel==="string"&&t.channel.length<=40&&["pendiente","en_progreso","hecho"].includes(t.status)).slice(-60):[];
   }catch{}}
  function pretty(date){return new Intl.DateTimeFormat("es-VE",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));}
  function addTask(title,date,channel){if(state.tasks.length>=60){notice("Máximo de 60 tareas. Completa o elimina alguna.",true);return;}
   state.tasks.push({id:"t"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:String(title).slice(0,90),date,channel:String(channel).slice(0,40),status:"pendiente"});
   if(save()){renderTasks();notice("Tarea agregada. No se ha publicado nada en redes.");}}
  function sendEditor(p){
   if(!document.getElementById("andy-guardar")){notice("El editor de contenidos todavía no está disponible.",true);return;}
   document.getElementById("andy-nuevo")?.click();
   const fields={"andy-formato":p.format,"andy-tema":p.format==="reel"?"bombo":"bienvenida","andy-titulo":p.title,
    "andy-mensaje":p.body,"andy-pie":p.caption,"andy-cta":p.cta,"andy-fecha":p.date,"andy-hora":p.time,
    "andy-guion":p.format==="reel"?"Toma 1: muestra el bombo real.\nToma 2: explica el tema con subtítulos.\nToma 3: termina con bingoandino75.com. Nunca muestres datos personales.":""};
   for(const [id,value]of Object.entries(fields)){const e=document.getElementById(id);if(e){e.value=value;e.dispatchEvent(new Event("input",{bubbles:true}));}}
   document.getElementById("andy-editor-title")?.scrollIntoView({behavior:"smooth",block:"start"});
   notice("Propuesta enviada al editor. Revisa el contenido y pulsa «Guardar borrador».");
  }
  function renderPlan(){
   const list=$("plan");list.replaceChildren();
   for(const date of comingDrawDates(todayVE(),6)){
    const p=planFor(date,state.goal),card=node("article","andy-mp-day-card"),top=node("div","andy-mp-day-top");
    top.append(node("strong","",p.day+" · "+pretty(date)),node("small","",p.theme));
    card.append(top,node("h5","",p.title),node("p","",p.body),node("small","",p.channel+" · "+p.time+" (hora sugerida)"));
    const actions=node("div","andy-mp-actions");
    const edit=node("button","andy-mp-btn","Preparar texto");edit.type="button";edit.addEventListener("click",()=>sendEditor(p));
    const task=node("button","andy-mp-btn secondary","Agregar tarea");task.type="button";task.addEventListener("click",()=>addTask(p.title,date,p.channel));
    actions.append(edit,task);card.append(actions);list.append(card);
   }
   $("goal-tip").textContent=GOALS[state.goal].tip;
  }
  function renderStats(){
   const a=analyze(state.records,$("week").value||todayVE());
   $("week-title").textContent="Semana del "+pretty(a.start)+" · "+a.days+" día(s) registrado(s)";
   for(const k of ["cards","purchases","inquiries","reach"])$(k+"-total").textContent=a.covered[k]?a.totals[k].toLocaleString("es-VE"):"—";
   $("target-progress").textContent=state.target===null?"Define una meta semanal de cartones para comparar resultados.":
    "Meta: "+state.target.toLocaleString("es-VE")+" cartones · "+(a.covered.cards?a.totals.cards.toLocaleString("es-VE")+" registrados ("+(state.target?Math.round(a.totals.cards/state.target*100):0)+"%)":"faltan datos de ventas");
   const insights=$("insights");insights.replaceChildren();
   insights.append(node("p","",a.days<2?"Introduce datos de al menos dos días para comparar su desempeño.":"Comparación basada únicamente en los datos que registraste."));
   if(a.lowest&&a.highest)insights.append(node("p","","Menos cartones: "+pretty(a.lowest.date)+" ("+a.lowest.cards+"). Más cartones: "+pretty(a.highest.date)+" ("+a.highest.cards+")."));
   const list=$("records");list.replaceChildren();
   for(const r of [...a.rows].reverse()){
    const row=node("div","andy-mp-record");
    row.append(node("strong","",pretty(r.date)),node("span","","Cartones: "+(r.cards??"—")+" · Compras: "+(r.purchases??"—")+" · Consultas: "+(r.inquiries??"—")+" · Alcance: "+(r.reach??"—")));
    const edit=node("button","andy-mp-mini","Editar");edit.type="button";edit.addEventListener("click",()=>{$("date").value=r.date;for(const k of ["cards","purchases","inquiries","reach"])$(k).value=r[k]===null?"":String(r[k]);notice("Modifica los datos y vuelve a pulsar Guardar resultados.");});
    row.append(edit);list.append(row);
   }
   if(!a.rows.length)list.append(node("p","andy-mp-empty","Aún no has registrado datos para esta semana."));
  }
  function saveRecord(){
   const date=$("date").value;if(!iso(date)){notice("Selecciona una fecha válida.",true);return;}
   const row={date};let any=false;
   for(const k of ["cards","purchases","inquiries","reach"]){const raw=$(k).value.trim();
    if(raw!==""&&!/^\d+$/.test(raw)){notice("Introduce solo números enteros no negativos.",true);return;}
    row[k]=raw===""?null:asNumber(raw);
    if(raw!==""&&row[k]===null){notice("Revisa los montos: hay un valor inválido o demasiado alto.",true);return;}
    if(row[k]!==null)any=true;
   }
   if(!any){notice("Introduce al menos una cifra para este día.",true);return;}
   state.records=state.records.filter(r=>r.date!==date);state.records.push(row);
   state.records.sort((a,b)=>a.date.localeCompare(b.date));state.records=state.records.slice(-90);
   state.week=date;$("week").value=date;
   if(save()){renderStats();notice("Resultados guardados manualmente en este dispositivo.");}
  }
  function renderTasks(){
   const box=$("tasks");box.replaceChildren();
   const items=[...state.tasks].sort((a,b)=>a.date.localeCompare(b.date));
   $("tasks-count").textContent=items.length+" tareas · "+items.filter(t=>t.status==="hecho").length+" terminadas";
   if(!items.length)box.append(node("p","andy-mp-empty","Agrega tareas desde el plan o crea una propia."));
   for(const t of items){
    const row=node("div","andy-mp-task");row.append(node("strong","",t.title),node("small","",pretty(t.date)+" · "+t.channel));
    const actions=node("div","andy-mp-actions");
    const toggle=node("button","andy-mp-btn secondary",t.status==="pendiente"?"Pendiente → en curso":t.status==="en_progreso"?"En curso → hecho":"Hecho ✓ → pendiente");
    toggle.type="button";toggle.addEventListener("click",()=>{t.status=t.status==="pendiente"?"en_progreso":t.status==="en_progreso"?"hecho":"pendiente";if(save())renderTasks();});
    const del=node("button","andy-mp-btn plain","Quitar");del.type="button";del.addEventListener("click",()=>{state.tasks=state.tasks.filter(x=>x.id!==t.id);if(save())renderTasks();});
    actions.append(toggle,del);row.append(actions);box.append(row);
   }
  }
  function summary(){
   const a=analyze(state.records,$("week").value||todayVE());
   const fields=["Cartones vendidos: "+(a.covered.cards?a.totals.cards:"Sin dato"),"Compras registradas: "+(a.covered.purchases?a.totals.purchases:"Sin dato"),
    "Consultas recibidas: "+(a.covered.inquiries?a.totals.inquiries:"Sin dato"),"Alcance: "+(a.covered.reach?a.totals.reach:"Sin dato")];
   return ["ANDY MARKETING PRO · INFORME MANUAL","Semana del "+pretty(a.start),...fields,
    "Objetivo: "+GOALS[state.goal].label,"Días registrados: "+a.days,"Tareas: "+state.tasks.length+" · completadas: "+state.tasks.filter(t=>t.status==="hecho").length,
    "Datos introducidos manualmente; no representan estadísticas sincronizadas con Instagram o el sistema de compras."].join("\n");
  }
  function exportBackup(){
   const blob=new Blob([JSON.stringify({version:1,source:"ANDY Marketing Pro",date:new Date().toISOString(),...state},null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="andy-marketing-pro-"+todayVE()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);notice("Respaldo JSON descargado.");
  }
  restore();$("goal").value=state.goal;$("target").value=state.target===null?"":String(state.target);
  $("week").value=state.week;$("date").value=todayVE();$("task-date").value=todayVE();
  $("goal").addEventListener("change",()=>{state.goal=GOALS[$("goal").value]?$("goal").value:"ventas";save();renderPlan();notice("Objetivo actualizado.");});
  $("target").addEventListener("change",()=>{const raw=$("target").value.trim();if(raw&&!/^\d+$/.test(raw)){notice("Escribe una meta válida.",true);return;}const x=raw===""?null:asNumber(raw,1000000);if(raw&&x===null){notice("Meta no válida.",true);return;}state.target=x;save();renderStats();});
  $("week").addEventListener("change",()=>{if(!iso($("week").value)){notice("Fecha inválida.",true);return;}state.week=$("week").value;save();renderStats();});
  $("record-save").addEventListener("click",saveRecord);
  $("task-add").addEventListener("click",()=>{const title=$("task-name").value.trim(),date=$("task-date").value;if(title.length<4||title.length>90||!iso(date)){notice("Escribe una tarea de 4 a 90 caracteres y una fecha.",true);return;}addTask(title,date,$("task-channel").value);$("task-name").value="";});
  $("plan-refresh").addEventListener("click",()=>{renderPlan();notice("Plan de los próximos seis días actualizado.");});
  $("export").addEventListener("click",exportBackup);
  $("report-copy").addEventListener("click",async()=>{const txt=summary();try{await navigator.clipboard.writeText(txt);notice("Informe copiado.");}catch{const a=$("report-text");a.hidden=false;a.value=txt;a.focus();a.select();notice("Selecciona y copia el informe que aparece debajo.",true);}});
  renderPlan();renderStats();renderTasks();notice("ANDY Marketing Pro listo. Sin API de pago ni publicación automática.");
 }
 return Object.freeze({todayVE,mondayOf,comingDrawDates,planFor,analyze,init});
});
