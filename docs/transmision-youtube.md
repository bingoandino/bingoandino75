# Transmisión de YouTube en los cartones

Estado: código preparado, sin publicar. No aplicar el SQL ni integrar estas ramas a producción hasta la indicación del propietario.

La app de pagos permite pegar un enlace HTTPS del video o directo de YouTube, enviarlo, reemplazarlo y quitarlo. Utiliza la sesión y lista de operadores autorizados de la publicación de ganadores. El reproductor se añade únicamente a `/jugar/`, conserva el juego existente y consulta el cambio aproximadamente cada minuto, además de hacerlo al regresar a la pestaña o recuperar conexión.

## Comportamiento

- El video se carga tras tocar Ver transmisión. YouTube puede pedir otro toque para reproducir o activar sonido.
- Ocultar transmisión, salir a otra pestaña o abrir comentarios elimina el reproductor y detiene el audio. No se ofrece reproducción de audio con el video oculto.
- Ir al directo vuelve a cargar el video sin parámetros de posición anteriores. No promete eliminar la latencia de YouTube, la red ni garantizar estar en el último segundo disponible.
- Ver comentarios abre la página del video en YouTube. El chat no se inserta en la web móvil.
- El enlace enviado vence a las 18 horas para evitar arrastrarlo al día siguiente. Reenviarlo renueva el plazo. La app muestra la hora de vencimiento en Caracas.
- No se comprueba a través de la API de YouTube que el video esté en vivo ni que permita inserción. Un video terminado puede mostrar su grabación hasta quitarlo o vencer. Si YouTube restringe el reproductor, está disponible el acceso al video en YouTube.
- El enlace de un canal, listas de reproducción, dominios falsos, protocolos inseguros o IDs inválidos se rechazan. Solo se persiste el ID del video, sin tiempos ni parámetros de seguimiento.
- Las compras, los pagos, los ganadores, el catálogo y las marcas permanecen en sus flujos actuales.

## Base y permisos

La instalación revisable está en `supabase/transmision-juego.sql` del repositorio `elisjgarcia-web/auditoria-pagos`. No se ha ejecutado en producción. Depende de `privado_resultados.publicadores_resultados` y sus permisos ya existentes. Una consulta de metadatos confirmó que esa lista existe y tiene un operador activo; los nuevos objetos aún no existen en producción.

`transmision_juego` es una tabla de una sola fila, sin información personal, con RLS y solo SELECT público. No hay permisos directos de inserción, actualización, borrado ni truncado para clientes. La RPC pública usa SECURITY INVOKER y delega en una función privada que comprueba `auth.uid()` y la lista de operadores; no confía en metadatos editables del usuario. La actualización bloquea la fila y exige la revisión leída para impedir sobrescrituras desde otro equipo. Si un envío falla o su resultado es incierto, la app obliga a consultar antes de reenviarlo.

## Verificación realizada

- `npm test` en la página: 216 pruebas aprobadas.
- `npm test` en pagos: 17 pruebas aprobadas.
- Las pruebas nuevas verifican normalización y rechazo de enlaces, sesión, fallos de conexión, doble toque, revisión, cambio y remoción, vencimiento, conservación de las marcas y destrucción del reproductor al ocultarlo.
- PostgreSQL aislado con PGlite: autorización efectiva con roles anon/authenticated, rechazo de usuario ajeno o desactivado, escrituras directas denegadas, cambio de revisión y vencimiento; sin operaciones en datos reales.
- Prueba integrada en Chromium a 360×800, 390×844, 768×1024 y 1366×900: enviar desde pagos, abrir en cartones, marcar, ocultar, recargar directo, cambiar y quitar; sin pérdida de marcas, sin desbordamiento horizontal ni errores JavaScript.
- En la prueba integrada, Supabase y el iframe YouTube se simulan; las imágenes de cartones se verifican con su hash real. Esta prueba no acredita reproducción/audio real de YouTube, latencia, chat autenticado ni comportamiento en un dispositivo físico.

Repetición de las pruebas de navegador: con ambos repositorios como carpetas hermanas (`auditoria-pagos` y `bingoandino75`), Playwright disponible, y un directorio con las imágenes originales `carton-58.webp` y `carton-719.webp`, ejecutar desde pagos:

```sh
QA_CARTONES_DIR=/ruta/cartones QA_OUTPUT=/ruta/salidas node tests/browser-transmision.cjs
```

`QA_CHROMIUM` permite elegir el ejecutable Chromium instalado. El script bloquea el service worker y simula las conexiones; no envía enlaces ni cambia datos de producción. Las capturas son evidencia local de prueba.

## Activación después de la autorización

1. Revisar diferencias con las ramas principales actuales y repetir pruebas si cambiaron las fuentes.
2. En un entorno de prueba de Supabase, aplicar el SQL revisado y probar con un operador autorizado y uno no autorizado. La comprobación aislada de PostgreSQL ya está realizada; esta fase de infraestructura alojada está pendiente.
3. Comprobar un enlace real de transmisión con inserción permitida, sonido y controles en Android/iPhone y PC. Medir la demora contra YouTube en las mismas condiciones; no prometer latencia cero.
4. Tras autorización para publicar, aplicar el SQL en producción y desplegar los dos repositorios coordinadamente. La instalación no contiene un enlace activo: el operador lo envía desde pagos después.
5. Abrir/actualizar la PWA de pagos para activar la versión del service worker. Comprobar envío, cambio, remoción y conservación del marcado. La transmisión queda cerrada por defecto.

Reversión: retirar los recursos y las dos referencias de scripts y CSS de `/jugar/`, y revertir los cambios de la app de pagos y su service worker. No borrar la tabla ni la lista de operadores; los objetos nuevos quedan inertes y no intervienen en ventas/pagos. No se ha alterado el campo de configuración anterior `youtube_live`.

## Fuentes oficiales consultadas

- https://developers.google.com/youtube/player_parameters
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://support.google.com/youtube/answer/2524549
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog.md
- https://supabase.com/changelog/cbc-tls-ciphers-deprecated
