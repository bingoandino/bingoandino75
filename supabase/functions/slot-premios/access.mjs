import {SlotError} from './core.mjs';
const ADMIN_ID='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createAccessGate({base,key,fetcher,db,now}){
 const time=()=>Date.parse(now());
 async function digest(value){if(!/^[a-f0-9]{64}$/.test(value||''))throw new SlotError('Ingresa nuevamente con contraseña y código del correo.',401);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function claims(token,user){try{const part=token.split('.')[1];const c=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));if(c.sub!==user.id||c.role!=='authenticated'||!UUID.test(c.session_id||''))throw Error();return c;}catch{throw new SlotError('Sesión no válida. Ingresa nuevamente.',401);}}
 async function begin(payload){
  if(typeof payload.email!=='string'||payload.email.length>100||typeof payload.password!=='string'||!payload.password||payload.password.length>100)throw new SlotError('Correo o contraseña no válidos.',401);
  const r=await fetcher(base+'/functions/v1/admin-auth',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({action:'verify_credentials',email:payload.email.trim().toLowerCase(),password:payload.password,deviceId:'slot-login'})});
  if(!r.ok)throw new SlotError('Correo o contraseña incorrectos. Intenta de nuevo.',r.status===429?429:401);
  const verified=await r.json();if(verified.valid!==true)throw new SlotError('Correo o contraseña incorrectos.',401);
  const proof=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const expires=new Date(time()+10*60*1000).toISOString();
  await db('slot_accesos','POST',{proof_hash:await digest(proof),owner_id:ADMIN_ID,created_at:now(),challenge_expires_at:expires,auth_session_id:null,authorized_until:null});
  return {passwordProof:proof,expiresAt:expires};
 }
 async function row(proof,user){const hash=await digest(proof);const rows=await db('slot_accesos?proof_hash=eq.'+hash+'&owner_id=eq.'+user.id+'&select=*');if(!rows.length)throw new SlotError('Ingresa primero la contraseña y luego el código del correo.',401);return rows[0];}
 async function authorize(payload,user,token){
  const c=claims(token,user),r=await row(payload.passwordProof,user);
  if(r.auth_session_id){if(r.auth_session_id!==c.session_id||Date.parse(r.authorized_until)<=time())throw new SlotError('Esta autorización ya se usó o venció. Ingresa nuevamente.',401);return {authorizedUntil:r.authorized_until};}
  if(Date.parse(r.challenge_expires_at)<=time())throw new SlotError('La verificación de contraseña venció. Ingresa nuevamente.',401);
  const issued=Math.floor(Date.parse(r.created_at)/1000);
  if(!Array.isArray(c.amr)||!c.amr.some(x=>x.method==='otp'&&Number.isSafeInteger(x.timestamp)&&x.timestamp>=issued&&x.timestamp<=Math.floor(time()/1000)+30))throw new SlotError('Verifica un código del correo después de ingresar la contraseña.',401);
  const until=new Date(time()+8*60*60*1000).toISOString();
  const saved=await db('slot_accesos?proof_hash=eq.'+r.proof_hash+'&owner_id=eq.'+user.id+'&auth_session_id=is.null','PATCH',{auth_session_id:c.session_id,authorized_until:until});
  if(!saved.length)throw new SlotError('La autorización cambió. Ingresa nuevamente.',409);
  return {authorizedUntil:until};
 }
 async function check(user,token,proof){const c=claims(token,user),r=await row(proof,user);if(r.auth_session_id!==c.session_id||!r.authorized_until||Date.parse(r.authorized_until)<=time())throw new SlotError('Completa contraseña y código del correo para entrar a la ruleta.',401);return r;}
 async function revoke(user,token,proof){const r=await check(user,token,proof);await db('slot_accesos?proof_hash=eq.'+r.proof_hash+'&owner_id=eq.'+user.id,'PATCH',{authorized_until:now()});return {signedOut:true};}
 return {begin,authorize,check,revoke};
}
