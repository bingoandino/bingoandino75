/* ANDY Marketing: eventos agregados de navegación.
 * La función nunca bloquea compras, no usa datos personales, y no instala cookies.
 * sesion_id es aleatorio, se mantiene solo en sessionStorage de esta pestaña.
 */
(function () {
  "use strict";
  if (window.__ANDY_ANALYTICS_DISABLED__ === true) return;
  if (location.pathname !== "/" && location.pathname !== "/index.html") return;

  var storage;
  try {
    storage = window.sessionStorage;
    if (storage.getItem("admin_session_token")) return; // No contabilizar sesiones admin conocidas.
  } catch (_) { return; }
  if (!window.crypto || typeof window.crypto.randomUUID !== "function") return;

  var session;
  try {
    session = storage.getItem("andy_visit_session_v1");
    if (!session || !/^[0-9a-f-]{36}$/i.test(session)) {
      session = window.crypto.randomUUID();
      storage.setItem("andy_visit_session_v1", session);
    }
  } catch (_) { return; }

  function origenDe(host) {
    host = (host || "").toLowerCase();
    if (host === "instagram" || host.includes("instagram.com")) return "instagram";
    if (host === "facebook" || host.includes("facebook.com") || host === "fb") return "facebook";
    if (host === "whatsapp" || host.includes("whatsapp.com") || host === "wa.me") return "whatsapp";
    if (host === "google" || host.includes("google.")) return "google";
    if (host === "directo" || host === "direct") return "directo";
    return "desconocido";
  }
  var params = new URLSearchParams(location.search);
  var originParam = params.get("utm_source") || "";
  var source = origenDe(originParam);
  if (source === "desconocido" && document.referrer) {
    try {
      var ref = new URL(document.referrer);
      source = ref.hostname === location.hostname ? "desconocido" : origenDe(ref.hostname);
    } catch (_) {}
  }
  var campaign = params.get("utm_campaign") || null;
  if (campaign && (!/^[a-zA-Z0-9_. -]{1,80}$/.test(campaign))) campaign = null;
  try {
    var previous = JSON.parse(storage.getItem("andy_visit_source_v1") || "null");
    if (source === "desconocido" && previous && previous.source) {
      source = previous.source;
      if (!campaign) campaign = previous.campaign;
    } else if (source !== "desconocido") {
      storage.setItem("andy_visit_source_v1", JSON.stringify({ source: source, campaign: campaign }));
    }
  } catch (_) {}

  // Evita nuevos pedidos en recargas de la misma pestaña tras una recepción correcta.
  var todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  var sent = {};
  function sendEvent(type) {
    if (sent[type] || typeof window.fetch !== "function") return;
    var onceKey = "andy_v1_received_" + todayKey + "_" + type;
    try { if (storage.getItem(onceKey) === "1") return; } catch (_) {}
    sent[type] = true;
    var payload = JSON.stringify({
      sesion_id: session,
      tipo: type,
      origen: source,
      campania: campaign,
    });
    try {
      Promise.resolve(window.fetch("https://dbkixcpwirjwjvjintkr.supabase.co/functions/v1/marketing-visit", {
        method: "POST",
        mode: "cors",
        keepalive: true,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })).then(function (response) {
        if (response && response.ok) {
          try { storage.setItem(onceKey, "1"); } catch (_) {}
        }
      }).catch(function () { /* Métricas opcionales; no interrumpir compra. */ });
    } catch (_) { /* nunca bloquear navegación */ }
  }

  sendEvent("visita");
  document.addEventListener("click", function (event) {
    var element = event.target;
    if (!element || typeof element.closest !== "function") return;
    if (element.closest(".inicio-comprar")) {
      sendEvent("click_comprar");
    } else if (element.closest('a[href*="wa.me/"],a[href*="whatsapp.com/"]')) {
      sendEvent("click_whatsapp");
    }
  }, true);
})();
