// Módulo independiente: no modifica el endpoint actual "slot-premios".
// Contrato: JWT de Supabase + autorización vigente de contraseña y código del correo del slot.
// Solo usa RPC de Fidelidad que no están disponibles para usuarios anónimos.
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_ID='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5';
const ORIGINS=new Set(['https://bingoandino75.com','https://www.bingoandino75.com']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const enc=new TextEncoder();
let hmacKey:CryptoKey|undefined;
function response(value:unknown,status=200,origin='https://bingoandino75.com'){
 return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',
 'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type',
 'Access-Control-Allow-Methods':'OPTIONS,POST','Vary':'Origin'}});
}
async function rest(path:string,method='GET',value?:unknown){
 const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{method,headers:{
  'apikey':SERVICE_KEY,'Authorization':'Bearer '+SERVICE_KEY,
  'Content-Type':'application/json','Cache-Control':'no-store'
 },body:value===undefined?undefined:JSON.stringify(value)});
 if(!r.ok)throw new Error('No fue posible comprobar Fidelidad con la base de datos.');
 return await r.json();
}
async function hashProof(v:string){
 if(!/^[a-f0-9]{64}$/.test(v))throw new Error('Debes ingresar nuevamente con contraseña y código del correo.');
 const b=await crypto.subtle.digest('SHA-256',enc.encode(v));
 return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function identity(v:string){
 hmacKey??=await crypto.subtle.importKey('raw',enc.encode(SERVICE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const b=await crypto.subtle.sign('HMAC',hmacKey,enc.encode(v));
 return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function claims(token:string){
 try{
  const data=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  if(data.sub!==ADMIN_ID||data.role!=='authenticated'||!UUID.test(data.session_id||''))throw Error();
  return data;
 }catch{throw new Error('Sesión inválida. Vuelve a ingresar al tragamonedas.');}
}
async function authorized(token:string,proof:string){
 const ur=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{
  'apikey':SERVICE_KEY,'Authorization':'Bearer '+token}});
 if(!ur.ok)throw new Error('La sesión venció. Vuelve a entrar al tragamonedas.');
 const user=await ur.json();
 if(user.id!==ADMIN_ID||!user.email_confirmed_at)throw new Error('Acceso exclusivo del administrador.');
 const session=claims(token);
 const rows=await rest('slot_accesos?proof_hash=eq.'+await hashProof(proof)
  +'&owner_id=eq.'+ADMIN_ID+'&select=auth_session_id,authorized_until');
 if(rows.length!==1||rows[0].auth_session_id!==session.session_id||
  !rows[0].authorized_until||Date.parse(rows[0].authorized_until)<=Date.now()){
  throw new Error('Ingresa nuevamente al tragamonedas con contraseña y código del correo.');
 }
}
const validSaturday=(s:unknown)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s))&&new Date(s+'T12:00:00Z').getUTCDay()===6;
Deno.serve(async req=>{
 const origin=req.headers.get('Origin');
 const selected=origin&&ORIGINS.has(origin)?origin:'https://bingoandino75.com';
 if(origin&&!ORIGINS.has(origin))return response({error:'Origen no autorizado.'},403,selected);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'Access-Control-Allow-Origin':selected,'Access-Control-Allow-Headers':'authorization,apikey,content-type',
  'Access-Control-Allow-Methods':'OPTIONS,POST','Vary':'Origin'}});
 if(req.method!=='POST')return response({error:'Método no permitido.'},405,selected);
 try{
  const raw=await req.text();if(raw.length>1800) return response({error:'Solicitud inválida.'},413,selected);
  const data=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data)||!validSaturday(data.sabado)){
   return response({error:'Selecciona un sábado válido.'},400,selected);
  }
  const bearer=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!bearer)return response({error:'Debes iniciar sesión.'},401,selected);
  await authorized(bearer,data.slotAccess);
  if(data.action==='estado'){
   const state=await rest('rpc/fidelidad_estado','POST',{_sabado:data.sabado});
   if(state.ready&&Array.isArray(state.participants)){
    const participants=[];
    for(const item of state.participants){
     participants.push({name:item.name,ticket:String(item.ticket),personId:await identity(String(item.cedula))});
    }
    return response({ready:true,fecha:state.fecha,participants,winners:state.winners||[],
     cantidad:participants.length},200,selected);
   }
   return response({ready:false,fecha:data.sabado,faltan:state.faltan||[],error:state.error||'Información incompleta.'},200,selected);
  }
  if(data.action==='girar'){
   if(!UUID.test(data.drawId||'')||typeof data.premio!=='string'||!data.premio.trim()||
      data.premio.trim().length>60)return response({error:'Identificador o premio inválido.'},400,selected);
   const winner=await rest('rpc/fidelidad_girar','POST',{
    _sabado:data.sabado,_giro:data.drawId,_premio:data.premio.trim()
   });
   return response({winner},200,selected);
  }
  return response({error:'Acción desconocida.'},400,selected);
 }catch(e){
  const message=e instanceof Error?e.message:'No se pudo completar la operación.';
  const safe=/^(Debes|Ingresa|La sesión|Sesión inválida|Acceso exclusivo|No fue posible)/.test(message);
  return response({error:safe?message:'No se pudo completar Fidelidad. Actualiza y revisa la conexión.'},
    safe&&/sesión|Ingresa|Debes/.test(message)?401:503,selected);
 }
});