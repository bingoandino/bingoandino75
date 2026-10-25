// supabase/functions/admin-auth/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { encodeHex } from "jsr:@std/encoding@^1.0/hex";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://bingoandino75.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};





// Función SEGURA para verificar password
async function verifyPasswordSecurely(
  password: string, 
  storedHashWithSalt: string
): Promise<boolean> {
  try {
    const [saltHex, expectedHash] = storedHashWithSalt.split(':');
    
    if (!saltHex || !expectedHash) {
      throw new Error("Formato de hash inválido");
    }
    
    const salt = hexToBytes(saltHex);
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const saltedPassword = new Uint8Array([...passwordBytes, ...salt]);
    
    const hashBuffer = await crypto.subtle.digest("SHA-256", saltedPassword);
    const computedHash = encodeHex(new Uint8Array(hashBuffer));
    
    return timingSafeCompare(computedHash, expectedHash);
    
  } catch (error) {
    console.error("Error en verifyPasswordSecurely:", error);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return false;
  }
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

const rateLimit = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimit.get(ip);
  
  if (!limit) {
    rateLimit.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (now > limit.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (limit.count >= 5) {
    return false;
  }
  
  limit.count++;
  return true;
}

// ========== NUEVA FUNCIÓN PARA VERIFICAR SOLO CREDENCIALES ==========
async function verifyCredentialsOnly(
  email: string, 
  password: string
): Promise<{ valid: boolean; email?: string }> {
  try {
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    const ADMIN_PASSWORD_HASH_SALTED = Deno.env.get("ADMIN_PASSWORD_HASH_SALTED");
    
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH_SALTED) {
      console.error("❌ Credenciales no configuradas");
      return { valid: false };
    }
    
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { valid: false };
    }
    
    const isValidPassword = await verifyPasswordSecurely(
      password, 
      ADMIN_PASSWORD_HASH_SALTED
    );
    
    return { valid: isValidPassword, email: cleanEmail };
    
  } catch (error) {
    console.error("Error en verifyCredentialsOnly:", error);
    return { valid: false };
  }
}

