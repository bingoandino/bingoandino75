import {temaGeneral} from './generales.js?v=20261028-ia-general-2';
import {SUPABASE_URL, PUBLIC_KEY} from '../slot/config.js';
const text = text => ({type: 'text', text});
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
export const opcionesConsulta = () => ({type: 'consult-options'});
export function cedulaConsulta(value) {
  const raw = String(value || '').trim().replace(/^(?:mi\s+)?c[eé]dula\s*[:=-]?\s*/i, '').replace(/^[ve]\s*[-:]?\s*/i, '');
  return /^[\d.\s]{5,24}$/.test(raw) && /^\d{5,12}$/.test(raw.replace(/[.\s]/g, '')) ? raw.replace(/[.\s]/g, '') : null;
}
export function crearConsultasCompra(fetcher = (...args) => globalThis.fetch(...args)) {
  let awaiting = false, proofChoice = false, busy = false, lastRequest = -Infinity;
  function home() {awaiting = false; proofChoice = false; return [text('¿Qué necesitas revisar? Puedes tocar una opción o escribirme 😊'), opcionesConsulta()];}
  function begin() {awaiting = true; proofChoice = false; return [text('Claro 😊 Escríbeme solo tu cédula para consultar el estado. No necesito tu nombre ni datos bancarios.'), opcionesConsulta()];}
  function support() {awaiting = false; proofChoice = false; return [text('Puedes escribirle a soporte 😊 Esta conversación no se envía automáticamente.'), {type: 'link', url: 'https://wa.me/584247221608', label: 'Escribir a soporte por WhatsApp'}, opcionesConsulta()];}
  return {
    reset() {awaiting = false; proofChoice = false;},
    proof() {awaiting = false; proofChoice = true; return [text('El comprobante por sí solo no confirma una compra. ¿Quieres consultar una compra que ya hiciste?'), opcionesConsulta()];},
    async receive(input) {
      const n = norm(input);
      if (proofChoice && /^(si|si claro|claro|dale|ok|listo)$/.test(n)) return begin();
      if (n === 'volver al inicio' || (awaiting && /^(cancelar|no|no quiero|salir)$/.test(n))) return home();
      if (/^(escribir a soporte|ayuda con mi compra|soporte)$/.test(n)) return support();
      if (/^(consultar mi compra|corregir cedula|consultar otra cedula)$/.test(n)) return begin();
      const existing = /\b(?:ya compre|compre|ya pague|pague|hice (?:una |mi |la )?compra|realice (?:una |mi |la )?compra)\b/.test(n);
      const lookup = /(?:consultar|verificar|revisar|buscar|estado de|donde esta|donde estan|ver)\b.*\b(?:compra|carton|cartones)\b|^(?:mi compra|mi carton|mis cartones)$/.test(n);
      if (!awaiting && (existing || lookup)) return begin();
      if (!awaiting) return proofChoice ? home() : null;
      // Una pregunta general cambia de tema; nunca se interpreta como cédula.
      if (temaGeneral(input)) {awaiting = false; return null;}
      if (!/\d/.test(String(input)) && /\p{L}/u.test(String(input))) {
        awaiting = false;
        return [text('Dejamos la consulta de cédula 😊 Puedes consultar el estado de una compra o escribir a soporte.'), opcionesConsulta()];
      }
      const cedula = cedulaConsulta(input);
      if (!cedula) return [text('Revisa la cédula 😊 Mándame solo ese número, sin nombre, teléfono ni referencia.'), opcionesConsulta()];
      if (busy || Date.now() - lastRequest < 3000) return [text('Espera unos segundos antes de volver a consultar 😊'), opcionesConsulta()];
      busy = true; lastRequest = Date.now();
      try {
        const response = await fetcher(SUPABASE_URL + '/rest/v1/rpc/rpc_consultar_cartones_cedula?select=estado&limit=1000', {
          method: 'POST', headers: {apikey: PUBLIC_KEY, Authorization: 'Bearer ' + PUBLIC_KEY, 'Content-Type': 'application/json'},
          body: JSON.stringify({_cedula: cedula}), signal: AbortSignal.timeout(10000), cache: 'no-store', redirect: 'error',
        });
        if (!response.ok) throw Error('lookup');
        const rows = await response.json();
        if (!Array.isArray(rows) || rows.some(row => !row || typeof row.estado !== 'string' || Object.keys(row).some(key => key !== 'estado'))) throw Error('shape');
        let message;
        if (!rows.length) message = 'No encontramos compras registradas con esa cédula. Revisa que esté bien escrita 😊 Si ya pagaste, no vuelvas a pagar: escribe a soporte.';
        else {
          const statuses = new Set(rows.map(row => norm(row.estado)));
          if ([...statuses].some(status => !['aprobado', 'pendiente', 'rechazado'].includes(status))) message = 'Hay una compra registrada. Soporte puede ayudarte a revisar su estado.';
          else if (statuses.size > 1) message = 'Hay compras con distintos estados: ' + [...statuses].map(status => ({aprobado: 'aprobada', pendiente: 'pendiente de verificación', rechazado: 'rechazada'})[status]).join(' y ') + '.';
          else message = {aprobado: 'Tu compra aparece aprobada ✅', pendiente: 'Tu compra está pendiente de verificación 😊 Si ya pagaste, no repitas el pago.', rechazado: 'Tu compra aparece rechazada. Escribe a soporte para revisar el caso.'}[[...statuses][0]];
        }
        awaiting = false;
        return [text(message), opcionesConsulta()];
      } catch {return [text('No pude consultar el estado en este momento. Esto no significa que no haya una compra. Intenta más tarde o escribe a soporte; si ya pagaste, no repitas el pago.'), opcionesConsulta()];}
      finally {busy = false;}
    },
  };
}
