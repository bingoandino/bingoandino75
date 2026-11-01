import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


const BINGO_ADMIN_ID = "5121c2ba-c8f1-40f8-8b3e-130a75f60ac5";
async function verifiedBingoAdmin(req: Request) {
  const token=(req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const {data,error}=await client.auth.getUser(token);
  const user=data?.user;
  if(error || !user || user.id!==BINGO_ADMIN_ID || !user.email_confirmed_at) return null;
  return user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const verified=await verifiedBingoAdmin(req);
    if(!verified) return new Response(JSON.stringify({error:"No autorizado",valid:false}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});

    // Esta ruta ya no es utilizada por la página y nunca debe crear nuevas sesiones.
    return new Response(JSON.stringify({error:"Ruta anterior de acceso deshabilitada"}),
      {status:403,headers:{...corsHeaders,"Content-Type":"application/json"}});
    const { user_id, user_email, sessionToken, device_id, ip_address, user_agent } = await req.json();
    if(String(user_email || "").trim().toLowerCase()!==verified.email?.toLowerCase()) return new Response(JSON.stringify({error:"No autorizado"}),{status:403,headers:{...corsHeaders,"Content-Type":"application/json"}});

    if (!user_id || !user_email || !sessionToken || !device_id) {
      return new Response(JSON.stringify({ error: "Datos incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // 1) Buscar sesión admin activa (solo debe existir 1)
    const { data: activeSession, error: activeErr } = await supabaseAdmin
      .from("sesiones_activas")
      .select("*")
      .eq("tipo", "admin")
      .eq("activa", true)
      .maybeSingle();

    if (activeErr) {
      return new Response(JSON.stringify({ error: "Error consultando sesión", details: activeErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Si existe sesión activa…
    if (activeSession) {
      // 2a) Si es la MISMA sesión (mismo device + token), RENUEVA (reload no te saca)
      if (activeSession.device_id === device_id && activeSession.session_token === sessionToken) {
        const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await supabaseAdmin
          .from("sesiones_activas")
          .update({
            ultima_actividad: new Date().toISOString(),
            expires_at: newExpiresAt.toISOString(),
          })
          .eq("id", activeSession.id);

        return new Response(JSON.stringify({
          success: true,
          session: { ...activeSession, expires_at: newExpiresAt.toISOString() },
          expires_at: newExpiresAt.toISOString(),
          message: "Sesión renovada",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2b) Si es OTRO device/token, BLOQUEA (no permites 2 admins)
      return new Response(JSON.stringify({
        error: "SESION_ACTIVA",
        message: "Ya hay una sesión admin activa en otro dispositivo/navegador.",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Si NO hay sesión activa, CREA una nueva
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const { data: created, error: createErr } = await supabaseAdmin
      .from("sesiones_activas")
      .insert([{
        user_id,
        user_email,
        tipo: "admin",
        session_token: sessionToken,
        device_id,
        ip_address,
        user_agent,
        activa: true,
        login_timestamp: new Date().toISOString(),
        ultima_actividad: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }])
      .select()
      .single();

    if (createErr) {
      return new Response(JSON.stringify({ error: "Error creando sesión", details: createErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      session: created,
      expires_at: expiresAt.toISOString(),
      message: "Sesión creada",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (_e) {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

