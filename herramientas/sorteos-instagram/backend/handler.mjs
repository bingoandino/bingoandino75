import {createInstagram,page,InstagramError} from './instagram.mjs';
import {verifyPassword,validPassword,passwordHash,randomToken,digest,rateKey} from './access-core.mjs';
const OWNER_EMAIL='bingoandino75@gmail.com';
const ORIGINS=new Set(['https://bingoandino75.com','https://www.bingoandino75.com','https://bingoandino.github.io']);
export function createHandler({rpc,authUser,sendOtp,rotateInstagramToken=async()=>{throw Error('Not configured')},fetcher=fetch,allowOrigins=ORIGINS}){
 return async function handler(request){
  const origin=request.headers.get('origin');const cors=origin&&allowOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  const reply=(body,status=200,extra={})=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
  if(origin&&!allowOrigins.has(origin))return reply({error:'Origen no autorizado.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'authorization,content-type,apikey','Access-Control-Max-Age':'600'}});
  if(request.method!=='POST')return reply({error:'Usa POST.'},405);
  try{
   const text=await request.text();if(text.length>16000)return reply({error:'Solicitud demasiado grande.'},413);
   const b=JSON.parse(text),op=b.op;if(!op||typeof op!=='string')return reply({error:'Solicitud inválida.'},400);
   if(op==='status')return reply(await rpc('status'));
   if(op==='migration_import'){
    if(origin)return reply({error:'Acción no permitida desde el navegador.'},403);
    const ticket=request.headers.get('X-Migration-Key');if(!ticket||ticket.length!==96)return reply({error:'No autorizado.'},401);
    if(typeof b.instagram_token!=='string'||b.instagram_token.length<50||typeof b.pepper!=='string'||b.pepper.length<32||typeof b.password_hash!=='string'||!/^[a-f0-9]{64}$/.test(b.password_hash)||typeof b.salt!=='string'||b.salt.length<16)return reply({error:'Configuración inválida.'},400);
    await rpc('import',{ticket_hash:await digest(ticket),instagram_token:b.instagram_token,pepper:b.pepper,password_hash:b.password_hash,salt:b.salt});return reply({ok:true});
   }
   const c=await rpc('config');
   const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
   const limited=async(prefix)=>{const ip=request.headers.get('x-forwarded-for')||request.headers.get('cf-connecting-ip')||'unknown';return (await rpc('rate',{bucket:prefix+await rateKey(ip,c.pepper)})).allowed;};
   const admin=async()=>{if(!token.includes('.'))return false;const u=await authUser(token);return !!u&&u.id===c.owner_id;};
   const session=async()=>/^[a-f0-9]{64}$/.test(token)&&(await rpc('session_check',{token_hash:await digest(token)})).valid;
   if(op==='login'){
    if(!await limited('login:'))return reply({error:'Demasiados intentos. Espera 15 minutos.'},429,{'Retry-After':'900'});
    if(!await verifyPassword(b.password,c,c.pepper))return reply({error:'Contraseña incorrecta.'},401);
    const accessToken=randomToken();const created=await rpc('session_create',{token_hash:await digest(accessToken),revision:c.revision});
    if(!created.ok)return reply({error:'La contraseña cambió. Vuelve a entrar.'},401);
    return reply({token:accessToken,expiresIn:43200});
   }
   if(op==='admin_otp'){
    if(!await limited('admin:'))return reply({error:'Demasiados intentos. Espera 15 minutos.'},429);
    if(String(b.email||'').trim().toLowerCase()!==OWNER_EMAIL)return reply({error:'Usa el correo del administrador del bingo.'},403);
    await sendOtp(OWNER_EMAIL);return reply({ok:true});
   }
   const owner=await admin();
   if(op==='session')return reply({authorized:owner||await session(),owner});
   if(op==='instagram_connect'){
    if(!owner)return reply({error:'Solo el administrador verificado por correo puede reconectar Instagram.'},403);
    if(!await limited('instagram-connect:'))return reply({error:'Demasiados intentos. Vuelve a intentarlo en 15 minutos.'},429);
    const fresh=b.instagram_token;
    if(typeof fresh!=='string'||fresh.length<50||fresh.length>4096||/\s/.test(fresh))return reply({error:'El token de Instagram es inválido. No se modificó la conexión anterior.'},400);
    try {
     const freshGraph=createInstagram(fresh,fetcher);
     const me=await freshGraph('me',{fields:'id,username'});
     if(!/^[0-9]{5,30}$/.test(String(me.id||''))||String(me.username||'').toLowerCase()!=='bingoandino75')
      return reply({error:'El token no corresponde a @bingoandino75. No se guardó.'},400);
     const publications=page(await freshGraph(me.id+'/media',{fields:'id,permalink,comments_count',limit:1}));
     if(!publications.items.length)return reply({error:'Se verificó el perfil, pero Meta no permitió comprobar publicaciones. No se guardó.'},400);
     page(await freshGraph(publications.items[0].id+'/comments',{fields:'id,text,username,timestamp,hidden',limit:1}));
     await rotateInstagramToken(fresh);
     return reply({ok:true,message:'¡Instagram conectado! Se verificaron el perfil, las publicaciones y los comentarios de @bingoandino75.'});
    }catch(err){
     return reply({error:(err instanceof InstagramError?err.message:'No se pudo guardar la conexión. La autorización anterior se mantiene.')},502);
    }
   }
   if(op==='password'){
    if(!owner)return reply({error:'Solo el administrador puede cambiar la contraseña.'},403);
    if(!validPassword(b.password))return reply({error:'La contraseña debe tener entre 8 y 200 caracteres.'},400);
    if(b.password!==b.confirmation)return reply({error:'Las contraseñas no coinciden.'},400);
    const salt=randomToken(),hash=await passwordHash(b.password,salt,c.pepper);
    await rpc('password',{owner_id:c.owner_id,password_hash:hash,salt});return reply({ok:true});
   }
   if(op==='logout'){if(/^[a-f0-9]{64}$/.test(token))await rpc('logout',{token_hash:await digest(token)});return reply({ok:true});}
   if(!owner&&!await session())return reply({error:'Ingresa la contraseña para acceder al sorteo.'},401);
   if(op!=='instagram')return reply({error:'Solicitud inválida.'},400);
   const after=b.after;if(after&&(typeof after!=='string'||after.length>4000))return reply({error:'Cursor inválido.'},400);
   const graph=createInstagram(c.instagram_token,fetcher);
   // Diagnóstico de lectura solo después de validar la sesión de sorteos.
   if(b.action==='diagnose'){
    let stage='perfil';
    try{
     const me=await graph('me',{fields:'id,username'});
     if(!/^[0-9]{5,30}$/.test(String(me.id||'')))return reply({ok:false,stage:'perfil',message:'Instagram no devolvió el identificador de la cuenta conectada.'});
     if(String(me.username||'').toLowerCase()!=='bingoandino75')return reply({ok:false,stage:'cuenta',message:'Instagram está conectado a otra cuenta. Hay que autorizar @bingoandino75.'});
     stage='publicaciones';
     const mediaPage=page(await graph(me.id+'/media',{fields:'id,permalink,timestamp,caption,comments_count,username',limit:1}));
     if(!mediaPage.items.length)return reply({ok:true,stage:'publicaciones',message:'Conexión y lectura de publicaciones correctas. No hay publicaciones para comprobar comentarios.'});
     stage='comentarios';
     page(await graph(mediaPage.items[0].id+'/comments',{fields:'id,text,username,timestamp,hidden',limit:1}));
     return reply({ok:true,stage:'comentarios',message:'Conexión correcta con @bingoandino75: publicaciones y comentarios accesibles.'});
    }catch(err){
     if(err instanceof InstagramError)return reply({ok:false,stage,message:err.message});
     throw err;
    }
   }
   if(b.action==='media'){
    // Resolver el identificador de cuenta desde el token evita usar un ID fijo que puede no coincidir.
    const me=await graph('me',{fields:'id,username'});
    if(!/^[0-9]{5,30}$/.test(String(me.id||'')))return reply({error:'Instagram no devolvió el identificador de la cuenta conectada.'},502);
    if(String(me.username||'').toLowerCase()!=='bingoandino75')return reply({error:'La cuenta conectada no es @bingoandino75. Vuelve a autorizar la cuenta del bingo.'},403);
    return reply(page(await graph(me.id+'/media',{fields:'id,permalink,timestamp,caption,comments_count,username',limit:100,after})));
   }
   if(b.action==='comments'&&typeof b.media==='string'&&/^\d{5,30}$/.test(b.media)){
    const media=await graph(b.media,{fields:'id,username,permalink,comments_count'});
    if(String(media.username).toLowerCase()!=='bingoandino75')return reply({error:'Solo se admiten publicaciones de @bingoandino75.'},403);
    // Older clients still receive one page; new clients group up to five pages per request.
    const maxPages=b.batch===true?5:1,started=Date.now(),seen=new Set(after?[after]:[]);
    let cursor=after,items=[],pages=0,withFrom=false;
    const hasAuthor=(comment)=>typeof (comment.username||comment.from?.username)==='string'&&String(comment.username||comment.from?.username).trim().length>0;
    do{
     let current=page(await graph(b.media+'/comments',{fields:withFrom?'id,text,username,from,timestamp,hidden':'id,text,username,timestamp,hidden',limit:100,after:cursor}));
     if(current.items.some(comment=>!hasAuthor(comment))){
      // Algunos accesos de Instagram omiten "username" aunque entreguen id y texto.
      // Solo intentamos "from" como alternativa; no inventamos autores ni alteramos oportunidades.
      if(!withFrom){
       try{
        const alternative=page(await graph(b.media+'/comments',{fields:'id,text,username,from,timestamp,hidden',limit:100,after:cursor}));
        current=alternative;withFrom=true;
       }catch(err){
        if(!(err instanceof InstagramError))throw err;
       }
      }
      const missing=current.items.filter(comment=>!hasAuthor(comment)).length;
      if(missing){
       console.warn('instagram-sorteos: comentarios sin autor',JSON.stringify({total:current.items.length,missing}));
       throw new InstagramError('Instagram entregó comentarios, pero no devolvió el nombre de sus autores ('+missing+' de '+current.items.length+' en esta página). No se puede elegir un ganador justo. Revisa los permisos de lectura de autores en Meta o usa la conexión con Facebook. No se guardaron participantes parciales.',422);
      }
     }
     items.push(...current.items.map(comment=>comment.username?comment:{...comment,username:comment.from?.username}));pages++;
     if(current.next&&seen.has(current.next))throw new InstagramError('Instagram repitió una página. Vuelve a cargar.',502);
     if(current.next)seen.add(current.next);cursor=current.next;
    }while(cursor&&pages<maxPages&&Date.now()-started<8000);
    return reply({items,next:cursor,pages,media});
   }
   return reply({error:'Solicitud inválida.'},400);
  }catch(e){return reply({error:e instanceof InstagramError?e.message:'No se pudo completar la solicitud. Inténtalo de nuevo.'},e instanceof InstagramError?e.status:503);}
 };
}
