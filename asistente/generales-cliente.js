import {SUPABASE_URL, PUBLIC_KEY} from '../slot/config.js';
import {GENERALES, temaGeneral, respuestaGeneralValida} from './generales.js?v=20261028-ia-general-2';

export function crearConsultasGenerales(fetcher = (...args) => globalThis.fetch(...args)) {
  let lastTopic = null;
  const cache = new Map();
  return async function answer(input, step) {
    let topic = temaGeneral(input, step);
    if (!topic) return null;
    const style = topic === 'aclarar' ? 'simple' : 'normal';
    if (topic === 'aclarar' && lastTopic && lastTopic !== 'soporte') topic = lastTopic;
    lastTopic = topic;
    const key = topic + ':' + style;
    let text = GENERALES[topic];
    if (topic !== 'privacidad') {
      const saved = cache.get(key);
      if (saved && saved.expires > Date.now()) text = saved.text;
      else try {
        const response = await fetcher(SUPABASE_URL + '/functions/v1/asistente-generales', {
          method: 'POST', headers: {apikey: PUBLIC_KEY, Authorization: 'Bearer ' + PUBLIC_KEY, 'Content-Type': 'application/json'},
          body: JSON.stringify({topic, style}), signal: AbortSignal.timeout(8500),
        });
        if (response.ok) {
          const result = await response.json();
          if (respuestaGeneralValida(result.answer, topic)) {
            text = result.answer;
            cache.set(key, {text, expires: Date.now() + 300000});
          }
        }
      } catch { /* El respaldo local permite continuar sin bloquear el chat. */ }
    }
    const messages = [{type: 'text', text}];
    if (topic === 'soporte') messages.push({type: 'link', url: 'https://wa.me/584247221608', label: 'Escribir a soporte por WhatsApp'});
    return messages;
  };
}
export const responderConsultaGeneral = crearConsultasGenerales();
