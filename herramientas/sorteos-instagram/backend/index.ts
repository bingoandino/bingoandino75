import {createHandler} from './handler.mjs';
const base=Deno.env.get('SUPABASE_URL')!;
const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const pubs=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
const serverKey=secrets.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey=pubs.default||Deno.env.get('SUPABASE_ANON_KEY')!;
async function rpc(action:string,payload:unknown={}){
 const headers:Record<string,string>={'Content-Type':'application/json',apikey:serverKey};if(serverKey.startsWith('eyJ'))headers.Authorization='Bearer '+serverKey;
 const r=await fetch(base+'/rest/v1/rpc/instagram_sorteos_backend',{method:'POST',headers,body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Backend unavailable');return await r.json();
}
async function authUser(token:string){const r=await fetch(base+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});return r.ok?await r.json():null;}
async function sendOtp(email:string){const r=await fetch(base+'/auth/v1/otp',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:false}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('OTP unavailable');}
Deno.serve(createHandler({rpc,authUser,sendOtp}));
