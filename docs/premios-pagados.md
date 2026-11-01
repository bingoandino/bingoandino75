# Premios pagados — preparado, sin activar

Estado: código y migración preparados. No se han aplicado cambios a Supabase ni publicado archivos en las ramas principales. No se subieron comprobantes reales.

## Uso previsto

1. Generar los pagos y pegar los comprobantes de todos los ganadores del día en este dispositivo.
2. Elegir `Publicar comprobantes del día`.
3. Revisar la fecha y cada imagen pública. Incluye nombre/cartón y la cobertura parcial ya acordada; los originales no salen de IndexedDB.
4. Marcar la confirmación de revisión y pulsar `Confirmar y publicar comprobantes`.
5. Compartir el enlace a `https://bingoandino75.com/?premios=AAAA-MM-DD`.

Cada ronda se publica como una imagen completa (collage cuando tiene varios ganadores) y una miniatura JPEG. No se publican datos del registro ni campos bancarios en JSON. Los datos visibles dentro de la captura son los revisados en la vista previa.

La web carga miniaturas al acercarse a la pantalla; al tocarlas descarga la imagen completa y abre el visor, con cierre y zoom nativo. La fecha se puede cambiar con el calendario. Hay estados vacíos y de error.

## Datos y permisos

- Bucket nuevo privado `premios-pagados`, solo JPEG, límite de 8 MiB por objeto. No se usa el bucket de comprobantes de compras.
- Tablas nuevas `premios_pagados` y `premios_pagados_imagenes`, sin referencias a compras, reservas, cartones ni sorteos activos.
- Solo los publicadores activos de `privado_resultados.publicadores_resultados` pueden subir, confirmar, corregir o retirar.
- Visitantes pueden leer únicamente filas e imágenes vinculadas a una fecha publicada.
- Objetos inmutables: no se sobrescriben rutas existentes. Políticas restrictivas protegen este bucket incluso si hay políticas antiguas demasiado amplias.
- Actualizaciones de un día usan revisión esperada y transacción completa. Una subida incompleta no cambia lo publicado.
- Una respuesta ambigua del RPC no elimina imágenes posiblemente publicadas; primero se consulta la fecha. Objetos privados huérfanos pueden limpiarse después por un publicador autorizado, sin borrar objetos de publicaciones vigentes.
- Retirar oculta la fecha y bloquea nuevas lecturas públicas de sus imágenes; conserva los registros. No puede eliminar copias que alguien ya descargó.
- `Nuevo sorteo` conserva las publicaciones. Sigue borrando solamente el trabajo y capturas locales según el flujo actual.

## Activación futura — requiere autorización del usuario

1. Revisar ambos borradores y sus comprobaciones. Mantener las ramas principales sin cambios hasta la autorización.
2. Verificar en desarrollo/ensayo el bucket y las políticas contra la versión real de Storage. Las pruebas locales simulan su esquema, no el servidor HTTP de Storage.
3. Revisar los asesores de seguridad del proyecto. No se ejecutaron contra producción en esta preparación.
4. Aplicar una sola vez `supabase/migrations/20261101011905_premios_pagados_publicos.sql` en el backend compartido. Debe existir el listado privado de publicadores de resultados.
5. Activar los archivos de la web y luego los de la app. La app incluye una nueva versión de caché PWA.
6. Probar con una fecha y comprobantes ficticios acordados: verificar vista previa sin subidas, autorización, carga completa, visor, corrección por revisión y retiro. No usar compras reales para estas pruebas.
7. Publicar comprobantes reales únicamente desde la app, tras la revisión y confirmación explícita del operador.

No se requieren Edge Functions nuevas ni claves privadas en el navegador. No ejecutar `db reset`, ni borrar tablas o buckets existentes. Para desactivar la interfaz basta revertir los archivos nuevos; no borrar el historial almacenado.

## Validación preparada

Pruebas locales con jsdom y PGlite: imágenes derivadas/miniaturas, fecha y ronda correctas, falta de capturas, acceso no autorizado, RLS incluso con políticas anteriores amplias, vista previa sin escrituras, consentimiento, fallos de subida/RPC, concurrencia por revisión, retiro, visor, texto hostil, rutas externas rechazadas y persistencia ante reinicios del sorteo.

Fuentes técnicas: https://supabase.com/docs/guides/storage/security/access-control y https://supabase.com/docs/reference/javascript/storage-from-download. CLI utilizada solo para crear el archivo de migración: 2.122.0. El cambio de TLS anunciado para noviembre no exige cambios en las APIs utilizadas por navegadores modernos.
