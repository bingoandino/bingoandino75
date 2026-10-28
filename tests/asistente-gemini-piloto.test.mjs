import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CASES, createPilot} from '../herramientas/asistente-ia/gemini-prueba.mjs';
const answer = 'Soy un asistente virtual 😊 Cuéntame qué necesitas y vamos con calma.';
const provider = (text = answer, extra = {}) => Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify({answer: text})}]}, ...extra}]});
function setup(options = {}) {
  const calls = [];
  const run = createPilot({key: 'test-only-secret', model: 'gemini-test-model', enabled: true,
    fetcher: async (url, opts) => {calls.push({url, opts, body: JSON.parse(opts.body)}); return provider();}, ...options});
  return {calls, run};
}
test('piloto apagado por defecto; clave y modelo deben configurarse', async () => {
  assert.equal((await createPilot()('saludo')).reason, 'disabled');
  for (const opts of [{key: undefined}, {model: undefined}, {model: '../evil?key=x'}]) {
    const {calls, run} = setup(opts); assert.equal((await run('saludo')).reason, 'not_configured'); assert.equal(calls.length, 0);
  }
});
test('no admite entrada libre, objetos, rutas ni datos personales', async () => {
  const {calls, run} = setup();
  for (const input of ['Mi cédula es 12345678', '__proto__', 'constructor', {message: 'Hola', phone: '04121234567'}, null]) {
    assert.equal((await run(input)).reason, 'invalid_case');
  }
  assert.equal(calls.length, 0);
  assert.throws(() => CASES.saludo.push('dato externo'));
});
test('envía solo el caso sintético; secreto en cabecera, sin herramientas ni historial real', async () => {
  const {calls, run} = setup(); assert.equal((await run('identidad')).answer, answer);
  const {url, opts, body} = calls[0];
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent');
  assert.equal(opts.headers['x-goog-api-key'], 'test-only-secret'); assert.equal(opts.redirect, 'error');
  assert.doesNotMatch(url + opts.body, /test-only-secret|SUPABASE|service_role/);
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), ['Hola', 'Q es esto?']);
  assert.deepEqual(body.tools, []); assert.equal(body.generationConfig.responseMimeType, 'application/json');
});
test('límite de cinco solicitudes incluso en paralelo y sin reintentos', async () => {
  const {calls, run} = setup({maxCalls: 1000});
  const results = await Promise.all(Array.from({length: 10}, () => run('saludo')));
  assert.equal(calls.length, 5); assert.equal(results.filter(r => r.reason === 'limit').length, 5);
});
test('presupuesto inválido no habilita llamadas sin límite', async () => {
  for (const maxCalls of [NaN, Infinity, -1, '5']) {
    const {calls, run} = setup({maxCalls}); assert.equal((await run('saludo')).reason, 'limit'); assert.equal(calls.length, 0);
  }
});
test('no filtra mensajes de error, claves ni HTML del proveedor', async () => {
  for (const status of [401, 403, 429, 500]) {
    const {run} = setup({fetcher: async () => new Response('test-only-secret', {status})});
    const result = await run('saludo'); assert.equal(result.ok, false); assert.doesNotMatch(JSON.stringify(result), /test-only-secret/);
  }
});
test('bloqueo de seguridad o respuesta incompleta no se presenta como éxito', async () => {
  for (const finishReason of ['SAFETY', 'MAX_TOKENS', undefined]) {
    const {run} = setup({fetcher: async () => provider(answer, {finishReason})});
    assert.equal((await run('saludo')).reason, 'blocked_or_incomplete');
  }
});
test('rechaza enlaces, HTML, números y respuestas demasiado largas', async () => {
  for (const text of ['Visita https://evil.test', '<script>alert()</script>', 'Tu clave es 1234', 'compra ahora', 'palabra '.repeat(31)]) {
    const {run} = setup({fetcher: async () => provider(text)}); assert.equal((await run('saludo')).ok, false);
  }
});
test('petición de atención humana no termina en otra pregunta del bot', async () => {
  const {run} = setup({fetcher: async () => provider('¿En qué puedo ayudarte?')});
  assert.equal((await run('humano')).reason, 'unsafe_response');
});
test('rechaza herramientas, JSON inválido y cuerpos enormes', async () => {
  const responses = [new Response('invalid json'), new Response('x'.repeat(32769)),
    Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{functionCall: {name: 'aprobar'}}]}}]})];
  for (const response of responses) {
    const {run} = setup({fetcher: async () => response}); assert.equal((await run('saludo')).ok, false);
  }
});
test('timeout termina aunque la dependencia no atienda AbortSignal', async () => {
  const {run} = setup({timeoutMs: 10, fetcher: () => new Promise(() => {})});
  assert.equal((await run('saludo')).reason, 'timeout');
});
test('rechaza errores de red sin exponer sus detalles', async () => {
  const {run} = setup({fetcher: async () => {throw new Error('test-only-secret');}});
  assert.deepEqual(await run('saludo'), {ok: false, reason: 'unavailable'});
});
