const ORIGINS=new Set(['https://bingoandino75.com','https://www.bingoandino75.com']);
const ACTIONS=new Set(['panel','cliente','historial','reservar','liberar','registrar','resultado','equipo','upload']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function jsonBounded(req,max){const reader=req.body?.getReader();if(!reader)throw Error('Solicitud vacía');const decoder=new TextDecoder();let size=0,text='';try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Solicitud demasiado grande');text+=decoder.decode(value,{stream:true})}return JSON.parse(text+decoder.decode())}finally{await reader.cancel().catch(()=>{})}}
export function createHandler(env,fetcher=fetch){return async req=>{
 const origin=req.headers.get('origin');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!ORIGINS.has(origin))return reply({error:'Origen no permitido'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return reply({error:'Servicio pendiente de configuración'},503);
 const serverHeaders={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 async function rpc(actor,action,data){const r=await fetcher(url+'/rest/v1/rpc/soporte_compras_backend',{method:'POST',headers:serverHeaders,body:JSON.stringify({_actor:actor,_accion:action,_datos:data}),signal:AbortSignal.timeout(20000),redirect:'error'});const d=await r.json();if(!r.ok)throw Object.assign(Error(d.message||'No se pudo completar la operación'),{status:d.code==='42501'?403:409});return d;}
 try{
  const body=await jsonBounded(req,7300000);
  if(!body||Array.isArray(body)||typeof body!=='object')return reply({error:'Solicitud inválida'},400);
  if(body.action==='login'){
   const email=String(body.email||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply({error:'Revisa el correo'},400);
   const allowed=await rpc(null,'login',{email});
   if(allowed.allowed){const r=await fetcher(url+'/auth/v1/otp',{method:'POST',headers:serverHeaders,body:JSON.stringify({email,create_user:true}),signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)return reply({error:'No se pudo enviar el código. Espera un momento e intenta otra vez.'},429);}
   return reply({sent:true,message:'Si el correo está autorizado, recibirás un código de acceso.'});
  }
  if(!ACTIONS.has(body.action))return reply({error:'Acción inválida'},400);
  const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Ingresa con tu correo y código'},401);
  const auth=await fetcher(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!auth.ok)return reply({error:'Tu acceso venció. Ingresa nuevamente.'},401);
  const user=await auth.json();if(!UUID.test(user.id||'')||!user.email_confirmed_at)return reply({error:'Debes verificar el correo'},403);
  const data={...body,actor_email:user.email};delete data.action;delete data.image;
  if(body.action==='upload'){
   await rpc(user.id,'upload',data);
   if(!UUID.test(body.id||'')||typeof body.image!=='string'||body.image.length>7000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.image))return reply({error:'Captura inválida'},400);
   const bytes=Uint8Array.from(atob(body.image),x=>x.charCodeAt(0));
   if(bytes.length<4||bytes.length>5242880||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return reply({error:'Adjunta una imagen JPG válida de hasta 5 MB'},400);
   const path='soporte/'+body.id+'.jpg';
   const r=await fetcher(url+'/storage/v1/object/comprobantes/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'image/jpeg','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(25000),redirect:'error'});
   if(!r.ok){const d=await r.json();if(String(d.statusCode)!=='409'&&d.error!=='Duplicate')return reply({error:'No se pudo subir la captura. Intenta otra vez.'},503);}
   return reply({uploaded:true});
  }
  return reply(await rpc(user.id,body.action,data));
 }catch(e){const msg=String(e.message||'');const safe=/^(Acceso|Solo el administrador|No puedes|Revisa|Completa|El sorteo|El precio|La reserva|La solicitud|Las ventas|No hay|No se encontró|Un cartón|Esta gestión|Esta referencia|Adjunta|Precio no configurado)/.test(msg);return reply({error:safe?msg:'No se pudo confirmar la operación. Consulta la misma gestión antes de repetirla.'},e.status||503);}
};}
