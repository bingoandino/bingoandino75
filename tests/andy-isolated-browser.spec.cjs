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
    body: `window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:"mock.jwt"}},error:null})}})};`
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
    await expect(page.locator('#andy-gate-status')).toContainText(/Administrador verificado|ANDY listo/);
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
// El editor de sorteos debe ocupar solo un botón hasta que se solicite abrirlo.
for (const vp of [{width:1365,height:900,label:'desktop'},{width:390,height:844,label:'telefono'}]) {
  test('preparar imagen de sorteo abre y cierra opciones en '+vp.label,async({page})=>{
    await page.setViewportSize({width:vp.width,height:vp.height});
    await authenticated(page);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await expect(page.locator('#tab-andy-estudio')).toBeVisible();
    const open=page.getByRole('button',{name:'Preparar imagen de sorteo'});
    await expect(open).toBeVisible();
    await expect(open).toHaveAttribute('aria-expanded','false');
    await expect(page.locator('#andy-sd-panel')).toBeHidden();
    await expect(page.locator('#andy-sd-fecha')).toBeHidden();
    await open.click();
    await expect(open).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#andy-sd-fecha')).toBeVisible();
    await expect(page.locator('#andy-sd-pozo-manual')).toBeVisible();
    await page.locator('#andy-sd-pozo-manual').fill('125');
    await open.click();
    await expect(page.locator('#andy-sd-panel')).toBeHidden();
    await expect(open).toBeVisible();
    await open.click();
    await expect(page.locator('#andy-sd-pozo-manual')).toHaveValue('125');
    expect(errors).toEqual([]);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(4);
  });
}
test('enlace directo presenta su propio login incluso sin sesión anterior',async({page})=>{
  await page.route(cdn,route=>route.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#andy-login-form')).toBeVisible();
  await expect(page.locator('#andy-login-email')).toBeVisible();
  await expect(page.locator('#andy-login-password')).toBeVisible();
  await expect(page.locator('#tab-andy-estudio')).toBeHidden();
  await expect(page.getByRole('link',{name:/Volver al Bingo/i})).toBeVisible();
  await expect(page.locator('body')).toContainText('Acceso a ANDY Studio');
});
test('si el servidor rechaza la sesión anterior ofrece login sin mostrar editor',async({page})=>{
  await authenticated(page,false);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#andy-login-form')).toBeVisible();
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


async function directMock(page,{passwordValid=true,otpValid=true,sessionValid=true}={}) {
  await page.addInitScript(()=>{
    window.__andyMockCalls=[];
    window.__andyMockSession=null;
  });
  await page.route(cdn,route=>route.fulfill({
    status:200,contentType:'text/javascript',
    body: `window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:localStorage.getItem('mock-auth-andy')?{access_token:'jwt-approved'}:window.__andyMockSession},error:null}),signInWithOtp:async(v)=>{window.__andyMockCalls.push({action:"otp-send",email:v.email,shouldCreateUser:v.options.shouldCreateUser});return {error:null};},verifyOtp:async(v)=>{window.__andyMockCalls.push({action:"otp-verify",email:v.email,token:v.token,type:v.type});if(v.token==="000000")return {error:{message:"invalid",status:400}};window.__andyMockSession={access_token:"jwt-approved"};localStorage.setItem('mock-auth-andy','yes');return {data:{session:window.__andyMockSession},error:null};}}})};`
  }));
  await page.route('**/functions/v1/admin-auth',async route=>{
    const payload=route.request().postDataJSON();
    if(payload.action==='verify_credentials'){
      if(!passwordValid) {
        await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Credenciales incorrectas'})});return;
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({valid:true,email:payload.email,loginProof:'test-signed-proof'})});return;
    }
    if(payload.action==='create_session_otp'){
      if(route.request().headers()['authorization']!=='Bearer jwt-approved'||payload.loginProof!=='test-signed-proof')
        throw new Error('Intento de crear sesión sin OTP válido');
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,sessionToken:'sess_11111111-2222-4333-8444-555555555555',expiresAt:'2099-01-01T00:00:00Z',deviceId:payload.deviceId})});return;
    }
    throw new Error('Acción no permitida');
  });
  await page.route(verify,route=>route.fulfill({
    status:sessionValid?200:401,contentType:'application/json',
    body:JSON.stringify({valid:sessionValid,sameDevice:sessionValid,expiresAt:'2099-01-01T00:00:00Z'})
  }));
}
test('contraseña y OTP permiten entrar directamente, sin visitar el administrador del bingo',async({page})=>{
  await directMock(page);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#andy-login-form')).toBeVisible();
  await page.locator('#andy-login-email').fill('admin@example.test');
  await page.locator('#andy-login-password').fill('clave-de-prueba');
  await page.locator('#andy-login-submit').click();
  await expect(page.locator('#andy-code-form')).toBeVisible();
  await expect(page.locator('#andy-otp-email')).toHaveText('admin@example.test');
  await expect(page.locator('#andy-login-password')).toHaveValue('');
  await page.locator('#andy-otp-code').fill('123456');
  await page.locator('#andy-otp-submit').click();
  await expect(page.locator('#tab-andy-estudio')).toBeVisible();
  await expect(page.locator('#andy-guardar')).toBeVisible();
  await expect(page.locator('#andy-login-box')).toBeHidden();
  const result=await page.evaluate(()=>({
    token:sessionStorage.getItem('admin_session_token'),
    device:sessionStorage.getItem('device_id'),
    passwordStorage:sessionStorage.getItem('andy-login-password')||localStorage.getItem('andy-login-password'),
    proof:sessionStorage.getItem('pending_admin_login_proof')||localStorage.getItem('pending_admin_login_proof'),
    authCalls:window.__andyMockCalls
  }));
  expect(result.token).toBe('sess_11111111-2222-4333-8444-555555555555');
  expect(result.device).toMatch(/^device_/);
  expect(result.passwordStorage).toBeNull();
  expect(result.proof).toBeNull();
  expect(result.authCalls.map(x=>x.action)).toEqual(['otp-send','otp-verify']);
});
test('contraseña incorrecta no solicita OTP ni abre ANDY',async({page})=>{
  await directMock(page,{passwordValid:false});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#andy-login-email').fill('admin@example.test');
  await page.locator('#andy-login-password').fill('incorrecta');
  await page.locator('#andy-login-submit').click();
  await expect(page.locator('#andy-gate-error')).toBeVisible();
  await expect(page.locator('#andy-code-form')).toBeHidden();
  await expect(page.locator('#tab-andy-estudio')).toBeHidden();
  const calls=await page.evaluate(()=>window.__andyMockCalls);
  expect(calls).toEqual([]);
});
test('OTP incorrecto no crea sesión de administrador',async({page})=>{
  await directMock(page);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#andy-login-email').fill('admin@example.test');
  await page.locator('#andy-login-password').fill('clave-de-prueba');
  await page.locator('#andy-login-submit').click();
  await expect(page.locator('#andy-code-form')).toBeVisible();
  await page.locator('#andy-otp-code').fill('000000');
  await page.locator('#andy-otp-submit').click();
  await expect(page.locator('#andy-gate-error')).toBeVisible();
  await expect(page.locator('#tab-andy-estudio')).toBeHidden();
  const token=await page.evaluate(()=>sessionStorage.getItem('admin_session_token'));
  expect(token).toBeNull();
});
test('el fallo del servicio de autenticación muestra error pero no pantalla en blanco',async({page})=>{
  await page.route(cdn,route=>route.abort());
  await page.route('**/functions/v1/admin-auth',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({valid:true,loginProof:'test-proof'})
  }));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#andy-login-email').fill('admin@example.test');
  await page.locator('#andy-login-password').fill('clave-de-prueba');
  await page.locator('#andy-login-submit').click();
  await expect(page.locator('#andy-gate-error')).toBeVisible();
  await expect(page.locator('#tab-andy-estudio')).toBeHidden();
  await expect(page.locator('#andy-login-form')).toBeVisible();
});


