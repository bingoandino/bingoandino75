const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const code = fs.readFileSync(path.join(__dirname, '..', 'marketing-tracker.js'), 'utf8');
function boot(url, referrer, prepare) {
  const dom = new JSDOM('<button class="inicio-comprar">Comprar</button><a href="https://wa.me/580000">WhatsApp</a>', {
    url, referrer, runScripts: 'outside-only'
  });
  const calls = [];
  dom.window.fetch = (_url, options) => {
    calls.push({ url: _url, data: JSON.parse(options.body) });
    return Promise.resolve({ ok: true });
  };
  dom.window.crypto.randomUUID = () => '11111111-1111-4111-8111-111111111111';
  if (prepare) prepare(dom.window);
  dom.window.eval(code);
  return { dom, calls };
}
test('registra visita y el origen Instagram sin PII', () => {
  const {dom,calls}=boot('https://bingoandino75.com/?utm_source=instagram&utm_campaign=octubre');
  assert.equal(calls.length,1);
  assert.equal(calls[0].data.tipo,'visita');
  assert.equal(calls[0].data.origen,'instagram');
  assert.equal(calls[0].data.campania,'octubre');
  assert.deepEqual(Object.keys(calls[0].data).sort(),['campania','origen','sesion_id','tipo']);
  dom.window.document.querySelector('.inicio-comprar').click();
  assert.equal(calls[1].data.tipo,'click_comprar');
  dom.window.document.querySelector('a').click();
  assert.equal(calls[2].data.tipo,'click_whatsapp');
  dom.window.document.querySelector('.inicio-comprar').click();
  assert.equal(calls.length,3);
  dom.window.close();
});
test('sin UTM ni referencia no atribuye artificialmente a Instagram',()=>{
 const {dom,calls}=boot('https://bingoandino75.com/');
 assert.equal(calls[0].data.origen,'desconocido');
 dom.window.close();
});
test('un admin con token previo no se cuenta',()=>{
 const {dom,calls}=boot('https://bingoandino75.com/',undefined,(window)=>{
  window.sessionStorage.setItem('admin_session_token','prueba');
 });
 assert.equal(calls.length,0);
 dom.window.close();
});
test('UTM malicioso no se guarda como campaña',()=>{
 const {dom,calls}=boot('https://bingoandino75.com/?utm_source=instagram&utm_campaign=%3Cscript%3E');
 assert.equal(calls[0].data.campania,null);
 dom.window.close();
});
