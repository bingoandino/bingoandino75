const encoder = new TextEncoder();
export const SESSION_SECONDS=12*60*60;
export const PASSWORD_ITERATIONS=100000;
export function hex(bytes){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function randomToken(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
export async function digest(value){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
async function hmac(value,pepper){if(!pepper||pepper.length<32)throw Error('Access secret unavailable');const k=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);return crypto.subtle.sign('HMAC',k,encoder.encode(value));}
export function validPassword(value){return typeof value==='string'&&value.length>=8&&value.length<=200;}
export async function passwordHash(password,salt,pepper){const material=await hmac(password,pepper);const key=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:PASSWORD_ITERATIONS},key,256));}
export function timingEqual(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let diff=a.length^b.length;for(let i=0;i<64;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0&&a.length===64;}
export async function verifyPassword(password,config,pepper){if(!validPassword(password)||!config?.salt||!config?.password_hash)return false;return timingEqual(await passwordHash(password,config.salt,pepper),config.password_hash);}
export function sessionValid(session,config,now=Date.now()){return !!session&&!!config?.password_hash&&session.revision===config.revision&&session.expires_at>now;}
export function sameOrigin(request){return request.headers.get('origin')===new URL(request.url).origin;}
export function operatorCookie(token,maxAge=SESSION_SECONDS){return `__Host-bingo_sorteos=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
export function isOwner(user,config){return !!user&&!!config&&user.userId===config.owner_id;}
export async function rateKey(ip,pepper){return hex(await hmac('rate:'+ip,pepper));}
