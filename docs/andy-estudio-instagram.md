# ANDY Studio — Oficina creativa de Instagram (v1)

## Qué se puede usar al desplegar esta versión
Desde el administrador de bingoandino75.com aparece la pestaña **🤖 ANDY Estudio** con:
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
- Cambios limitados a index.html (nueva pestaña + dos archivos estáticos), andy-studio.js y andy-studio.css.
- Estilos acotados bajo #tab-andy-estudio: no cambian los demás paneles.
- El editor no utiliza Supabase, no conoce service_role, no realiza llamadas a red y no modifica compras, sesiones admin, cartones ni pagos.
- Utiliza asignación segura de textContent y createElement para los títulos del usuario, evitando inyección de HTML.
- Se carga como pestaña del administrador existente. Los archivos estáticos son públicamente accesibles pero el panel se muestra solo dentro de sesión admin; no se almacenan secretos ni datos sensibles.
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
PR de GitHub en borrador. Nada está fusionado con main ni publicado en bingoandino75.com.
