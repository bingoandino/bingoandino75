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
    status("Idea cargada. Personaliza los textos antes de guardarlos.");
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
  function renderCalendar() {
    const target = el("andy-agenda");
    if (!target) return;
    target.replaceChildren();
    const start = new Date(todayVE() + "T12:00:00Z");
    for (let i = 0; i < 7; i++) {
      const date = new Date(start.getTime() + i * 86400000);
      const key = date.toISOString().slice(0,10);
      const scheduled = drafts.filter((d) => d.date === key).sort((a,b) => (a.time||"").localeCompare(b.time||""));
      const day = document.createElement("div");
      day.className = "andy-day";
      const label = document.createElement("strong");
      label.textContent = new Intl.DateTimeFormat("es-VE",{timeZone:"UTC",weekday:"short",day:"numeric"}).format(date);
      const count = document.createElement("small");
      count.textContent = scheduled.length ? scheduled.length + (scheduled.length===1?" propuesta":" propuestas") : "Sin propuestas";
      day.append(label,count);
      scheduled.slice(0,4).forEach((draft) => {
        const link = document.createElement("button");
        link.type = "button";
        link.className = "andy-day-item";
        link.title = "Editar: " + draft.title;
        link.textContent = (draft.time ? draft.time + " · " : "") + draft.title;
        link.addEventListener("click", () => edit(draft.id));
        day.append(link);
      });
      if (scheduled.length > 4) {
        const more = document.createElement("small");
        more.textContent = "y " + (scheduled.length-4) + " más";
        day.append(more);
      }
      target.append(day);
    }
  }
  function renderList() {
    renderCalendar();
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
    el("andy-guion-grupo").hidden=d.format!=="reel";
    // La solicitud de ChatGPT siempre debe reflejar los últimos datos escritos.
    const result=el("andy-chatgpt-resultado");
    if(result)result.hidden=true;
  }
  async function prepareForChatGPT() {
    const module=window.AndyChatGPTBrief;
    if(!module){status("No se pudo preparar el contenido. Actualiza la página.",true);return;}
    let brief;
    try {brief=module.editorBrief(values());}
    catch(err){status(err.message||"Completa el contenido antes de preparar las instrucciones.",true);return;}
    el("andy-chatgpt-prompt").value=brief;
    el("andy-chatgpt-resultado").hidden=false;
    el("andy-chatgpt-resultado").scrollIntoView?.({behavior:"smooth",block:"nearest"});
    await copyChatGPTPrompt();
  }
  async function copyChatGPTPrompt() {
    const field=el("andy-chatgpt-prompt");
    if(!field.value){status("Primero prepara las instrucciones.",true);return;}
    try{
      await navigator.clipboard.writeText(field.value);
      status("Instrucciones copiadas. Abre ChatGPT y pégalas para generar una imagen premium.");
    }catch(_){
      field.focus();field.select();
      status("Las instrucciones están listas. Selecciónalas y cópialas para pegarlas en ChatGPT.");
    }
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
    status("Preparé los textos a partir de una idea. Usa «Preparar para ChatGPT» para obtener instrucciones visuales.");
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
    el("andy-copiar-directo").addEventListener("click",copyCaption);
    el("andy-preparar-chatgpt").addEventListener("click",()=>{void prepareForChatGPT();});
    el("andy-chatgpt-copiar").addEventListener("click",()=>{void copyChatGPTPrompt();});
    el("andy-respaldo").addEventListener("click",downloadBackup);
    el("andy-brief-crear").addEventListener("click",briefToDraft);
    el("andy-filtro").addEventListener("change",renderList);
    Object.values(fields).forEach((id)=>el(id).addEventListener("input",renderPreview));
    renderPreview();
  }
  init();
})();
