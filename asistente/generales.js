// Temas públicos: jamás contiene mensajes o datos de un cliente.
import {INFORMACION} from './informacion.js';
export const GENERALES = Object.freeze({
  identidad: 'Soy el asistente virtual de BingoAndino75. Respondo consultas generales y puedo indicarte cómo contactar a soporte.',
  horario: 'Horario habitual: ' + INFORMACION.horario + ' Cualquier cambio se anuncia en la página.',
  bombo: INFORMACION.bolitas,
  ganador: INFORMACION.ganador,
  mecanica: INFORMACION.bolitas + ' ' + INFORMACION.ganador,
  soporte: 'Puedes contactar al equipo de soporte. No se ha transferido esta conversación a una persona.',
  privacidad: 'Para consultas generales enviamos a la IA solo el tema de la pregunta, nunca el mensaje original, nombres, cédulas, teléfonos ni captures.',
  saludo: 'Hola, con gusto te atiendo. Dime qué información necesitas.',
  gracias: 'A la orden. Aquí sigo pendiente si necesitas información.',
  aclarar: 'Vamos con calma. Dime qué parte de la información no quedó clara.',
});
const clean = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bq\b/g, 'que').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export function temaGeneral(input, step = 'welcome') {
  const n = clean(input);
  // No se enrutan ventas, registro, pagos ni cambios de datos al servicio de IA.
  if (/\b(?:compr\w*|carton\w*|pag\w*|referencia|cedula|telefono|banco|transfer\w*|deposit\w*|precio|costo|premios?|jugar|apuestas?|nombre)\b/.test(n)) return null;
  if (/privacidad|guardan.*datos|datos.*(?:protegen|seguros)|informacion personal/.test(n)) return 'privacidad';
  if (/hablar.*(?:persona|alguien|soporte|operador)|(?:quiero|necesito).*soporte|(?:ayude|atienda).*persona|^soporte$/.test(n)) return 'soporte';
  if (/quien eres|que eres|que es esto|que es eso|para que sirve|eres.*(?:bot|robot|persona|asistente)|con quien.*habl/.test(n)) return 'identidad';
  if (/como fun[cs]iona|de que se trata/.test(n)) return 'mecanica';
  if (/hora|horario|que dias|cuando.*(?:transmi|bingo|sorteo)|(?:sabados?|domingos?).*(?:transmi|bingo|sorteo)|^(?:y )?(?:los )?(?:sabados?|domingos?)$/.test(n)) return 'horario';
  if (/\b(?:bolitas|bolas|bombo|bomba)\b/.test(n) && /sac|real|manual|vivo|computadora|funcion|sal/.test(n)) return 'bombo';
  if (/como.*(?:ganador|gana|detect)|quien.*(?:gana|ganador)|sistema.*automatic/.test(n)) return 'ganador';
  if (!['welcome', 'paused', 'selfService', 'done'].includes(step)) return null;
  if (/^(?:hola|buenas|buenos dias|buenas tardes|buenas noches|epa|hola buenas)$/.test(n)) return 'saludo';
  if (/^(?:muchas )?gracias(?: por todo)?$/.test(n)) return 'gracias';
  if (/no entendi|no entiendo|explica.*(?:facil|sencillo|despacio)|mas (?:facil|corto|claro)|otra forma/.test(n)) return 'aclarar';
  return null;
}

export function respuestaGeneralValida(answer, topic) {
  if (typeof answer !== 'string' || !answer.trim() || answer.length > 400 || answer.trim().split(/\s+/).length > 42) return false;
  const n = clean(answer);
  if (/[<>]|https?:|www\.|\[[^\]]*\]\(/i.test(answer) || /\b(?:compr\w*|carton\w*|pag\w*|premios?|apuestas?|transfer\w*|deposit\w*|precio|dolares?|bolivares?|bs|contrasen\w*|cedula|clave|password)\b/.test(n)) return false;
  const emojis = answer.match(/\p{Extended_Pictographic}/gu) || [];
  if (emojis.length > 1 || emojis.some(emoji => emoji !== '😊') || /\b(?:mi pana|mi amor|abuelito|abuelita|viejito|viejita)\b/.test(n)) return false;
  const nums = answer.replace(/\bBingoAndino75\b/gi, 'BingoAndino').match(/\d+/g) || [];
  if (topic !== 'horario' && nums.length) return false;
  if (topic === 'horario' && (nums.some(x => !['8', '00'].includes(x)) || !/lunes a sabado/.test(n) || !/8 00 p m/.test(n) || !/venezuela/.test(n) || !/youtube/.test(n) || /domingo/.test(n))) return false;
  if (topic === 'bombo' && (!/bombo real/.test(n) || !/en vivo/.test(n))) return false;
  if (topic === 'ganador' && (!/automatic/.test(n) || !/detect/.test(n) || !/ganador/.test(n) || /segur|garant|infalible/.test(n))) return false;
  if (topic === 'mecanica' && (!/bombo real/.test(n) || !/automatic/.test(n) || !/ganador/.test(n))) return false;
  if (topic === 'identidad' && !/virtual/.test(n)) return false;
  if (topic === 'soporte' && (/[?]/.test(answer) || /ya.*(?:transfer|contact|avis)|te.*(?:comunico|paso)|en persona/.test(n))) return false;
  return Object.hasOwn(GENERALES, topic);
}
