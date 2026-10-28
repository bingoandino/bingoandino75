import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProtectedPilot} from '../herramientas/asistente-ia/piloto-protegido.mjs';
const token = 'a'.repeat(64), tokenHash = createHash('sha256').update(token).digest('hex');
const request = (extra = {}) => new Request('https://test', {method: 'POST', headers: {'x-pilot-token': token}, ...extra});
function setup(extra = {}) {
  const calls = [];
  return {calls, handler: createProtectedPilot({tokenHash, expiresAt: Date.now() + 60000,
    env: () => 'server-secret', fetcher: async (url, opts) => {calls.push({url, opts}); return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify({answer: 'Con gusto, vamos con calma 😊'})}]}}]});}, ...extra})};
}
test('deshabilitado sin configuración, caducado y sin capacidad no llama proveedor', async () => {
  assert.equal((await createProtectedPilot()(request())).status, 410);
  for (const extra of [{expiresAt: 0}, {tokenHash: ''}]) {
    const {handler, calls} = setup(extra); assert.equal((await handler(request())).status, 410); assert.equal(calls.length, 0);
  }
  const {handler, calls} = setup();
  for (const headers of [{}, {'x-pilot-token': 'b'.repeat(64)}]) assert.equal((await handler(request({headers}))).status, 403);
  assert.equal(calls.length, 0);
});
test('rechaza cuerpos de clientes y métodos distintos', async () => {
  const {handler, calls} = setup();
  assert.equal((await handler(request({body: JSON.stringify({message: 'Mi nombre es Ana'})}))).status, 400);
  assert.equal((await handler(request({method: 'GET'}))).status, 405); assert.equal(calls.length, 0);
});
test('corre cinco casos fijos una vez por instancia sin revelar secretos', async () => {
  const {handler, calls} = setup();
  const responses = await Promise.all([handler(request()), handler(request())]);
  assert.deepEqual(responses.map(x => x.status).sort(), [200, 409]);
  const report = await responses.find(x => x.status === 200).json();
  assert.equal(report.ok, true); assert.equal(report.results.length, 5); assert.equal(calls.length, 5);
  assert.doesNotMatch(JSON.stringify(report), /server-secret/);
});
test('ausencia de secreto se informa sin intentar inferencia', async () => {
  const {handler, calls} = setup({env: () => undefined}); assert.equal((await handler(request())).status, 503); assert.equal(calls.length, 0);
});
test('POST con stream vacío del gateway se admite sin aceptar texto', async () => {
  const {handler, calls} = setup();
  assert.equal((await handler(request({body: ''}))).status, 200); assert.equal(calls.length, 5);
});
test('detiene lote al primer fallo sin reintentos', async () => {
  let count = 0;
  const {handler} = setup({fetcher: async () => {count++; return new Response(null, {status: 429});}});
  const report = await (await handler(request())).json(); assert.equal(count, 1); assert.equal(report.ok, false); assert.equal(report.results[0].reason, 'provider_limit');
});
