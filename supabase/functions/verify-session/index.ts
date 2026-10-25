// supabase/functions/verify-session/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
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

  try {
    const verified=await verifiedBingoAdmin(req);
    if(!verified) return new Response(JSON.stringify({error:"No autorizado",valid:false}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const { sessionToken, deviceId } = await req.json();

    if (!sessionToken || !deviceId) {
      return new Response(JSON.stringify({ valid: false, sameDevice: false, reason: "NO_TOKEN_OR_DEVICE" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Buscar por token activo (sin filtrar device todavía)
    const { data, error } = await supabase
      .from("sesiones_activas")
      .select("session_token, device_id, expires_at")
      .eq("session_token", sessionToken)
      .eq("activa", true)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ valid: false, sameDevice: false, reason: "SESSION_NOT_FOUND" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    // 2) Verificar si es el mismo dispositivo
    const sameDevice = data.device_id === deviceId;
    if (!sameDevice) {
      return new Response(JSON.stringify({ valid: false, sameDevice: false, reason: "OTHER_DEVICE" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    // 3) Manejar expires_at nulo (muy importante)
    if (!data.expires_at) {
      return new Response(JSON.stringify({ valid: false, sameDevice: true, reason: "NO_EXPIRES_AT" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (Number.isNaN(expiresAt.getTime()) || now > expiresAt) {
      await supabase
        .from("sesiones_activas")
        .update({ activa: false, cerrada_en: now.toISOString() })
        .eq("session_token", sessionToken);

      return new Response(JSON.stringify({ valid: false, sameDevice: true, reason: "SESSION_EXPIRED" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    // 4) Actualizar actividad (y opcionalmente extender)
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    let outExpiresAt = data.expires_at;

    if (expiresAt < thirtyMinutesFromNow) {
      const newExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2h
      outExpiresAt = newExpiresAt.toISOString();

      await supabase
        .from("sesiones_activas")
        .update({ ultima_actividad: now.toISOString(), expires_at: outExpiresAt })
        .eq("session_token", sessionToken);
    } else {
      await supabase
        .from("sesiones_activas")
        .update({ ultima_actividad: now.toISOString() })
        .eq("session_token", sessionToken);
    }

    return new Response(JSON.stringify({ valid: true, sameDevice: true, expiresAt: outExpiresAt }), {
      status: 200, headers: jsonHeaders,
    });

  } catch {
    return new Response(JSON.stringify({ valid: false, sameDevice: false, reason: "SERVER_ERROR" }), {
      status: 200, headers: jsonHeaders,
    });
  }
});

