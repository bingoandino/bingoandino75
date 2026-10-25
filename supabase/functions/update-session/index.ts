// supabase/functions/update-session/index.ts (solo logout básico)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { action, sessionToken } = await req.json();
    
    if (!sessionToken && action === "logout") {
      return new Response(JSON.stringify({ error: "Token requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "logout") {
      await supabaseAdmin
        .from("sesiones_activas")
        .update({ 
          activa: false,
          ultima_actividad: new Date().toISOString()
        })
        .eq("session_token", sessionToken);
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Acción no válida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
