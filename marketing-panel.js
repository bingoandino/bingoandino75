/* ANDY Marketing: reporte de sesiones de lectura privada en el administrador.
 * Nunca consulta ni muestra información personal o bancaria.
 */
(function () {
  "use strict";
  function put(id, text) {
    var target = document.getElementById(id);
    if (target) target.textContent = String(text);
  }
  function dayCaracas() {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    var result = {};
    parts.forEach(function (part) { result[part.type] = part.value; });
    return [result.year, result.month, result.day].join("-");
  }
  function textNumber(n) { return Number(n || 0).toLocaleString("es-VE"); }
  function sourceLabel(value) {
    var names = {
      instagram:"Instagram",facebook:"Facebook",whatsapp:"WhatsApp",
      google:"Google",directo:"Directo",otro:"Otro",desconocido:"Sin origen identificable"
    };
    return names[value] || "Sin origen identificable";
  }
  var pending = false;
  async function load() {
    if (pending) return;
    var admin = document.getElementById("admin-panel");
    var tab = document.getElementById("tab-marketing");
    if (!admin || admin.classList.contains("oculto") || !tab || !tab.classList.contains("active")) return;
    var sessionToken = sessionStorage.getItem("admin_session_token");
    var deviceId = sessionStorage.getItem("device_id") || localStorage.getItem("admin_device_id");
    if (!sessionToken || !deviceId || !window.supabase?.auth) {
      put("andy-estado", "Necesitas una sesión administrativa activa.");
      return;
    }
    pending = true;
    put("andy-estado", "Cargando estadísticas...");
    try {
      var auth = await window.supabase.auth.getSession();
      var token = auth.data?.session?.access_token;
      if (!token) throw new Error("Inicia sesión nuevamente para ver estadísticas.");
      var response = await fetch("https://dbkixcpwirjwjvjintkr.supabase.co/functions/v1/marketing-report", {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token,
        },
        body: JSON.stringify({ sessionToken: sessionToken, deviceId: deviceId, days: 7 }),
      });
      if (!response.ok) throw new Error("Reporte no disponible o sesión sin permiso.");
      var responseBody = await response.json();
      var rows = Array.isArray(responseBody.rows) ? responseBody.rows : [];
      var today = dayCaracas();
      function total(kind, todayOnly) {
        return rows.reduce(function (sum, row) {
          return sum + (row.tipo === kind && (!todayOnly || row.fecha_ve === today) ?
            Number(row.sesiones || 0) : 0);
        }, 0);
      }
      put("andy-visitas-hoy", textNumber(total("visita", true)));
      put("andy-visitas-semana", textNumber(total("visita", false)));
      put("andy-clics-comprar", textNumber(total("click_comprar", false)));
      put("andy-clics-whatsapp", textNumber(total("click_whatsapp", false)));
      var sourceTotals = {};
      rows.filter(function (row) { return row.tipo === "visita"; }).forEach(function (row) {
        sourceTotals[row.origen] = (sourceTotals[row.origen] || 0) + Number(row.sesiones || 0);
      });
      var body = document.getElementById("andy-canales");
      if (body) {
        body.replaceChildren();
        var sources = Object.entries(sourceTotals).sort(function (a, b) { return b[1] - a[1]; });
        if (!sources.length) sources = [["desconocido", 0]];
        sources.forEach(function (item) {
          var tr = document.createElement("tr");
          var name = document.createElement("td");
          var count = document.createElement("td");
          name.textContent = sourceLabel(item[0]);
          count.textContent = textNumber(item[1]);
          tr.append(name, count);
          body.appendChild(tr);
        });
      }
      put("andy-estado", "Actualizado. Son sesiones aproximadas; los clics no equivalen a compras verificadas.");
    } catch (e) {
      put("andy-estado", e && e.message ? e.message : "No se pudo actualizar.");
    } finally { pending = false; }
  }
  window.andyCargarReporte = load;
  document.addEventListener("click", function (event) {
    var btn = event.target?.closest?.(".admin-tabs .tab-btn");
    if (btn && btn.getAttribute("onclick") === "cambiarTab('tab-marketing')") {
      Promise.resolve().then(load);
    }
  });
  document.getElementById("andy-refrescar")?.addEventListener("click", load);
})();
