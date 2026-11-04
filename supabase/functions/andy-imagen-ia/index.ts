// ANDY premium AI artwork. Isolated from purchases, payments and bingo draws.
// Requires OPENAI_API_KEY secret on the server. It never receives prize/player data.
const ORIGINS=new Set(["https://bingoandino75.com","https://www.bingoandino75.com"]);
const ADMIN_ID="5121c2ba-c8f1-40f8-8b3e-130a75f60ac5";
const MODEL="gpt-image-2";
const limiter=new Map<string,{start:number,count:number,busy:boolean,last:number}>();
const MAX_REQUEST_BYTES=4096;
const json=(body:unknown,status:number,origin:string)=>Response.json(body,{status,headers:{
  "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST,OPTIONS",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type",
  "Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"}});
const isId=(s:unknown,min:number,max:number)=>typeof s==="string"&&s.length>=min&&s.length<=max&&/^[A-Za-z0-9_-]+$/.test(s);
function promptFor(format:"post"|"story",style:"five"|"six"|"saturday"){
  const saturday=style==="saturday";
  const detail=saturday?"Saturday night VIP celebration, lavish subtle metallic gold streamers and golden confetti, heightened luxurious showbiz feeling":
    style==="five"?"crisp, restrained luxury with ivory and deep violet accents, clean sophisticated editorial lighting":
    "opulent Las Vegas luxury, violet velvet lights, subtle golden sparkles and sophisticated stage";
  const composition=format==="post"?
    "SQUARE 1:1. Main photorealistic classical gold mechanical bingo cage occupying the TOP RIGHT quadrant, mostly inside upper 25% of the image. Decorative mountain horizon, gradient purple glow, luminous spotlights. Center and lower three quarters deliberately smooth, dark violet, low contrast, with restrained decorations mainly around margins for readable text panels to be placed later.":
    "TALL 9:16 VERTICAL. Impressive ornate golden bingo drum in the TOP RIGHT 25% of the poster. Top left reserved for later placement of exact brand lettering. Large beautiful illuminated purple and gold environment extends downward with spacious smooth dark violet and champagne-ivory decorative areas for later typeset overlays. Mountain peaks behind the top drum. Edges richly detailed and luxurious.";
  return ["Create a stunning premium advertising ART BACKGROUND for a Venezuelan 75-ball bingo night. Professional high-end casino illustration, hyper-detailed cinematic photography, warm ivory, deep royal purple and metallic gold. Gold caged bingo drum and glossy purple/gold/ivory bingo balls. Elegantly incorporate subtle Andean mountain silhouettes. NO blue, cyan, teal, maroon or burgundy. Rich depth, perfect lighting, sparkling lens flares, expensive polished product photography.",
    detail,composition,
    "IMPORTANT: This must be ART ONLY. ABSOLUTELY NO WORDS, NO LETTERING, NO TYPOGRAPHY, NO TEXT, NO DOLLAR SIGNS, NO NUMBERS, NO WATERMARKS, NO ICON LABELS, NO QR CODES, NO logos, NO graphics that look like readable writing. Exact information will be typeset separately by our design system, so leave generous, calm areas that contrast against cream and golden typography. Do not place readable numbers on bingo balls. The background must look expensive and inviting, not a simple template."
  ].join("\n\n");
}
const readObject=async(req:Request)=>{
  const size=Number(req.headers.get("content-length")||0);
  if(size>MAX_REQUEST_BYTES)throw Error("large");
  const body=await req.text();
  if(body.length>MAX_REQUEST_BYTES)throw Error("large");
  const p=JSON.parse(body);
  if(!p||typeof p!=="object"||Array.isArray(p))throw Error("invalid");
  return p as Record<string,unknown>;
};
async function authorize(req:Request,p:Record<string,unknown>){
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token||token.length>8192||!isId(p.sessionToken,24,100)||!isId(p.deviceId,7,130))return false;
  const base=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!base.startsWith("https://")||!anon||!service)return false;
  try {
    const userRes=await fetch(base+"/auth/v1/user",{headers:{apikey:anon,Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000),redirect:"error"});
    if(!userRes.ok)return false;
    const user=await userRes.json();
    if(user.id!==ADMIN_ID||!user.email_confirmed_at)return false;
    const query=new URL(base+"/rest/v1/sesiones_activas");
    query.searchParams.set("select","device_id,expires_at");
    query.searchParams.set("session_token","eq."+String(p.sessionToken));
    query.searchParams.set("activa","eq.true");
    query.searchParams.set("limit","1");
    const sr=await fetch(query,{headers:{apikey:service,Authorization:"Bearer "+service},signal:AbortSignal.timeout(10000),redirect:"error"});
    if(!sr.ok)return false;
    const rows=await sr.json();
    return Array.isArray(rows)&&rows.length===1&&rows[0].device_id===p.deviceId&&
      Number.isFinite(Date.parse(rows[0].expires_at))&&Date.parse(rows[0].expires_at)>Date.now();
  }catch{return false;}
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  const allow=ORIGINS.has(origin)?origin:"https://bingoandino75.com";
  if(!ORIGINS.has(origin))return json({error:"Origen no autorizado."},403,allow);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{
    "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"authorization,apikey,content-type","Vary":"Origin"}});
  if(req.method!=="POST")return json({error:"Método no permitido."},405,origin);
  let p:Record<string,unknown>;
  try {p=await readObject(req);}catch{return json({error:"Solicitud inválida."},400,origin);}
  if(!["status","generate"].includes(String(p.action))||!await authorize(req,p))
    return json({error:"Acceso no autorizado para generar imágenes."},401,origin);
  const key=Deno.env.get("OPENAI_API_KEY")||"";
  if(p.action==="status")return json({ready:!!key,provider:"OpenAI",model:MODEL,requiresManualClick:true},200,origin);
  if(!key)return json({error:"Falta conectar la API de imágenes. Configura OPENAI_API_KEY en Supabase > Edge Functions > Secrets."},503,origin);
  if(!["post","story"].includes(String(p.format))||!["five","six","saturday"].includes(String(p.style))||
    Object.keys(p).some(k=>!["action","sessionToken","deviceId","format","style"].includes(k)))
    return json({error:"Opciones de generación inválidas."},400,origin);
  const format=p.format as "post"|"story",style=p.style as "five"|"six"|"saturday";
  const now=Date.now(),userKey=String(p.deviceId);
  let record=limiter.get(userKey);
  if(!record||now-record.start>=3600000){record={start:now,count:0,busy:false,last:0};limiter.set(userKey,record);}
  if(record.busy||record.count>=6||now-record.last<20000)
    return json({error:"Se alcanzó el límite de seguridad temporal. Intenta nuevamente más tarde."},429,origin);
  record.busy=true;record.count++;record.last=now;
  try {
    const response=await fetch("https://api.openai.com/v1/images/generations",{
      method:"POST",redirect:"error",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},
      body:JSON.stringify({model:MODEL,prompt:promptFor(format,style),n:1,
        quality:"high",size:format==="post"?"1024x1024":"1024x1792",
        output_format:"webp",output_compression:82}),
      signal:AbortSignal.timeout(115000)
    });
    if(!response.ok) {
      const message=response.status===429?"El proveedor alcanzó su límite de uso o saldo.":
        response.status===401||response.status===403?"La API de imágenes no está autorizada. Revisa tu clave y facturación.":
        "No fue posible crear la imagen con IA.";
      return json({error:message},502,origin);
    }
    const data=await response.json();
    const encoded=data?.data?.[0]?.b64_json;
    if(typeof encoded!=="string"||encoded.length<3000||encoded.length>9000000||!/^[A-Za-z0-9+/=\r\n]+$/.test(encoded))
      return json({error:"La imagen recibida no pudo validarse."},502,origin);
    return json({format,style,imageBase64:encoded,mime:"image/webp",provider:"OpenAI",model:MODEL},200,origin);
  }catch{
    return json({error:"La generación de imagen no se completó. Puedes intentarlo nuevamente."},502,origin);
  }finally{record.busy=false;}
});
