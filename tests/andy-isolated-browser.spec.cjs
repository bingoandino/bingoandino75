// Tests browser real: Chrome desktop y viewport de teléfono; no consultan pagos ni compras.
// Los servicios externos de autenticación se simulan localmente en Playwright.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const url = 'http://127.0.0.1:8765/andy-estudio.html';
const cdn = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const verify = '**/functions/v1/verify-session';

async function authenticated(page, valid = true) {
  await page.addInitScript(() => {
    sessionStorage.setItem('admin_session_token', 'fake-session-for-browser-test');
    localStorage.setItem('admin_device_id', 'device-test-123');
  });
  await page.route(cdn, route => route.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:"mock.jwt"}},error:null})}})};'
  }));
  await page.route(verify, route => route.fulfill({
    status: 200, contentType:'application/json',
    body: JSON.stringify({valid, sameDevice:valid, expiresAt:'2099-01-01T00:00:00Z'})
  }));
}
for (const vp of [{width:1365,height:900,label:'desktop'},{width:390,height:844,label:'telefono'}]) {
  test('carga editor y exporta PNG en '+vp.label,async({page},testInfo)=>{
    await page.setViewportSize({width:vp.width,height:vp.height});
    await authenticated(page);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await expect(page.locator('#andy-gate-status')).toHaveText('Administrador verificado');
    await expect(page.locator('#tab-andy-estudio')).toBeVisible();
    await expect(page.locator('#andy-guardar')).toBeVisible();
    await page.locator('#andy-ideas').click();
    await expect(page.locator('#andy-cantidad')).toHaveText('6');
    await page.locator('#andy-nuevo').click();
    await page.locator('#andy-formato').selectOption('reel');
    await page.locator('#andy-titulo').fill('Somos familia binguera');
    await page.locator('#andy-mensaje').fill('Bombo real y comunidad');
    await page.locator('#andy-pie').fill('Una muestra de nuestra comunidad 💜');
    await page.locator('#andy-guardar').click();
    await page.locator('#andy-aprobar').click();
    await expect(page.locator('#andy-aprobados')).toHaveText('1');
    const dPromise=page.waitForEvent('download',{timeout:15000});
    await page.locator('#andy-descargar').click();
    const download=await dPromise;
    const file=await download.path();
    const data=fs.readFileSync(file);
    expect(data.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(data.readUInt32BE(16)).toBe(1080);
    expect(data.readUInt32BE(20)).toBe(1920);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(4);
    expect(errors).toEqual([]);
    await page.screenshot({path:'test-results/andy-'+vp.label+'.png',fullPage:true});
    await testInfo.attach('andy-'+vp.label,{path:'test-results/andy-'+vp.label+'.png',contentType:'image/png'});
  });
}
test('sin sesión la página muestra acceso restringido, no una pantalla en blanco',async({page})=>{
  await page.route(cdn,route=>route.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#andy-gate-error')).toBeVisible();
  await expect(page.locator('#tab-andy-estudio')).toBeHidden();
  await expect(page.getByRole('link',{name:/Volver al Bingo/i})).toBeVisible();
  await expect(page.locator('body')).toContainText('Inicia sesión');
});
test('si el servidor rechaza la sesión el editor permanece cerrado',async({page})=>{
  await authenticated(page,false);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#andy-gate-error')).toBeVisible();
  await expect(page.locator('#tab-andy-estudio')).toBeHidden();
});
test('el archivo de inicio del bingo no carga ANDY ni contiene el editor',async({page})=>{
  const response=await page.request.get('http://127.0.0.1:8765/index.html');
  expect(response.ok()).toBeTruthy();
  const html=await response.text();
  expect(html).not.toContain('andy-gate.js');
  expect(html).not.toContain('andy-studio.js');
  expect(html).not.toContain('tab-andy-estudio');
  expect(html).toContain('id="bienvenida"');
  expect(html).toContain('id="inscripcion"');
});
