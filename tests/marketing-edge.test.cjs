const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/marketing-visit/index.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
}).outputText;

const session = '11111111-1111-4111-8111-111111111111';
const item = { sesion_id: session, tipo: 'visita', origen: 'instagram', campania: 'prueba' };

function setup({ enabled = true, quota = 1, up = true, dbStatus = 201, redis = true } = {}) {
  const events = [];
  let handle;
  const env = {
    MARKETING_TRACKING_ENABLED: enabled ? 'true' : 'false',
    MARKETING_REDIS_REST_URL: redis ? 'https://example-redis.upstash.io' : '',
    MARKETING_REDIS_REST_TOKEN: redis ? 'dummy-credential' : '',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-key',
  };
  const mockFetch = async (url, options) => {
    events.push({ url, options });
    if (String(url).startsWith('https://example-redis')) {
      if (!up) throw new Error('Redis down');
      return { ok: true, json: async () => ({ result: quota }) };
    }
    if (String(url).includes('/rest/v1/marketing_visitas')) return { status: dbStatus, ok: dbStatus >= 200 && dbStatus < 300 };
    throw new Error('unexpected fetch');
  };
  vm.runInNewContext(js, {
    Deno: { serve(fn) { handle = fn; }, env: { get(key) { return env[key]; } } },
    console, fetch: mockFetch, Request, Response, AbortSignal, TextDecoder, Uint8Array, Set, Number, Date, JSON, RegExp, Object,
  });
  function run(data = item, options = {}) {
    const url = 'https://example.supabase.co/functions/v1/marketing-visit';
    return handle(new Request(url, {
      method: options.method || 'POST',
      headers: {
        Origin: options.origin || 'https://bingoandino75.com',
        'Content-Type': options.contentType || 'application/json',
      },
      body: options.raw || JSON.stringify(data),
    }));
  }
  return { run, events };
}

test('captura desactivada por defecto no toca Supabase ni Redis', async () => {
  const e = setup({ enabled: false });
  assert.equal((await e.run()).status, 503);
  assert.equal(e.events.length, 0);
});

test('solo dominios propios; origen ajeno no puede escribir', async () => {
  const e = setup();
  assert.equal((await e.run(item, { origin: 'https://malicioso.example' })).status, 403);
  assert.equal(e.events.length, 0);
});

test('envía una métrica válida tras aprobar cuota global', async () => {
  const e = setup();
  const response = await e.run();
  assert.equal(response.status, 204);
  assert.equal(e.events.length, 2);
  assert.equal(e.events[0].url, 'https://example-redis.upstash.io');
  const evalArgs = JSON.parse(e.events[0].options.body);
  assert.equal(evalArgs[0], 'EVAL');
  assert.equal(evalArgs[2], 2);
  assert.equal(evalArgs[5], 80);
  assert.equal(evalArgs[6], 8000);
  const insert = JSON.parse(e.events[1].options.body);
  assert.deepEqual(Object.keys(insert).sort(), ['campania','origen','sesion_id','tipo']);
  assert.equal(insert.origen, 'instagram');
});

test('rechaza cuando se agota cuota sin tocar tabla de visitas', async () => {
  const e = setup({ quota: 0 });
  assert.equal((await e.run()).status, 429);
  assert.equal(e.events.length, 1);
});

test('falla cerrado si Redis no está configurado', async () => {
  const e = setup({ redis: false });
  assert.equal((await e.run()).status, 429);
  assert.equal(e.events.length, 0);
});

test('falla cerrado si Redis no responde', async () => {
  const e = setup({ up: false });
  assert.equal((await e.run()).status, 429);
  assert.equal(e.events.length, 1);
});

test('carga desproporcionada sin Content-Length también se rechaza', async () => {
  const e = setup();
  assert.equal((await e.run(item, { raw: 'x'.repeat(2000) })).status, 413);
  assert.equal(e.events.length, 0);
});

test('descarta entradas inválidas antes de solicitar cuota', async () => {
  const e = setup();
  assert.equal((await e.run({ ...item, tipo: 'robar_datos' })).status, 400);
  assert.equal(e.events.length, 0);
});

test('campos extra personales nunca llegan al almacenamiento', async () => {
  const e = setup();
  await e.run({ ...item, cedula: '12345678', telefono: '04140000000', banco: 'banco' });
  assert.equal(e.events.length, 2);
  const sent = JSON.parse(e.events[1].options.body);
  assert.equal(sent.cedula, undefined);
  assert.equal(sent.telefono, undefined);
  assert.equal(sent.banco, undefined);
});

test('registro duplicado no provoca error visible', async () => {
  const e = setup({ dbStatus: 409 });
  assert.equal((await e.run()).status, 204);
});
