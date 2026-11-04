// ANDY: ingestión anónima limitada a métricas de navegación.
 // No acepta datos personales, bancarios, identificadores de cliente ni URLs completas.
const permitted = new Set([
  "https://bingoandino75.com",
  "https://www.bingoandino75.com",
]);
const tipos = new Set(["visita", "click_comprar", "click_whatsapp"]);
const origenes = new Set(["instagram", "facebook", "whatsapp", "google", "directo", "otro", "desconocido"]);
const uuidRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function headers(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}
Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (!permitted.has(origin)) return new Response("No autorizado", { status: 403 });
  const h = headers(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (request.method !== "POST") return new Response("Método inválido", { status: 405, headers: h });
  if (Number(request.headers.get("content-length") || 0) > 1200)
    return new Response("Demasiados datos", { status: 413, headers: h });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
    if (!payload || Array.isArray(payload) || typeof payload !== "object")
      throw new Error("Formato incorrecto");
  } catch {
    return new Response("JSON inválido", { status: 400, headers: h });
  }
  const { sesion_id, tipo, origen, campania } = payload;
  if (typeof sesion_id !== "string" || !uuidRE.test(sesion_id) ||
      typeof tipo !== "string" || !tipos.has(tipo) ||
      typeof origen !== "string" || !origenes.has(origen) ||
      (campania !== null && campania !== undefined &&
       (typeof campania !== "string" || campania.length > 80 ||
        !/^[a-zA-Z0-9_. -]+$/.test(campania)))) {
    return new Response("Evento inválido", { status: 400, headers: h });
  }
  const endpoint = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!endpoint || !secret)
    return new Response("Configuración no disponible", { status: 503, headers: h });

  // El día se asigna en PostgreSQL, sin confiar en relojes enviados por el navegador.
  const item = {
    sesion_id,
    tipo,
    origen,
    campania: typeof campania === "string" && campania.length ? campania : null,
  };
  try {
    const result = await fetch(endpoint + "/rest/v1/marketing_visitas", {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: "Bearer " + secret,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(item),
    });
    // Un mismo evento por sesión y día solo cuenta una vez.
    if (result.status === 409) return new Response(null, { status: 204, headers: h });
    if (!result.ok) {
      console.error("ANDY visit insert error", result.status);
      return new Response("No disponible", { status: 503, headers: h });
    }
    return new Response(null, { status: 204, headers: h });
  } catch {
    return new Response("No disponible", { status: 503, headers: h });
  }
});
