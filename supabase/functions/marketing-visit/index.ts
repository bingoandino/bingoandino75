// ANDY Marketing: telemetría pública mínima y limitada.
// Seguridad: circuito desactivado por defecto; cuota Redis global ANTES de tocar Postgres.
// Una indisponibilidad de métricas nunca bloquea la compra ni el resto de la página.
const permitted = new Set(["https://bingoandino75.com", "https://www.bingoandino75.com"]);
const tipos = new Set(["visita", "click_comprar", "click_whatsapp"]);
const origenes = new Set(["instagram", "facebook", "whatsapp", "google", "directo", "otro", "desconocido"]);
const uuidRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxRequestBytes = 800;

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

// Lee a lo sumo 800 bytes, incluso si se omite Content-Length o se transmite en chunks.
async function boundedText(req: Request): Promise<string | null> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxRequestBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch { return null; }
  const all = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) {
    all.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(all);
}

// Redis EVAL garantiza que la cuota global aplica a TODAS las instancias de Edge.
// No usa IP ni identificadores del navegador: las claves son solo minuto y día UTC.
// Máximo 80 eventos/minuto y 8000/día, con expiración automática; ajustar tras medir tráfico real.
const quotaScript =
  "local m=redis.call('INCR',KEYS[1]);" +
  "if m==1 then redis.call('EXPIRE',KEYS[1],120) end;" +
  "local d=redis.call('INCR',KEYS[2]);" +
  "if d==1 then redis.call('EXPIRE',KEYS[2],172800) end;" +
  "if m>tonumber(ARGV[1]) or d>tonumber(ARGV[2]) then return 0 end;" +
  "return 1";

async function hasQuota(): Promise<boolean> {
  const url = Deno.env.get("MARKETING_REDIS_REST_URL") || "";
  const token = Deno.env.get("MARKETING_REDIS_REST_TOKEN") || "";
  if (!url.startsWith("https://") || !token) return false;
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const minute = now.slice(0, 16);
  try {
    const result = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(1500),
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL", quotaScript, 2,
        "bingo-andy:v1:minute:" + minute,
        "bingo-andy:v1:day:" + day,
        80, 8000,
      ]),
    });
    if (!result.ok) return false;
    const response = await result.json();
    return response?.result === 1;
  } catch { return false; }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (!permitted.has(origin)) return new Response("No autorizado", { status: 403 });
  const h = headers(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (request.method !== "POST") return new Response("Método inválido", { status: 405, headers: h });

  // Por seguridad los datos no se capturan hasta configurar explícitamente cuota externa.
  if (Deno.env.get("MARKETING_TRACKING_ENABLED") !== "true") {
    return new Response("Medición desactivada", { status: 503, headers: h });
  }
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || ""))
    return new Response("Tipo inválido", { status: 415, headers: h });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(contentLength) || contentLength > maxRequestBytes)
    return new Response("Demasiados datos", { status: 413, headers: h });

  let payload: Record<string, unknown>;
  try {
    const text = await boundedText(request);
    if (!text) return new Response("Demasiados datos", { status: 413, headers: h });
    payload = JSON.parse(text);
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

  if (!(await hasQuota()))
    return new Response("Límite de medición o servicio no disponible", { status: 429, headers: h });

  const endpoint = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!endpoint || !secret)
    return new Response("Configuración no disponible", { status: 503, headers: h });

  // Solo almacena origen, campaña, tipo y UUID de sesión. Fecha se asigna en Postgres.
  const item = {
    sesion_id,
    tipo,
    origen,
    campania: typeof campania === "string" && campania.length ? campania : null,
  };
  try {
    const result = await fetch(endpoint + "/rest/v1/marketing_visitas", {
      method: "POST",
      signal: AbortSignal.timeout(2000),
      headers: {
        apikey: secret,
        Authorization: "Bearer " + secret,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(item),
    });
    if (result.status === 409) return new Response(null, { status: 204, headers: h });
    if (!result.ok) {
      console.error("ANDY metrics insert error status", result.status);
      return new Response("No disponible", { status: 503, headers: h });
    }
    return new Response(null, { status: 204, headers: h });
  } catch {
    return new Response("No disponible", { status: 503, headers: h });
  }
});
