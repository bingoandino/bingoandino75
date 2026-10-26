import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const ADMIN_ID = "5121c2ba-c8f1-40f8-8b3e-130a75f60ac5";
const cors = {
 "Access-Control-Allow-Origin": "https://bingoandino75.com",
 "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods": "POST, OPTIONS",
};
serve(async (req: Request) => {
 const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type":"application/json", "Cache-Control":"no-store"}});
 if(req.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
 if(req.method !== "POST") return reply(405,{error:"Método no permitido."});
 const bearer = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
 if(!bearer) return reply(401,{error:"Vuelve a entrar al administrador."});
 const url=Deno.env.get("SUPABASE_URL")!;
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const db=createClient(url,serviceKey,options);
 try {
  const {data:identity,error:identityError}=await db.auth.getUser(bearer);
  const user=identity?.user;
  if(identityError || user?.id!==ADMIN_ID || !user.email || !user.email_confirmed_at) return reply(401,{error:"Vuelve a verificar tu acceso de administrador."});
  if(Number(req.headers.get("content-length")||0)>4096) return reply(413,{error:"Solicitud demasiado grande."});
  const body=await req.json();
  if(body.action!=="request" && body.action!=="save") return reply(400,{error:"Acción inválida."});
  if(body.action==="save" && (typeof body.key!=="string" || body.key.length<10 || body.key.length>64 || new TextEncoder().encode(body.key).length>72 || typeof body.code!=="string" || !/^\d{6}$/.test(body.code))) return reply(400,{error:"Introduce el código de 6 dígitos y una clave de 10 a 64 caracteres."});
  const {data:gate,error:gateError}=await db.rpc("rpc_reset_key_email_gate",{_action:body.action==="request"?"request":"verify"});
  if(gateError) return reply(500,{error:"No se pudo verificar la solicitud. Intenta nuevamente."});
  if(!gate?.ok) return reply(429,{error:gate?.error||"Espera antes de intentar nuevamente."});
  // This isolated client consumes the OTP without replacing the service client's identity.
  const mail=createClient(url,serviceKey,options);
  if(body.action==="request") {
   const {error}=await mail.auth.signInWithOtp({email:user.email,options:{shouldCreateUser:false}});
   if(error) return reply(429,{error:"No se pudo enviar el código. Espera un minuto y vuelve a solicitarlo."});
   return reply(200,{ok:true,message:"Código enviado a tu correo de administrador. Vence en 10 minutos."});
  }
  const {data:verified,error:otpError}=await mail.auth.verifyOtp({email:user.email,token:body.code,type:"email"});
  if(otpError || verified?.user?.id!==ADMIN_ID) return reply(400,{error:"Código incorrecto o vencido. Solicita otro si es necesario."});
  const {error:saveError}=await db.rpc("rpc_guardar_clave_reinicio",{_clave:body.key});
  if(saveError) return reply(500,{error:"No se pudo guardar la clave. Solicita un código nuevo e intenta otra vez."});
  return reply(200,{ok:true,message:"Clave de reinicio guardada."});
 } catch {
  return reply(500,{error:"No se pudo completar la solicitud. Intenta nuevamente."});
 }
});
