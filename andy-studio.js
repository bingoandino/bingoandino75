/* ANDY Studio v1 - Editorial local, sin publicar en Instagram ni modificar compras. */
(function () {
  "use strict";
  const root = document.getElementById("tab-andy-estudio");
  if (!root) return;
  const KEY = "bingo_andino_andy_borradores_v1";
  const MAX_DRAFTS = 100;
  const el = (id) => root.querySelector("#" + id);
  const fields = {
    format: "andy-formato", theme: "andy-tema", title: "andy-titulo",
    body: "andy-mensaje", caption: "andy-pie", cta: "andy-cta",
    script: "andy-guion", date: "andy-fecha", time: "andy-hora"
  };
  const ideas = {
    bienvenida: {
      title: "Familia binguera, ¡bienvenidos!",
      body: "Vivamos otra jornada juntos",
      caption: "💜 ¡Hola, familia binguera! Qué alegría encontrarnos una vez más. 🎱",
      script: "Escena 1: logo y luces doradas.\nEscena 2: bombo real y bolitas.\nEscena 3: mensaje de bienvenida.",
      cta: "Nos vemos en vivo"
    },
    bombo: {
      title: "Así vivimos nuestro bingo",
      body: "Bolitas manuales · Bombo real",
      caption: "🎱 En Bingo Andino 75 las bolitas se extraen manualmente de un bombo real. ¡Conoce cómo vivimos cada jornada!",
      script: "Escena 1: detalle del bombo real.\nEscena 2: extracción manual de bolitas.\nEscena 3: cierre con la identidad del bingo.",
      cta: "Conoce nuestro juego"
    },
    tutorial: {
      title: "¿Cómo verifico mi compra?",
      body: "Consulta tus cartones desde nuestra web",
      caption: "📲 En bingoandino75.com encontrarás la opción «Verificar tu compra» para consultar tus cartones cuando estén aprobados.",
      script: "Escena 1: pantalla de inicio.\nEscena 2: tocar «Verificar tu compra».\nEscena 3: introducir cédula en la página, sin mostrar datos reales.",
      cta: "Consulta en la página"
    },
    seguridad: {
      title: "Tu seguridad es primero",
      body: "No compartas códigos personales",
      caption: "🔐 Recordatorio importante: nuestro equipo no te llama para solicitar códigos de seguridad. Comunícate únicamente por canales oficiales.",
      script: "Escena 1: escudo de seguridad.\nEscena 2: texto «Nunca compartas códigos».\nEscena 3: canales oficiales.",
      cta: "Cuida tus datos"
    },
    comunidad: {
      title: "Gracias, familia binguera",
      body: "Ustedes hacen especial cada jornada",
      caption: "✨ Gracias por acompañarnos y ser parte de esta gran familia. Sus mensajes y su cariño nos motivan cada día. 💜",
      script: "Escena 1: mensajes generales de agradecimiento, sin datos personales.\nEscena 2: logo y confeti dorado.\nEscena 3: cierre cariñoso.",
      cta: "¡Gracias por estar!"
    },
    vivo: {
      title: "¡Hoy nos encontramos en vivo!",
      body: "Acompáñanos en nuestro canal oficial",
      caption: "🎱 Nuestra transmisión en vivo está disponible en el canal oficial de YouTube de Bingo Andino 75. Consulta el horario confirmado de la jornada.",
      script: "Escena 1: entrada de luces.\nEscena 2: logo Bingo Andino 75.\nEscena 3: invitar a consultar el enlace oficial de YouTube.",
      cta: "Mira nuestro canal"
    }
  };
  let drafts = [];
  let editingId = null;

  function todayVE() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const bits = {};
    parts.forEach((p) => { bits[p.type] = p.value; });
    return bits.year + "-" + bits.month + "-" + bits.day;
  }
  function nextWorkDates(count) {
    const dates = [];
    const base = new Date(todayVE() + "T12:00:00Z");
    for (let n = 0; dates.length < count && n < 15; n++) {
      const d = new Date(base.getTime() + n * 86400000);
      if (d.getUTCDay() !== 0) dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }
  function status(msg, isError = false) {
    const node = el("andy-estado");
    node.textContent = msg;
    node.dataset.level = isError ? "error" : "normal";
  }
  function safeStorageRead() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(list)) return [];
      return list.filter((v) => v && typeof v === "object" && typeof v.id === "string")
        .slice(0, MAX_DRAFTS).map((v) => ({
          id: v.id.slice(0, 80), format: ["post", "story", "reel"].includes(v.format) ? v.format : "post",
          theme: Object.hasOwn(ideas, v.theme) ? v.theme : "bienvenida",
          title: String(v.title || "").slice(0, 75), body: String(v.body || "").slice(0, 180),
          caption: String(v.caption || "").slice(0, 1100), cta: String(v.cta || "").slice(0, 70),
          script: String(v.script || "").slice(0, 1800),
          date: /^\d{4}-\d{2}-\d{2}$/.test(v.date || "") ? v.date : "",
          time: /^\d{2}:\d{2}$/.test(v.time || "") ? v.time : "",
          state: ["borrador", "revision", "aprobado"].includes(v.state) ? v.state : "borrador",
          updatedAt: String(v.updatedAt || "").slice(0, 30)
        }));
    } catch (_) { return []; }
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(drafts));
      return true;
    } catch (_) {
      status("No se pudo guardar en este dispositivo. Exporta un respaldo o libera espacio.", true);
      return false;
    }
  }
  function values() {
    const output = {};
    Object.keys(fields).forEach((k) => { output[k] = String(el(fields[k]).value || "").trim(); });
    return output;
  }
  function fill(data) {
    Object.keys(fields).forEach((k) => { el(fields[k]).value = data[k] || ""; });
    renderPreview();
  }
  function sample() {
    const theme = el(fields.theme).value;
    const idea = ideas[theme] || ideas.bienvenida;
    fill({
      ...values(), ...idea,
      date: el(fields.date).value || todayVE(),
      time: el(fields.time).value || "18:00"
    });
    status("Plantilla cargada. Personaliza los textos y revísalos antes de aprobar.");
  }
  function newDraft() {
    editingId = null;
    fill({format:"post", theme:"bienvenida", title:"", body:"", caption:"", cta:"", script:"", date:todayVE(), time:"18:00"});
    el("andy-guardar").textContent = "Guardar borrador";
    el("andy-aprobar").disabled = true;
    el("andy-revision").disabled = true;
    el("andy-eliminar").disabled = true;
    status("Nuevo borrador. Selecciona una idea o escribe tu contenido.");
  }
  function toSaved() {
    const item = values();
    if (!item.title || !item.caption) {
      status("Escribe un título y un texto para Instagram antes de guardar.", true);
      return false;
    }
    if (item.title.length > 75 || item.caption.length > 1100 || item.body.length > 180 || item.script.length > 1800) {
      status("Uno de los textos supera el tamaño permitido.", true);
      return false;
    }
    const old = drafts.find((d) => d.id === editingId);
    const changed = !!old && Object.keys(fields).some((key) => old[key] !== item[key]);
    if (!old && drafts.length >= MAX_DRAFTS) {
      status("Llegaste al máximo de 100 borradores locales; exporta un respaldo.", true);
      return false;
    }
    const doc = {
      ...item,
      id: old ? old.id : (window.crypto?.randomUUID?.() || ("andy-" + Date.now() + "-" + drafts.length)),
      // Una pieza aprobada pierde la aprobación si se modifica cualquier campo.
      state: old && old.state === "aprobado" && changed ? "revision" : old ? old.state : "borrador",
      updatedAt: new Date().toISOString()
    };
    if (old) drafts = drafts.map((d) => d.id === doc.id ? doc : d);
    else drafts.push(doc);
    if (!persist()) return false;
    editingId = doc.id;
    el("andy-guardar").textContent = "Guardar cambios";
    el("andy-aprobar").disabled = false;
    el("andy-revision").disabled = false;
    el("andy-eliminar").disabled = false;
    updateCounts(); renderList(); renderPreview();
    status("Borrador guardado en este navegador. No se ha publicado en Instagram.");
    return true;
  }
  function setState(next) {
    if (!editingId) { status("Guarda primero el borrador.", true); return; }
    // Guardar primero los cambios del editor; nunca aprobar una versión antigua.
    if (!toSaved()) return;
    const doc = drafts.find((d) => d.id === editingId);
    if (!doc) return;
    const prior = doc.state;
    doc.state = next; doc.updatedAt = new Date().toISOString();
    if (!persist()) { doc.state = prior; return; }
    renderList(); updateCounts(); renderPreview();
    status(next === "aprobado" ? "Contenido aprobado INTERNAMENTE. No se ha enviado a Instagram." : "Borrador enviado a revisión interna.");
  }
  function edit(id) {
    const doc = drafts.find((v) => v.id === id);
    if (!doc) return;
    editingId = doc.id;
    fill(doc);
    el("andy-guardar").textContent = "Guardar cambios";
    el("andy-aprobar").disabled = false;
    el("andy-revision").disabled = false;
    el("andy-eliminar").disabled = false;
    renderList();
    status("Editando: " + doc.title + ". Los cambios se guardan solo al pulsar Guardar.");
  }
  function remove() {
    if (!editingId) return;
    const doc = drafts.find((v) => v.id === editingId);
    if (!doc || !window.confirm("¿Eliminar el borrador «" + doc.title + "» de este dispositivo?")) return;
    drafts = drafts.filter((v) => v.id !== editingId);
    if (!persist()) return;
    newDraft(); renderList(); updateCounts();
    status("Borrador eliminado.");
  }
  function prettyDate(date) {
    if (!date) return "Sin fecha";
    const d = new Date(date + "T12:00:00Z");
    if (Number.isNaN(d.getTime())) return "Sin fecha";
    return new Intl.DateTimeFormat("es-VE",{day:"numeric",month:"short",timeZone:"UTC"}).format(d);
  }
  function updateCounts() {
    el("andy-cantidad").textContent = String(drafts.length);
    el("andy-pendientes").textContent = String(drafts.filter((d)=>d.state === "revision").length);
    el("andy-aprobados").textContent = String(drafts.filter((d)=>d.state === "aprobado").length);
    el("andy-agendados").textContent = String(drafts.filter((d)=>!!d.date).length);
  }
  function renderList() {
    const container = el("andy-lista");
    container.replaceChildren();
    const filter = el("andy-filtro").value;
    const sorted = drafts.filter((d) => filter === "todos" || d.state === filter)
      .sort((a,b) => (a.date || "9999").localeCompare(b.date || "9999") ||
        (a.time || "").localeCompare(b.time || ""));
    if (!sorted.length) {
      const empty = document.createElement("p");
      empty.className="andy-empty";
      empty.textContent="Aquí aparecerán tus borradores de contenido.";
      container.append(empty);
      return;
    }
    sorted.forEach((d) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "andy-draft" + (d.id === editingId ? " is-selected" : "");
      item.dataset.id = d.id;
      const top = document.createElement("span"); top.className="andy-draft-top";
      const name = document.createElement("strong"); name.textContent=d.title || "Sin título";
      const state = document.createElement("span"); state.className="andy-state"; state.dataset.state=d.state;
      state.textContent=d.state === "aprobado" ? "Aprobado" : d.state === "revision" ? "En revisión" : "Borrador";
      top.append(name,state);
      const meta=document.createElement("small");
      meta.textContent=(d.format === "post" ? "Publicación" : d.format === "story" ? "Historia" : "Reel") +
        " · " + prettyDate(d.date) + (d.time ? " · " + d.time : "");
      item.append(top,meta);
      item.addEventListener("click",()=>edit(d.id));
      container.append(item);
    });
  }
  function buildWeek() {
    const suggestions = [
      ["post","bienvenida"],["story","seguridad"],["reel","bombo"],
      ["story","tutorial"],["post","comunidad"],["reel","vivo"]
    ];
    const dates = nextWorkDates(suggestions.length);
    const capacity = MAX_DRAFTS - drafts.length;
    if (capacity < suggestions.length) {
      status("No hay espacio para seis ideas. Exporta primero un respaldo.", true); return;
    }
    suggestions.forEach((pair,i)=>{
      const idea=ideas[pair[1]];
      drafts.push({
        id:window.crypto?.randomUUID?.() || ("andy-week-" + Date.now() + "-" + i),
        format:pair[0],theme:pair[1],...idea,
        date:dates[i],time:"18:00",state:"borrador",updatedAt:new Date().toISOString()
      });
    });
    if (!persist()) return;
    updateCounts();renderList();
    status("Seis IDEAS guardadas para revisión. Son fechas editoriales; ninguna publicación está programada en Instagram.");
  }
  function renderPreview() {
    const d=values();
    el("andy-vista").dataset.format=d.format;
    el("andy-prev-titulo").textContent=d.title || "TU PRÓXIMA PUBLICACIÓN";
    el("andy-prev-mensaje").textContent=d.body || "Un mensaje para la familia binguera";
    el("andy-prev-cta").textContent=d.cta || "BINGOANDINO75.COM";
    el("andy-prev-etiqueta").textContent=d.format==="story"?"HISTORIA 9:16":d.format==="reel"?"PORTADA REEL 9:16":"PUBLICACIÓN 1:1";
    el("andy-prev-pie").textContent=d.caption || "Tu texto de Instagram aparecerá aquí.";
    const doc = drafts.find((v)=>v.id===editingId);
    const dirty = !!doc && Object.keys(fields).some((key) => doc[key] !== d[key]);
    el("andy-prev-estado").textContent=dirty && doc?.state === "aprobado"?
      "CAMBIOS SIN APROBAR":doc?.state==="aprobado"?"APROBADO INTERNAMENTE":"BORRADOR · SIN PUBLICAR";
    el("andy-guion-grupo").hidden = d.format !== "reel";
    el("andy-descargar").textContent=d.format==="reel"?"Descargar portada PNG":"Descargar imagen PNG";
  }
  async function copyCaption() {
    const d=values();
    const text = d.caption + "\n\nBingo Andino 75 💜🎱\n#BingoAndino75";
    if (!d.caption) { status("Escribe primero el texto para Instagram.", true); return; }
    try {
      await navigator.clipboard.writeText(text);
      status("Texto copiado para revisar. No se ha publicado.");
    } catch (_) { status("No se pudo copiar automáticamente; selecciona el texto del campo.", true); }
  }
  function downloadBackup() {
    const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),drafts},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url;a.download="andy-borradores-respaldo.json";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    status("Respaldo descargado. Recuerda que los borradores no están sincronizados entre teléfonos.");
  }
  function roundRect(ctx,x,y,w,h,r) {
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  }
  function wrapped(ctx,text,maxWidth,maxLines) {
    const words=text.trim().split(/\s+/).filter(Boolean);
    const lines=[];
    let line="";
    words.forEach((word)=>{
      const attempt=line?line+" "+word:word;
      if (ctx.measureText(attempt).width>maxWidth && line) {
        lines.push(line);line=word;
      } else line=attempt;
    });
    if(line)lines.push(line);
    if(lines.length>maxLines){lines.length=maxLines;lines[maxLines-1]=lines[maxLines-1].replace(/[.,;:]*$/,"")+"…";}
    return lines;
  }
  function exportImage() {
    const d=values();
    if(!d.title){status("Primero escribe un título para exportar la imagen.",true);return;}
    const portrait=d.format!=="post";
    const w=1080,h=portrait?1920:1080;
    const canvas=document.createElement("canvas");
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d");
    if(!ctx){status("Este navegador no permite exportar la imagen.",true);return;}
    const bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,"#220831");bg.addColorStop(.55,"#4a1d5e");bg.addColorStop(1,"#170521");
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    // Golden halo, soft light and decorative mountains.
    const halo=ctx.createRadialGradient(w*.5,h*.32,20,w*.5,h*.32,w*.72);
    halo.addColorStop(0,"rgba(236,194,100,.28)");halo.addColorStop(1,"rgba(236,194,100,0)");
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#cfaa60";ctx.lineWidth=7;roundRect(ctx,30,30,w-60,h-60,36);ctx.stroke();
    for(let i=0;i<29;i++){
      const xx=(i*227+88)%w, yy=(i*373+84)%h;
      ctx.fillStyle=i%3===0?"#f9db91":"rgba(255,243,220,.55)";
      ctx.beginPath();ctx.arc(xx,yy,i%4===0?5:2.5,0,Math.PI*2);ctx.fill();
    }
    const mountainY=h*.77;
    ctx.fillStyle="#321043";
    ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,mountainY+80);ctx.lineTo(w*.17,mountainY-100);ctx.lineTo(w*.31,mountainY+5);ctx.lineTo(w*.55,mountainY-200);ctx.lineTo(w*.76,mountainY+20);ctx.lineTo(w,mountainY-130);ctx.lineTo(w,h);ctx.closePath();ctx.fill();
    ctx.fillStyle="#200829";
    ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,mountainY+120);ctx.lineTo(w*.23,mountainY+40);ctx.lineTo(w*.42,mountainY+130);ctx.lineTo(w*.67,mountainY-50);ctx.lineTo(w,h*.85);ctx.lineTo(w,h);ctx.closePath();ctx.fill();

    ctx.textAlign="center";
    ctx.fillStyle="#f8e5bc";ctx.font="bold 39px system-ui, sans-serif";
    ctx.fillText("BINGO ANDINO 75",w/2,portrait?245:155);
    ctx.strokeStyle="#d6ab5a";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(200,portrait?280:188);ctx.lineTo(w-200,portrait?280:188);ctx.stroke();
    ctx.font="bold 28px system-ui, sans-serif";ctx.fillStyle="#e8c87e";
    ctx.fillText("FAMILIA BINGUERA",w/2,portrait?335:245);

    const headY=portrait?660:430;
    const headline=(d.title || "BINGO ANDINO 75").toUpperCase();
    let fontSize=portrait?87:82;
    let lines=[];
    while(fontSize>=48){
      ctx.font="900 "+fontSize+"px system-ui, sans-serif";
      lines=wrapped(ctx,headline,w-155,portrait?5:3);
      if(lines.length<=(portrait?5:3) && lines.every(line=>ctx.measureText(line).width<=w-155))break;
      fontSize-=5;
    }
    ctx.font="900 "+fontSize+"px system-ui, sans-serif";
    ctx.fillStyle="#fff2d9";
    const lineGap=fontSize*1.15;
    const top=headY-(lines.length-1)*lineGap*.5;
    lines.forEach((line,i)=>ctx.fillText(line,w/2,top+i*lineGap));
    ctx.font="500 "+(portrait?41:35)+"px system-ui, sans-serif";
    const subLines=wrapped(ctx,d.body || "Bingo Andino 75",w-180,3);
    const messageTop=top+(lines.length-1)*lineGap+(portrait?145:95);
    subLines.forEach((line,i)=>ctx.fillText(line,w/2,messageTop+i*(portrait?57:45)));

    const cta=d.cta || "BINGOANDINO75.COM";
    ctx.font="bold 33px system-ui, sans-serif";
    const pillW=Math.min(w-130,Math.max(380,ctx.measureText(cta).width+110));
    const pillY=portrait?1510:870;
    ctx.fillStyle="#fff4dc";roundRect(ctx,(w-pillW)/2,pillY,pillW,90,45);ctx.fill();
    ctx.fillStyle="#3b164d";ctx.fillText(cta.slice(0,65),w/2,pillY+57);
    ctx.font="bold 24px system-ui, sans-serif";
    ctx.fillStyle="#e8c87e";ctx.fillText("bingoandino75.com",w/2,h-85);
    const saved=drafts.find((v)=>v.id===editingId);
    if(saved?.state!=="aprobado"){
      ctx.fillStyle="rgba(30,6,40,.68)";
      ctx.fillRect(80,h-215,w-160,56);
      ctx.fillStyle="#fff2d9";ctx.font="bold 23px system-ui, sans-serif";
      ctx.fillText("BORRADOR · SIN PUBLICAR",w/2,h-177);
    }
    canvas.toBlob((blob)=>{
      if(!blob){status("No se pudo preparar la imagen PNG.",true);return;}
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;
      a.download="andy-"+d.format+"-"+todayVE()+".png";
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      status(d.format==="reel"?"Portada PNG descargada. El video del reel todavía requiere edición.":"Imagen PNG descargada para revisión. No se ha publicado.");
    },"image/png");
  }
  function briefToDraft() {
    const text=el("andy-orden").value.trim();
    if(!text){status("Escribe primero qué contenido necesitas.",true);return;}
    // Un brief nuevo nunca reemplaza silenciosamente un borrador seleccionado.
    newDraft();
    const isReel=/reel|video|grabaci[oó]n/i.test(text);
    const isStory=/historia|story|stories|encuesta|trivia/i.test(text);
    const theme=/seguridad|estafa|c[oó]digo/i.test(text)?"seguridad":
      /tutorial|verific|compra/i.test(text)?"tutorial":
      /bombo|bolita/i.test(text)?"bombo":
      /gracias|agradec/i.test(text)?"comunidad":"bienvenida";
    const data=ideas[theme];
    fill({format:isReel?"reel":isStory?"story":"post",theme,...data,date:todayVE(),time:"18:00"});
    status("Preparé una plantilla según tu instrucción. Es una propuesta local, no contenido generado por IA.");
  }
  function init() {
    drafts=safeStorageRead();
    el("andy-fecha").min="";
    newDraft();
    renderList();updateCounts();
    el("andy-plantilla").addEventListener("click",sample);
    el("andy-nuevo").addEventListener("click",newDraft);
    el("andy-guardar").addEventListener("click",toSaved);
    el("andy-aprobar").addEventListener("click",()=>setState("aprobado"));
    el("andy-revision").addEventListener("click",()=>setState("revision"));
    el("andy-eliminar").addEventListener("click",remove);
    el("andy-ideas").addEventListener("click",buildWeek);
    el("andy-copiar").addEventListener("click",copyCaption);
    el("andy-descargar").addEventListener("click",exportImage);
    el("andy-respaldo").addEventListener("click",downloadBackup);
    el("andy-brief-crear").addEventListener("click",briefToDraft);
    el("andy-filtro").addEventListener("change",renderList);
    Object.values(fields).forEach((id)=>el(id).addEventListener("input",renderPreview));
    renderPreview();
  }
  init();
})();