test('recargar ANDY mantiene sesión validada sin pedir OTP nuevamente',async({page})=>{
  await directMock(page);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#andy-login-email').fill('admin@example.test');
  await page.locator('#andy-login-password').fill('clave-de-prueba');
  await page.locator('#andy-login-submit').click();
  await expect(page.locator('#andy-code-form')).toBeVisible();
  await page.locator('#andy-otp-code').fill('123456');
  await page.locator('#andy-otp-submit').click();
  await expect(page.locator('#tab-andy-estudio')).toBeVisible();
  const initial=await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem('bingo_andy_sesion_24h_v1')||'null');
    return {saved:!!saved,startedAt:saved?.startedAt,token:saved?.token,deviceId:saved?.deviceId};
  });
  expect(initial.saved).toBe(true);
  expect(initial.startedAt).toBeGreaterThan(Date.now()-60000);
  expect(initial.deviceId).toMatch(/^device_/);
  await page.evaluate(()=>{
    // Simula Android/PWA que descarta las credenciales volátiles al recargar.
    sessionStorage.removeItem('admin_session_token');
    sessionStorage.removeItem('device_id');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#tab-andy-estudio')).toBeVisible();
  await expect(page.locator('#andy-login-box')).toBeHidden();
  const final=await page.evaluate(()=>({
    token:sessionStorage.getItem('admin_session_token'),
    calls:window.__andyMockCalls,
    storage:JSON.parse(localStorage.getItem('bingo_andy_sesion_24h_v1')||'null')
  }));
  expect(final.token).toBe(initial.token);
  expect(final.storage.startedAt).toBe(initial.startedAt);
  expect(final.calls).toEqual([]);
});
test('después de 24 horas no reutiliza la sesión persistente',async({page})=>{
  await directMock(page);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#andy-login-email').fill('admin@example.test');
  await page.locator('#andy-login-password').fill('clave-de-prueba');
  await page.locator('#andy-login-submit').click();
  await expect(page.locator('#andy-code-form')).toBeVisible();
  await page.locator('#andy-otp-code').fill('123456');
  await page.locator('#andy-otp-submit').click();
  await expect(page.locator('#tab-andy-estudio')).toBeVisible();
  await page.evaluate(()=>{
    const key='bingo_andy_sesion_24h_v1';
    const old=JSON.parse(localStorage.getItem(key));
    old.startedAt=Date.now()-25*60*60*1000;
    localStorage.setItem(key,JSON.stringify(old));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#andy-login-form')).toBeVisible();
  await expect(page.locator('#tab-andy-estudio')).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem('bingo_andy_sesion_24h_v1'))).toBeNull();
});
test('si el servidor revoca la sesión ANDY no se abre al recargar',async({page})=>{
  await directMock(page);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#andy-login-email').fill('admin@example.test');
  await page.locator('#andy-login-password').fill('clave-de-prueba');
  await page.locator('#andy-login-submit').click();
  await expect(page.locator('#andy-code-form')).toBeVisible();
  await page.locator('#andy-otp-code').fill('123456');
  await page.locator('#andy-otp-submit').click();
  await expect(page.locator('#tab-andy-estudio')).toBeVisible();
  await page.route(verify,route=>route.fulfill({
    status:401,contentType:'application/json',body:JSON.stringify({valid:false,sameDevice:false})
  }));
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#andy-login-form')).toBeVisible();
  await expect(page.locator('#tab-andy-estudio')).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem('bingo_andy_sesion_24h_v1'))).toBeNull();
});
