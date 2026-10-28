import {CASES, DEFAULT_CASE_IDS, createPilot} from './gemini-prueba.mjs';

// Autorización temporal de 256 bits, solo su hash se incluye en el despliegue.
// No usar en el widget. No acepta mensajes, archivos ni datos de clientes.
export function createProtectedPilot({tokenHash = '', expiresAt = 0, env = () => undefined, now = Date.now, fetcher, model = 'gemini-3.5-flash-lite', caseIds = DEFAULT_CASE_IDS, loadPrice} = {}) {
  let consumed = false;
  const json = (status, data) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
  return async function handler(req) {
    if (!/^[a-f0-9]{64}$/.test(tokenHash) || !Number.isFinite(expiresAt) || now() >= expiresAt) return json(410, {ok: false, reason: 'disabled'});
    const token = req.headers.get('x-pilot-token') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return json(403, {ok: false, reason: 'forbidden'});
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const actual = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    let mismatch = 0;
    for (let i = 0; i < 64; i++) mismatch |= actual.charCodeAt(i) ^ tokenHash.charCodeAt(i);
    if (mismatch) return json(403, {ok: false, reason: 'forbidden'});
    if (req.method !== 'POST') return json(405, {ok: false, reason: 'method'});
    // El gateway puede representar un POST vacío como un stream vacío.
    if (req.body !== null) {
      const reader = req.body.getReader();
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        if (value.length) {await reader.cancel(); return json(400, {ok: false, reason: 'body_not_allowed'});}
      }
    }
    if (consumed) return json(409, {ok: false, reason: 'already_run'});
    consumed = true; // Bloquea concurrencia en esta instancia; caducidad y cierre protegen el resto.
    const key = env('GEMINI_API_KEY');
    if (!key) return json(503, {ok: false, reason: 'not_configured'});
    if (!Array.isArray(caseIds) || caseIds.length < 1 || caseIds.length > 5 || caseIds.some(id => typeof id !== 'string' || !Object.hasOwn(CASES, id))) return json(503, {ok: false, reason: 'invalid_cases'});
    let price;
    try {price = await loadPrice?.();} catch {price = undefined;}
    const run = createPilot({key, model, enabled: true, fetcher, price});
    const results = [];
    for (const id of caseIds) {
      const start = now();
      const result = await run(id);
      results.push({case: id, elapsedMs: now() - start, ...result});
      if (!result.ok) break;
    }
    return json(200, {ok: results.length === caseIds.length && results.every(x => x.ok), model, priceLoaded: typeof price === 'number' && Number.isFinite(price) && price > 0, results});
  };
}
