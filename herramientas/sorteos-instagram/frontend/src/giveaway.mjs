export function reelCode(value) {
  let u; try { u = new URL(value); } catch { throw new Error('Pega un enlace válido de Instagram.'); }
  if (!['instagram.com','www.instagram.com'].includes(u.hostname) || u.protocol !== 'https:') throw new Error('El enlace debe ser de Instagram.');
  const m = u.pathname.match(/^\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)\/?$/);
  if (!m) throw new Error('Usa el enlace de una publicación o reel.');
  return m[1];
}
// A mention is written text, not proof that an Instagram account exists.
export function taggedAccounts(text, excluded=[]) {
  const blocked=new Set(excluded.map(x=>String(x).replace(/^@/,'').toLowerCase()));
  const accounts=new Set();
  const pattern=/(?:^|[^A-Za-z0-9_.@])@([A-Za-z0-9_][A-Za-z0-9_.]{0,29})(?![A-Za-z0-9_.@])/g;
  for(const match of String(text||'').matchAll(pattern)){
    const name=match[1].replace(/\.+$/,'').toLowerCase();
    if(name&&!name.includes('..')&&!blocked.has(name))accounts.add(name);
  }
  return [...accounts].sort();
}
export function modeLabel(mode){return mode==='person'?'Una oportunidad por persona':mode==='unique_tags'?'Comentarios diferentes · Mínimo 3 etiquetas':'Una oportunidad por cada comentario';}
export function eligible(comments, mode, owner='bingoandino75') {
  const ids = new Set(), people = new Set(), combinations = new Set(), result=[];
  for (const c of comments) {
    const username = String(c.username || c.from?.username || '').trim().replace(/^@/, '');
    const key = username.toLowerCase();
    if (!c.id || ids.has(c.id)) continue;
    ids.add(c.id);
    if (!username || c.hidden || key === owner.toLowerCase()) continue;
    if (mode === 'person' && people.has(key)) continue;
    if (mode === 'unique_tags') {
      const tags=taggedAccounts(c.text,[key,owner]);
      if(tags.length<3)continue;
      const signature=JSON.stringify([key,tags]);
      if(combinations.has(signature))continue;
      combinations.add(signature);
    }
    people.add(key); result.push({...c, username});
  }
  return result;
}
export function randomIndex(n, random=globalThis.crypto) {
  if (!Number.isSafeInteger(n) || n < 1 || n > 0x100000000) throw new Error('No hay participantes válidos.');
  const limit = Math.floor(0x100000000/n)*n, a = new Uint32Array(1);
  do { random.getRandomValues(a); } while(a[0] >= limit);
  return a[0]%n;
}
export async function fingerprint(comments, mode, url) {
  const normalized = comments.map(c=>[c.id,c.username,c.text]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({comments:normalized,mode,url})));
  return Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
}

export function validateDownload(comments, reportedCount) {
  if (!comments.length && reportedCount > 0) throw new Error('Instagram registra '+reportedCount.toLocaleString('es-VE')+' comentarios, pero Meta no entregó ninguno. Revisa que la app de Meta esté publicada y tenga acceso a comentarios reales. El sorteo permanece bloqueado.');
  return comments;
}
