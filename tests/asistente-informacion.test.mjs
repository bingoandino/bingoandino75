import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Assistant} from '../asistente/engine.js';
import {INFORMACION, contextoInformativo} from '../asistente/informacion.js';

test('preguntas cotidianas de horario reciben los datos confirmados sin registrar nada', () => {
  for (const q of ['A q hora es el sorteo?', 'A que ora juegan?', 'Horario', 'Que dias transmiten', 'Y los sábados?', 'Cuando comienza el bingo?']) {
    const engine = new Assistant({price: 888}); const before = structuredClone(engine.state);
    const out = engine.receive(q);
    assert.match(out[0].text, /lunes a sábado/); assert.match(out[0].text, /8:00 p\. m\./);
    assert.match(out[0].text, /Venezuela/); assert.match(out[0].text, /YouTube/);
    assert.deepEqual(engine.state, before);
  }
});
test('domingos y cambios se distinguen del horario habitual, sin prometer un vivo extra', () => {
  const engine = new Assistant({});
  for (const q of ['Y los domingos?', 'Hoy cambiaron la hora?']) {
    const out = engine.receive(q)[0].text;
    assert.match(out, /habitual/); assert.match(out, /cambio se anuncia/);
    assert.doesNotMatch(out, /domingo.*(?:sí|también|8:00)/i);
  }
});
test('bolitas y ganador se explican sin atribuirlos al modelo de IA', () => {
  for (const q of ['Como sacan las bolitas?', 'El bombo es real?', 'Las bolas salen por computadora?']) {
    assert.match(new Assistant({}).receive(q)[0].text, /en vivo de un bombo real/);
  }
  for (const q of ['Y como saben quien gana?', 'Quien detecta al ganador?', 'El sistema es automatico?']) {
    assert.match(new Assistant({}).receive(q)[0].text, /sistema es automático y detecta al ganador/);
  }
});
test('contexto tiene una única fuente de precio y nunca convierte ausencia en cero o ejemplo', () => {
  assert.match(INFORMACION.precioOrigen, /precio_carton/);
  for (const price of [undefined, null, '888', 0, -1, NaN, Infinity]) {
    const context = contextoInformativo(price); assert.equal(context.precioBs, null); assert.match(context.precioRegla, /no inventes/);
  }
  assert.equal(contextoInformativo(888).precioBs, 888); assert.equal(contextoInformativo(939).precioBs, 939);
});
