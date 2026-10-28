import {GENERALES, respuestaGeneralValida} from '../../../asistente/generales.js';
const ORIGIN = 'https://bingoandino75.com';

async function readJSON(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) throw Error('empty');
  let total = 0, raw = ''; const decoder = new TextDecoder();
  let timer;
  try {
    const deadline = new Promise((_, reject) => {timer = setTimeout(() => {reader.cancel().catch(() => {}); reject(new Error('timeout'));}, 2000);});
    const read = async () => {
      while (true) {
        const {done, value} = await reader.read(); if (done) break;
        total += value.length;
        if (total > maxBytes) {await reader.cancel(); throw Error('size');}
        raw += decoder.decode(value, {stream: true});
      }
      return JSON.parse(raw + decoder.decode());
    };
    return await Promise.race([read(), deadline]);
  } finally {clearTimeout(timer);}
}
export function createGeneralHandler(env, fetcher = (...args) => globalThis.fetch(...args)) {
  const cache = new Map();
  return async function handler(req) {
    const headers = {'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': ORIGIN, Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
    const json = (status, data) => Response.json(data, {status, headers});
    if (req.headers.get('origin') !== ORIGIN) return json(403, {error: 'origin'});
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (req.method !== 'POST') return json(405, {error: 'method'});
    let body;
    try {body = await readJSON(req, 256);} catch {return json(400, {error: 'invalid_request'});}
    // Solo enums. Un mensaje, archivo, historial o campo adicional se rechaza.
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'style,topic' ||
      typeof body.topic !== 'string' || !Object.hasOwn(GENERALES, body.topic) || !['normal', 'simple'].includes(body.style)) return json(400, {error: 'invalid_request'});
    const {topic, style} = body;
    const fallback = () => json(200, {answer: GENERALES[topic], source: 'respaldo'});
    if (['privacidad', 'soporte'].includes(topic) || env('BINGO_GENERIC_AI_DISABLED') === 'true') return fallback();
    const key = env('GEMINI_API_KEY'), url = env('SUPABASE_URL'), service = env('SUPABASE_SERVICE_ROLE_KEY');
    const ip = req.headers.get('cf-connecting-ip');
    if (!key || !url || !service || !ip) return fallback();
    try {
      const quota = await fetcher(url + '/rest/v1/rpc/rpc_asistente_consumir_cupo', {method: 'POST',
        headers: {apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json'},
        body: JSON.stringify({_origen: ip}), signal: AbortSignal.timeout(2500)});
      if (!quota.ok || await quota.json() !== true) return fallback();
      const cacheKey = topic + ':' + style, cached = cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return json(200, {answer: cached.answer, source: 'ia_cache'});
      const instructions = 'Eres un asistente virtual de atención general. Redacta una respuesta cordial, respetuosa y sencilla en español venezolano, con máximo ' + (style === 'simple' ? '24' : '38') + ' palabras y como máximo un emoji, únicamente 😊. No uses apodos como mi pana, mi amor o abuelito. No saludes de nuevo salvo que el tema sea saludo. Usa únicamente el hecho proporcionado; no añadas promesas, valoraciones ni funciones. Nunca solicites datos personales ni facilites ventas, apuestas, compras, pagos o premios. No incluyas enlaces, teléfonos, HTML ni datos nuevos. Para soporte, reconoce la solicitud sin decir que ya transferiste la conversación y sin hacer preguntas. Devuelve solo JSON con answer.';
      const upstream = await fetcher('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
        method: 'POST', redirect: 'error', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key},
        body: JSON.stringify({systemInstruction: {parts: [{text: instructions}]}, contents: [{role: 'user', parts: [{text: JSON.stringify({topic, fact: GENERALES[topic]})}]}],
          generationConfig: {maxOutputTokens: 512, responseMimeType: 'application/json', responseSchema: {type: 'OBJECT', properties: {answer: {type: 'STRING'}}, required: ['answer']}}, tools: []}),
        signal: AbortSignal.timeout(6500),
      });
      if (!upstream.ok) return fallback();
      const data = await readJSON(upstream, 32768), candidate = data.candidates?.[0];
      if (data.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') return fallback();
      const parts = candidate.content?.parts;
      if (!Array.isArray(parts) || parts.some(p => p.functionCall || p.executableCode)) return fallback();
      const parsed = JSON.parse(parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join(''));
      if (!parsed || Object.keys(parsed).length !== 1 || !respuestaGeneralValida(parsed.answer, topic)) return fallback();
      cache.set(cacheKey, {answer: parsed.answer.trim(), expires: Date.now() + 3600000});
      return json(200, {answer: parsed.answer.trim(), source: 'ia'});
    } catch {return fallback();}
  };
}
