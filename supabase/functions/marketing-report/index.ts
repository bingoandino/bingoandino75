// ANDY: reportes agregados, solo administrador comprobado + sesión activa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
const adminId = "5121c2ba-c8f1-40f8-8b3e-130a75f60ac5";
const allowed = new Set(["https://bingoandino75.com", "https://www.bingoandino75.com"]);
function cors(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type,Authorization,apikey",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}
function json(body: unknown, status: number, h: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...h, "Content-Type": "application/json" },
  });
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (!allowed.has(origin)) return new Response("Origen no permitido", { status: 403 });
  const h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405, h);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sesión requerida" }, 401, h);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400, h); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Datos inválidos" }, 400, h);
  const { sessionToken, deviceId, days } = body;
  if (typeof sessionToken !== "string" || sessionToken.length < 10 || sessionToken.length > 256 ||
      typeof deviceId !== "string" || deviceId.length < 6 || deviceId.length > 256 ||
      typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 30)
    return json({ error: "Parámetros incorrectos" }, 400, h);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "No disponible" }, 503, h);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || userData?.user?.id !== adminId || !userData.user.email_confirmed_at)
      return json({ error: "No autorizado" }, 403, h);
    // Comprobar adicionalmente la sesión administrativa de dispositivo; nunca bastará un JWT aislado.
    const { data: sessionData, error: sessionError } = await admin.from("sesiones_activas")
      .select("expires_at").eq("session_token", sessionToken)
      .eq("device_id", deviceId).eq("activa", true).maybeSingle();
    if (sessionError || !sessionData?.expires_at || new Date(sessionData.expires_at).getTime() <= Date.now())
      return json({ error: "Sesión expirada" }, 401, h);
    const { data, error } = await admin.rpc("marketing_resumen", { _dias: days });
    if (error) {
      console.error("ANDY report failed", error.code);
      return json({ error: "Reporte no disponible" }, 503, h);
    }
    return json({ days, rows: data || [] }, 200, h);
  } catch {
    return json({ error: "Reporte no disponible" }, 503, h);
  }
});
