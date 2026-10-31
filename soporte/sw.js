// Solo facilita el arranque de la app. No guarda sesiones, compras ni respuestas de la API.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=='GET'||u.origin!==self.location.origin||event.request.mode!=='navigate'||!['/soporte/','/soporte/index.html'].includes(u.pathname))return;
 event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Soporte 75</title><body style="font-family:system-ui;padding:24px;background:#fffaf0;color:#321347"><h1>Sin conexión</h1><p>Conéctate a internet para abrir soporte. Tu sesión guardada se recuperará al volver.</p><button onclick="location.reload()">Reintentar</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
