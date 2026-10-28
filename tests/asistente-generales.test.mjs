import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GENERALES, temaGeneral, respuestaGeneralValida} from '../asistente/generales.js';
import {crearConsultasGenerales} from '../asistente/generales-cliente.js';
import {createGeneralHandler} from '../supabase/functions/asistente-generales/handler.mjs';
const origin = 'https://bingoandino75.com';
const reply = 'Soy el asistente virtual. Con gusto respondo tus consultas generales 😊';
const provider = (answer = reply, extra = {}) => Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify({answer})}]}, ...extra}]});
function setup({env = {}, upstream, quota = true} = {}) {
  const calls = [], values = {GEMINI_API_KEY: 'gemini-test-secret', SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-test-secret', ...env};
  const handler = createGeneralHandler(n => values[n], async (url, options) => {
    calls.push({url, options, body: JSON.parse(options.body)});
    return url.includes('rpc_asistente') ? Response.json(quota) : (upstream ? upstream() : provider());
  });
  const request = (body = {topic: 'identidad', style: 'normal'}, headers = {}, method = 'POST') => handler(new Request('https://test/functions/v1/asistente-generales', {
    method, headers: {origin, 'cf-connecting-ip': '192.0.2.2', ...headers}, ...(method === 'POST' ? {body: JSON.stringify(body)} : {}),
  }));
  return {calls, request};
}
test('reconoce preguntas generales y excluye compras, pagos y datos de registro', () => {
  for (const [input, topic] of [['Q es esto?', 'identidad'], ['Como. Funciona', 'mecanica'], ['A q hora transmiten?', 'horario'], ['Como sacan las bolitas?', 'bombo'], ['Y como saben quien gana?', 'ganador'], ['Quiero hablar con una persona', 'soporte'], ['No entendi', 'aclarar']]) assert.equal(temaGeneral(input), topic, input);
  for (const input of ['Quiero comprar cartones', 'Referencia 123456', 'Nombre: María Pérez', 'No quiero comprar', 'Cuanto cuesta', 'Precio del carton', 'Como pago?', 'Mi cédula es 12345678']) assert.equal(temaGeneral(input), null, input);
  assert.equal(temaGeneral('No entendi', 'data'), null);
});
test('el cliente solo envía enums, aunque la pregunta contenga números o texto personal', async () => {
  let sent;
  const answer = crearConsultasGenerales(async (_, opts) => {sent = JSON.parse(opts.body); return Response.json({answer: reply});});
  const messages = await answer('Soy Ana 12345678. ¿Qué es esto?', 'welcome');
  assert.deepEqual(sent, {topic: 'identidad', style: 'normal'}); assert.equal(messages[0].text, reply);
  assert.doesNotMatch(JSON.stringify(sent), /Ana|12345678/);
});
test('aclaración retoma el último tema general y cache evita repetir solicitudes', async () => {
  const calls = [];
  const answer = crearConsultasGenerales(async (_, opts) => {calls.push(JSON.parse(opts.body)); return Response.json({answer: GENERALES.bombo});});
  await answer('Las bolitas se sacan en vivo?', 'welcome'); await answer('Explícame más fácil', 'welcome'); await answer('Explícame más fácil', 'welcome');
  assert.deepEqual(calls, [{topic: 'bombo', style: 'normal'}, {topic: 'bombo', style: 'simple'}]);
});
test('fallos y respuestas peligrosas mantienen respaldo local, soporte tiene contacto fijo', async () => {
  for (const fetcher of [async () => {throw Error('offline');}, async () => new Response(null, {status: 429}), async () => Response.json({answer: '<script>x</script>'})]) {
    const answer = crearConsultasGenerales(fetcher);
    assert.equal((await answer('Quien eres?', 'welcome'))[0].text, GENERALES.identidad);
    const support = await answer('Quiero hablar con soporte', 'welcome'); assert.equal(support[1].url, 'https://wa.me/584247221608'); assert.equal(support[1].label, 'Escribir a soporte por WhatsApp');
  }
});
test('privacidad se explica sin llamar a terceros y ventas nunca invocan IA', async () => {
  let calls = 0; const answer = crearConsultasGenerales(async () => {calls++; throw Error('unexpected');});
  assert.match((await answer('Como protegen la privacidad?', 'welcome'))[0].text, /solo el tema/);
  assert.equal(await answer('Quiero comprar', 'welcome'), null); assert.equal(calls, 0);
});
test('servidor rechaza texto libre, campos extra, prototipo y solicitudes grandes antes del proveedor', async () => {
  const {request, calls} = setup();
  for (const body of [{message: 'Mi cédula es 12345678'}, {topic: 'identidad', style: 'normal', message: 'Ana'}, {topic: '__proto__', style: 'normal'}, {topic: 'comprar', style: 'normal'}, {topic: 'identidad', style: 'x'}, {topic: 'a'.repeat(300), style: 'normal'}, null]) assert.equal((await request(body)).status, 400);
  assert.equal(calls.length, 0);
});
test('origen ajeno y métodos no admitidos no consumen cuota', async () => {
  const {request, calls} = setup(); assert.equal((await request(undefined, {origin: 'https://evil.test'})).status, 403);
  assert.equal((await request(undefined, {}, 'GET')).status, 405); assert.equal((await request(undefined, {}, 'OPTIONS')).status, 204); assert.equal(calls.length, 0);
});
test('cuota se consume antes de Gemini y no se envían secretos de Supabase a Google', async () => {
  const {request, calls} = setup(); const result = await (await request()).json(); assert.equal(result.source, 'ia');
  assert.match(calls[0].url, /rpc_asistente_consumir_cupo/); assert.deepEqual(calls[0].body, {_origen: '192.0.2.2'});
  assert.match(calls[1].url, /generativelanguage.googleapis.com/); assert.equal(calls[1].options.headers['x-goog-api-key'], 'gemini-test-secret');
  assert.doesNotMatch(JSON.stringify(calls[1].body), /server-test-secret|192\.0\.2\.2/); assert.deepEqual(calls[1].body.tools, []);
  assert.equal((await (await request()).json()).source, 'ia_cache'); assert.equal(calls.filter(c => c.url.includes('googleapis')).length, 1);
});
test('sin IP confiable, secreto, o con cupo agotado usa respaldo y no llama Gemini', async () => {
  for (const options of [{quota: false}, {env: {GEMINI_API_KEY: ''}}, {env: {BINGO_GENERIC_AI_DISABLED: 'true'}}]) {
    const {request, calls} = setup(options); assert.equal((await (await request()).json()).source, 'respaldo'); assert.equal(calls.some(x => x.url.includes('googleapis')), false);
  }
  const {request, calls} = setup(); assert.equal((await (await request(undefined, {'cf-connecting-ip': ''})).json()).source, 'respaldo'); assert.equal(calls.length, 0);
});
test('respuesta truncada, enlaces, herramientas o errores del proveedor no llegan al usuario', async () => {
  const outputs = [() => new Response(null, {status: 403}), () => provider(reply, {finishReason: 'MAX_TOKENS'}), () => provider('Visita https://evil.test'),
    () => Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{functionCall: {name: 'aprobar'}}]}}]}), () => new Response('x'.repeat(33000)), () => {throw Error('secret');}];
  for (const upstream of outputs) {
    const {request} = setup({upstream}); const result = await (await request()).json(); assert.equal(result.source, 'respaldo'); assert.equal(result.answer, GENERALES.identidad);
  }
});
test('no acepta precios, horarios inventados ni promesas nuevas de seguridad', async () => {
  for (const [topic, answer] of [['identidad', 'Compra un cartón y paga ahora'], ['horario', 'Transmitimos a las 9:00 p. m.'], ['ganador', 'El sistema automático detecta al ganador de forma muy segura']]) {
    const {request} = setup({upstream: () => provider(answer)}); assert.equal((await (await request({topic, style: 'normal'})).json()).source, 'respaldo');
  }
});
test('acepta la marca oficial y mantiene el trato profesional sin emojis de casino', () => {
  assert.equal(respuestaGeneralValida('Soy el asistente virtual de BingoAndino75 😊', 'identidad'), true);
  assert.equal(respuestaGeneralValida('Soy el asistente virtual. Mi número es 12345678.', 'identidad'), false);
  assert.equal(respuestaGeneralValida('Mi pana, las bolitas se sacan en vivo de un bombo real. 🎰', 'bombo'), false);
});
