export const SUPABASE_URL='https://dbkixcpwirjwjvjintkr.supabase.co';
export const PUBLIC_KEY='sb_publishable__XuvzJpG8lgar0uxD7Jv4Q_HZCaYUaF';
export const ENDPOINT=SUPABASE_URL+'/functions/v1/instagram-sorteos';
const SESSION='bingo_instagram_operator',ADMIN='bingo_instagram_admin';
export function accessToken(){return sessionStorage.getItem(ADMIN)||sessionStorage.getItem(SESSION)||'';}
export function setOperator(value:string){sessionStorage.removeItem(ADMIN);sessionStorage.setItem(SESSION,value);}
export function setAdmin(value:string){sessionStorage.removeItem(SESSION);sessionStorage.setItem(ADMIN,value);}
export function clearSession(){sessionStorage.removeItem(SESSION);sessionStorage.removeItem(ADMIN);}
export async function api(body:Record<string,unknown>){const token=accessToken();const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLIC_KEY,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await r.json();if(!r.ok){if(r.status===401&&body.op!=='login'){clearSession();window.dispatchEvent(new Event('bingo-session-expired'));}throw Error(data.error||'No se pudo completar la solicitud.');}return data;}
export async function verifyOtp(email:string,code:string){const r=await fetch(SUPABASE_URL+'/auth/v1/verify',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,token:code,type:'email'})});const d=await r.json();if(!r.ok||!d.access_token)throw Error('No se pudo verificar el código. Revisa el correo e inténtalo de nuevo.');setAdmin(d.access_token);const session=await api({op:'session'});if(!session.owner){clearSession();throw Error('La cuenta no tiene acceso de administrador.');}}