// ========== FUNCIÓN PARA CREAR SESIÓN DESPUÉS DE OTP ==========
async function createSessionAfterOTP(
  email: string,
  deviceId: string,
  supabaseAdmin: any
): Promise<{ sessionToken: string; expiresAt: string; deviceId: string }> {
  const sessionToken = `sess_${Date.now()}_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { error: sessionError } = await supabaseAdmin
    .from("sesiones_activas")
    .upsert(
      {
        user_id: email,
        user_email: email,
        tipo: "admin",
        session_token: sessionToken,
        device_id: deviceId,
        activa: true,
        ultima_actividad: new Date().toISOString(),
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
        cerrada_en: null,
        autenticacion_tipo: "otp",
      },
      { onConflict: "tipo,user_email" }
    );

  if (sessionError) throw sessionError;

  return { sessionToken, expiresAt, deviceId };
}


// ========== FUNCIÓN PARA VERIFICAR DISPOSITIVO CONOCIDO ==========
async function isDeviceKnown(
  email: string,
  deviceId: string,
  supabaseAdmin: any
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("dispositivos_autorizados")
    .select("id")
    .eq("user_email", email)
    .eq("device_id", deviceId)
    .eq("activo", true)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}


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

serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Verificar método
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405, headers: corsHeaders }
    );
  }

  // 3. Rate limiting
  const clientIp = req.headers.get("cf-connecting-ip") || 
                   req.headers.get("x-forwarded-for")?.split(",")[0] || 
                   "unknown";
  
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ 
        error: "Demasiados intentos. Intenta en 1 minuto." 
      }),
      { status: 429, headers: corsHeaders }
    );
  }

  try {
    // Parsear cuerpo con acciones nuevas
    const { email, password, deviceId, action = 'login' } = await req.json();
    if(action!=="verify_credentials") {
      const verified=await verifiedBingoAdmin(req);
      if(!verified || String(email || "").trim().toLowerCase()!==verified.email?.toLowerCase()) {
        return new Response(JSON.stringify({error:"Se requiere verificar el código del administrador"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});
      }
    }

    
    // ========== HANDLE LOGOUT ==========
    if (action === "logout") {
      if (!email || !deviceId) {
        return new Response(
          JSON.stringify({ error: "Datos incompletos para logout" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!supabaseServiceKey || !supabaseUrl) {
        throw new Error("Credenciales de Supabase faltantes");
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      const { data: sessionToClose } = await supabaseAdmin
        .from("sesiones_activas")
        .select("id, device_id")
        .eq("user_email", email.trim().toLowerCase())
        .eq("device_id", deviceId)
        .eq("activa", true)
        .single();

      if (sessionToClose) {
        await supabaseAdmin
          .from("sesiones_activas")
          .update({ 
            activa: false,
            cerrada_en: new Date().toISOString(), 
            updated_at: new Date().toISOString()  
          })
          .eq("id", sessionToClose.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Sesión cerrada correctamente."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== NUEVA ACCIÓN: VERIFICAR SOLO CREDENCIALES ==========
    if (action === "verify_credentials") {
      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email y contraseña requeridos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await verifyCredentialsOnly(email, password);
      
      if (result.valid) {
        return new Response(
          JSON.stringify({
            valid: true,
            email: result.email,
            message: "Credenciales verificadas correctamente"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return new Response(
          JSON.stringify({ 
            valid: false,
            error: "Credenciales incorrectas" 
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========== NUEVA ACCIÓN: CREAR SESIÓN DESPUÉS DE OTP ==========
    if (action === "create_session_otp") {
      if (!email || !deviceId) {
        return new Response(
          JSON.stringify({ error: "Email y deviceId requeridos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!supabaseServiceKey || !supabaseUrl) {
        throw new Error("Credenciales de Supabase faltantes");
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // Verificar si ya tiene sesión activa
      const { data: activeSessions } = await supabaseAdmin
        .from("sesiones_activas")
        .select("id, device_id")
        .eq("user_email", email)
        .eq("activa", true)
        .eq("tipo", "admin");

      if (activeSessions && activeSessions.length > 0) {
        // Permitir si es el mismo dispositivo
        const sameDeviceSession = activeSessions.find(s => s.device_id === deviceId);
        if (!sameDeviceSession) {
          return new Response(
            JSON.stringify({ 
              error: "SESION_ACTIVA",
              message: "Ya hay una sesión activa en otro dispositivo"
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Crear nueva sesión
      const sessionData = await createSessionAfterOTP(email, deviceId, supabaseAdmin);

      return new Response(
        JSON.stringify({
          success: true,
          email: email,
          sessionToken: sessionData.sessionToken,
          expiresAt: sessionData.expiresAt,
          deviceId: sessionData.deviceId,
          message: "Sesión creada después de OTP"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ACCIÓN ORIGINAL: LOGIN COMPLETO ==========
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return new Response(
        JSON.stringify({ error: "Datos inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanEmail = email.trim().toLowerCase().substring(0, 100);
    const cleanPassword = password.substring(0, 100);

    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    const ADMIN_PASSWORD_HASH_SALTED = Deno.env.get("ADMIN_PASSWORD_HASH_SALTED");
    
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH_SALTED) {
      console.error("❌ Credenciales no configuradas en variables de entorno");
      await new Promise(resolve => setTimeout(resolve, 1000));
      return new Response(
        JSON.stringify({ error: "Error de configuración" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return new Response(
        JSON.stringify({ error: "Credenciales incorrectas" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isValidPassword = await verifyPasswordSecurely(
      cleanPassword, 
      ADMIN_PASSWORD_HASH_SALTED
    );

    if (!isValidPassword) {
      return new Response(
        JSON.stringify({ error: "Credenciales incorrectas" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseServiceKey || !supabaseUrl) {
      throw new Error("Credenciales de Supabase faltantes");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verificar sesión activa
    const { data: activeSessions } = await supabaseAdmin
      .from("sesiones_activas")
      .select("id, device_id, ultima_actividad, session_token")
      .eq("user_email", ADMIN_EMAIL)
      .eq("activa", true)
      .eq("tipo", "admin");

    const now = new Date();
    
    if (activeSessions && activeSessions.length > 0) {
      const expiredSessions = activeSessions.filter(session => {
        const lastActivity = new Date(session.ultima_actividad);
        const hoursDiff = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
        return hoursDiff > 2;
      });

      if (expiredSessions.length > 0) {
        for (const session of expiredSessions) {
          await supabaseAdmin
            .from("sesiones_activas")
            .update({ activa: false })
            .eq("id", session.id);
        }
      }

      const stillActive = activeSessions.filter(s => 
        !expiredSessions.find(es => es.id === s.id)
      );

      if (stillActive.length > 0) {
        if (deviceId) {
          const sameDeviceSession = stillActive.find(s => s.device_id === deviceId);
          if (sameDeviceSession) {
            const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
            
            await supabaseAdmin
              .from("sesiones_activas")
              .update({
                ultima_actividad: now.toISOString(),
                expires_at: newExpiresAt.toISOString()
              })
              .eq("id", sameDeviceSession.id);

            return new Response(
              JSON.stringify({
                success: true,
                email: ADMIN_EMAIL,
                sessionToken: sameDeviceSession.session_token,
                expiresAt: newExpiresAt.toISOString(),
                deviceId: deviceId,
                message: "Sesión renovada"
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        return new Response(
          JSON.stringify({ 
            error: "SESION_ACTIVA",
            message: "Ya hay una sesión activa en otro dispositivo",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Crear nueva sesión
    const sessionToken = `sess_${Date.now()}_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const finalDeviceId = deviceId || `dev_${Date.now()}_${crypto.randomUUID()}`;
const { error: sessionError } = await supabaseAdmin
  .from("sesiones_activas")
  .upsert(
    {
      user_id: ADMIN_EMAIL,
      user_email: ADMIN_EMAIL,
      tipo: "admin",
      session_token: sessionToken,
      device_id: finalDeviceId,
      activa: true,
      ultima_actividad: now.toISOString(),
      expires_at: expiresAt,
      updated_at: now.toISOString(),
      cerrada_en: null,
      autenticacion_tipo: "password",
    },
    { onConflict: "tipo,user_email" }
  );

  if (sessionError) {
  console.error("Error creando sesión:", sessionError);
  throw sessionError;
}


    return new Response(
      JSON.stringify({
        success: true,
        email: ADMIN_EMAIL,
        sessionToken,
        expiresAt,
        deviceId: finalDeviceId,
        message: "Sesión única creada",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en admin-auth:", error);

    const e: any = error || {};
    return new Response(
      JSON.stringify({
        error: "SERVER_ERROR",
        message: e.message ?? String(error),
        code: e.code ?? null,
        details: e.details ?? null,
        hint: e.hint ?? null,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
