export class InstagramError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function createInstagram(token, fetcher=fetch) {
  return async function graph(path, params={}) {
    if (!token) throw new InstagramError('Falta terminar la conexión segura con Instagram.',503);
    const url = new URL('https://graph.instagram.com/v25.0/'+path);
    for (const [k,v] of Object.entries(params)) if(v)url.searchParams.set(k,String(v));
    let res;
    try { res = await fetcher(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)}); }
    catch { throw new InstagramError('Instagram no respondió. Vuelve a cargar; el sorteo seguirá bloqueado.',502); }
    let data; try{data=await res.json();}catch{throw new InstagramError('Instagram devolvió una respuesta inválida.',502);}
    if (!res.ok || data.error) {
      const code = data.error?.code;
      const message = code===190?'La conexión de Instagram venció. Debe renovarse.':code===10||code===200?`Meta rechazó la consulta (código ${code}${Number.isInteger(data.error?.error_subcode)?`, subcódigo ${data.error.error_subcode}`:''}). Si continúa, verifica los permisos instagram_business_basic e instagram_business_manage_comments de @bingoandino75.`:code===4||code===613?'Instagram limitó temporalmente las consultas. Inténtalo más tarde.':'No se pudo consultar Instagram. Revisa la conexión y vuelve a cargar.';
      throw new InstagramError(message,502);
    }
    return data;
  };
}
export function page(data) {
  if(!Array.isArray(data.data))throw new InstagramError('Instagram no devolvió una lista válida.',502);
  const next = data.paging?.next ? data.paging?.cursors?.after : null;
  if(data.paging?.next && !next) throw new InstagramError('No se pudo continuar la descarga. Vuelve a cargar.',502);
  return {items:data.data,next:next||null};
}
