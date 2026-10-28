// Datos confirmados por el administrador. No contienen datos de clientes ni pagos.
export const INFORMACION = Object.freeze({
  horario: 'De lunes a sábado a las 8:00 p. m., hora de Venezuela, en vivo por YouTube.',
  bolitas: 'Las bolitas se sacan en vivo de un bombo real.',
  ganador: 'El sistema es automático y detecta al ganador.',
  precioOrigen: 'Configuración del administrador: precio_carton. Nunca usar un precio de ejemplo.',
});

export function contextoInformativo(price) {
  const valid = typeof price === 'number' && Number.isFinite(price) && price > 0;
  return {...INFORMACION, precioBs: valid ? price : null,
    precioRegla: valid ? 'Este es el precio consultado en la configuración pública del administrador para esta prueba.' : 'No se pudo consultar el precio. Indícalo claramente; no inventes ningún monto.',
    excepciones: 'Es el horario habitual. No hay información confirmada sobre cambios, transmisiones extraordinarias, resultados o si el vivo ya comenzó.'};
}

// Recibe texto ya normalizado por el motor; nunca interpreta datos de registro.
export function respuestaInformativa(n) {
  const day = '(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)';
  const dayQuestion = new RegExp('\\b' + day + '\\b').test(n) &&
    (new RegExp('^(?:(?:el|los) )?' + day + '[.!?\\s]*$').test(n) || /[?]|jueg|transmi|sorteo|horario|bingo/.test(n));
  if (dayQuestion || /a\s+q(?:ue)?\s+h?ora|^(?:el )?horario[.!?\s]*$|(?:hora|horario).*(?:sorteo|bingo|vivo)|(?:cambi|hoy).*(?:hora|horario|transmi)|cuando.*(?:sorteo|bingo|empieza|comienza|juegan|juega)|(?:que|cuales|todos los).*dias.*(?:jueg|transmi|bingo|sorteo|vivo)/.test(n)) {
    const habitual = 'Nuestro horario habitual es de lunes a sábado, a las 8:00 p. m., hora de Venezuela, en vivo por YouTube 😊';
    return /domingo|cambi|extra|hoy|feriado/.test(n) ? habitual + ' Cualquier cambio se anuncia en la página.' : habitual;
  }
  if (/\b(?:bombo|bomba|bolitas|bolas|numeros)\b/.test(n) && /sac|sal|real|manual|vivo|automatic|sorte|maquina|computadora|fisic/.test(n)) return INFORMACION.bolitas + ' 😊';
  if (/quien.*(?:gana|ganador)|como.*(?:gana|ganador|detect|saben)|(?:ganador|sistema).*(?:automatic|detect|manual)|(?:automatic|detect).*(?:ganador|sistema)|hay que (?:cantar|avisar)|tengo que (?:cantar|avisar)/.test(n)) return INFORMACION.ganador + ' 😊';
  return null;
}
