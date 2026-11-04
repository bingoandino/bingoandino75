# ANDY Marketing — medición inicial de visitas (preparación sin publicar)

## Qué incorpora
- Portada pública: un evento de visita por pestaña y día; clic en Comprar y enlaces WhatsApp.
- Administrador: pestaña ANDY Marketing con sesiones, clics y orígenes estimados de los últimos 7 días.
- No mide compradores nuevos ni compras verificadas todavía. Clics no equivalen a ventas.
- No toca inscripción, aprobación, cartones, bot Mercantil, ruleta o sorteo.
- La captura nunca bloquea la compra si hay una caída de red.

## Datos y privacidad
- Recoge un UUID aleatorio temporal por pestaña (sessionStorage), tipo de evento, origen genérico, campaña UTM validada y fecha/hora del servidor.
- No recoge nombres, cédulas, teléfonos, datos de pago, comprobantes, URL completa ni el IP dentro del JSON.
- No instala cookies ni un identificador duradero. Varias pestañas de una persona cuentan como varias sesiones.
- Si falta UTM/referrer, origen Sin origen identificable, sin atribuirlo falsamente a Instagram.
- Sesiones administrativas conocidas se excluyen.
- Una llamada HTTP puede falsificar el encabezado Origin: el endpoint público necesita rate-limits en gateway/WAF antes del despliegue.
- El informe se entrega exclusivamente tras verificar JWT de dueño por Supabase Auth y sesión de administrador activa vinculada al dispositivo.

## Archivos de esta rama
- marketing-tracker.js — medición pública no bloqueante.
- marketing-panel.js — reporte en el admin.
- index.html — pestaña ANDY y scripts.
- privacidad.html — aviso de analítica interna.
- supabase/marketing-visitas.sql — tabla separada con RLS; RPC agregado, solo service_role.
- supabase/functions/marketing-visit/index.ts — recepción de eventos.
- supabase/functions/marketing-report/index.ts — acceso al resumen, protegido por backend.
- supabase/config.toml — endpoints con validación explícita en lugar de gateway JWT.
- tests/marketing-tracker.test.cjs — pruebas para ejecución con npm ci.

## Secuencia de despliegue futura (NO ejecutada)
1. Validar los textos de privacidad, la legalidad de medición y las autorizaciones de publicidad pendientes.
2. Confirmar que el acceso admin contiene JWT real y sesión/ID de dispositivo verificables.
3. Revisar la carga de Supabase; elegir hora sin sorteo para cambios controlados.
4. Aplicar el SQL en el proyecto correcto; confirmar RLS, permisos y acceso denegado a anon/authenticated.
5. Desplegar las dos Edge Functions; comprobar autenticación del reporte y CORS de captura.
6. Activar limitación de solicitudes en edge/gateway/WAF y monitorear abuso del endpoint público.
7. Probar visita normal, clic compra, clic WhatsApp, origen UTM, recarga sin duplicado, errores de red, admin expirado y negativa a usuarios no autorizados.
8. Configurar un job de retención de más de 90 días en horario de baja carga; todavía no está activo.
9. Fusionar/publicar solo tras verificar que los procesos de bingo, compras y pagos siguen intactos.

## Cómo interpretar el reporte
- Sesiones: navegaciones/pestañas, no individuos únicos.
- Click Comprar: intención de compra, no compra confirmada.
- Click WhatsApp: clic a un enlace, no conversación o compra completada.
- Origen y UTM: pueden faltar o estar bloqueados por navegadores y aplicaciones.
- La atribución a primeras compras verificadas será una segunda fase, por un evento confirmado en backend y sin enviar PII a publicidad.
- Meta Ads se estudiará con datos históricos, sin activar nuevas campañas antes de verificar las autorizaciones.

## Estado
Solo preparación de código en rama aislada. No se ha aplicado SQL, desplegado funciones ni publicado el contador. El panel no mostrará métricas reales hasta un despliegue autorizado y verificado.

## Requisitos de seguridad añadidos (04/11/2026)
- El archivo index.html inicializa window.__ANDY_ANALYTICS_DISABLED__ = true. Por defecto no se generan solicitudes de medición, incluso si se fusiona el PR accidentalmente.
- Para activar cuando esté autorizado y probado, se requiere habilitar explícitamente esa bandera en la web.
- La Edge Function marketing-visit también permanece apagada hasta definir MARKETING_TRACKING_ENABLED=true.
- Además requiere un servicio Redis REST que acepte EVAL, con MARKETING_REDIS_REST_URL y MARKETING_REDIS_REST_TOKEN guardados como secretos de Edge (nunca en JavaScript público). Sin credenciales, responde con límite/fallo cerrado y no escribe a Supabase.
- Redis establece dos cuotas globales transaccionales: 80 eventos por minuto y 8000 por día (UTC), con expiración automática. Estas cifras son límites de protección inicial, no objetivos de tráfico ni datos de clientes.
- En caso de caída de Redis, la captura se desactiva temporalmente; el bingo y el proceso de compra siguen operando.
- Costos y continuidad de Redis deben evaluarse antes de contratarlo. No se ha creado ninguna cuenta externa ni configurado un plan de pago.
- No se recopilan IP ni huellas de navegación para la cuota; son contadores globales que también frenan ataques desde direcciones distribuidas. Un abuso puede provocar infracontar visitas legítimas una vez agotado el cupo; no es una solución completa contra todas las formas de abuso.
- El navegador utiliza referrerPolicy no-referrer en el envío, evitando el referer completo.
- Tests negativos adicionales: origen no autorizado, payload excesivo, datos inválidos, admin no autorizado o expirado, cuota agotada, Redis caído, duplicados.
- Después de desplegar infraestructura y límites, iniciar con un piloto de bajo tráfico y validar las métricas antes de habilitar la bandera en producción.
