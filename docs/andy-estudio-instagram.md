# ANDY Studio — Oficina creativa de Instagram (v1)

## Qué se puede usar al desplegar esta versión
En esta versión la oficina se abre **directamente** desde `https://bingoandino75.com/andy-estudio.html`, sin añadir scripts ni pestañas a la portada del bingo. Si no tienes sesión, ANDY muestra su propio formulario: correo y contraseña de administrador, seguidos por el código de seis dígitos enviado al correo. Si la sesión del dispositivo sigue válida, la recupera automáticamente. El estudio incluye:
- Brief libre: convierte palabras clave en un borrador basado en plantillas locales, sin llamar a IA externa.
- Seis temas: bienvenida, bombo real, tutorial de verificación, seguridad, agradecimiento, canal en vivo.
- Tres formatos: publicación 1:1, historia 9:16 y reel (portada PNG 9:16 y guion de tomas).
- Editor de título, texto visible, pie de Instagram, CTA, fecha editorial y guion de reel.
- Vista previa responsive con colores del Bingo (morado, marfil y dorado).
- Exportación de imagen PNG en 1080×1080 o 1080×1920, sin peticiones al servidor.
- Copiar texto, guardar/editar/eliminar borradores, revisión y aprobación **interna**.
- Biblioteca local con estados y fechas, generar seis ideas de contenido y exportar respaldo JSON.

## Limitaciones y veracidad
- NO hay generación de videos terminados, clips, narraciones ni publicación programada. Para reels solo portada PNG y guion.
- NO existe hoy conexión real con Instagram, Metricool ni Meta; aprobar internamente no envía ni programa publicaciones.
- NO está conectada una IA. La conversión de brief en plantilla funciona por palabras clave, deliberadamente identificada como tal.
- Los borradores se guardan en localStorage, **solo en este navegador/dispositivo** y sin cifrado; otros usuarios con acceso al dispositivo podrían verlos. No escribir datos personales o bancarios en los borradores.
- No hay sincronización entre dispositivos ni copias en servidor; el botón de respaldo descarga JSON manualmente.
- Máximo 100 borradores locales; información puramente editorial, no de clientes.
- Las fechas son sugeridas. Las promociones y publicidad relacionadas con juego deben someterse a revisión de requisitos y autorizaciones Meta/locales antes de difundirse.

## Aislamiento y seguridad
- La versión anterior se revirtió después de la pantalla en blanco. Esta versión **no modifica index.html**. Añade `andy-estudio.html` y `andy-gate.js`, y reutiliza los archivos estáticos `andy-studio.js` y `andy-studio.css`.
- Estilos acotados bajo #tab-andy-estudio: no cambian los demás paneles.
- El editor no utiliza Supabase, no conoce service_role, no realiza llamadas a red y no modifica compras, sesiones admin, cartones ni pagos.
- Utiliza asignación segura de textContent y createElement para los títulos del usuario, evitando inyección de HTML.
- La oficina se carga únicamente después de validar el JWT de Supabase Auth y la sesión del dispositivo mediante `verify-session`. El acceso inicial reutiliza `admin-auth` (`verify_credentials` y `create_session_otp`) y `signInWithOtp`/`verifyOtp`: el backend exige contraseña, prueba firmada y código reciente del correo. Contraseña, código y prueba firmada se mantienen en memoria durante la solicitud, no en localStorage ni sessionStorage. Si la sesión no existe, ANDY muestra su propio formulario; ante fallas de autorización o de CDN/red, muestra un aviso y mantiene el editor cerrado. Los archivos estáticos son públicos, pero la interfaz editorial y los borradores personales permanecen inaccesibles sin autenticación desde la navegación normal; no guardar secretos ni datos bancarios.
- Por ahora no hay servidor sincronizado que pudiera exigir nuevas políticas RLS o permisos.

## Pruebas y publicación
- CI `ANDY Studio — pruebas de interfaz`: unitarias del editor, no-publicación y regresión de recarga, buscador del administrador y flujo Comprar.
- Revisar manualmente Chrome/Android, renovación de sesión, tamaño de imagen, contraste, guardar/volver a abrir, copia, respaldo y varias ventanas.
- Revisar textos y condiciones de Instagram antes de crear publicaciones promocionales.
- Publicar solo después de revisión, manteniendo independiente la rama de métricas del PR #38.

## Fase 2 sugerida
- Sincronización de borradores a servidor privado con validación en backend para acceso multiusuario.
- Integración real de un modelo de IA para generación de guiones/textos **identificada como IA**.
- Integración de Instagram mediante API/servicio oficial y permisos que correspondan.
- Generación/edición de video real y assets multimedia, respetando derechos y autorizaciones.

## Estado
Rama de acceso directo para ANDY Studio. El PR #40 estableció el aislamiento; esta mejora añade entrada independiente con contraseña + OTP sin cambios en `index.html`, base de datos, bot, compras ni sorteos. Pruebas de navegador con credenciales ficticias (no se envían correos reales): contraseña correcta/incorrecta, OTP correcto/incorrecto, sesión existente, errores de red, móvil y escritorio. La comprobación real con correo autorizado debe hacerse después del despliegue.
