import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPilot} from '../herramientas/asistente-ia/gemini-prueba.mjs';
test('Gemini recibe solo los hechos permitidos y el precio inyectado por el servidor', async () => {
  let body;
  const run = createPilot({key: 'test-key', model: 'gemini-test', enabled: true, price: 939,
    fetcher: async (_, opts) => {body = JSON.parse(opts.body); return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify({answer: 'El precio consultado es de 939 Bs.'})}]}}]});}});
  assert.equal((await run('precio')).ok, true);
  const instructions = body.systemInstruction.parts[0].text;
  assert.match(instructions, /lunes a sábado/); assert.match(instructions, /bombo real/); assert.match(instructions, /"precioBs":939/);
  assert.doesNotMatch(JSON.stringify(body), /test-key|service_role|nombre.*cédula/i);
});
test('un precio inventado por Gemini se rechaza', async () => {
 for (const invented of [400, 8]) {
  const run = createPilot({key: 'test-key', model: 'gemini-test', enabled: true, price: 939,
    fetcher: async () => Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify({answer: `El precio es de ${invented} Bs.`})}]}}]})});
  assert.deepEqual(await run('precio'), {ok: false, reason: 'unsafe_response'});
 }
});
