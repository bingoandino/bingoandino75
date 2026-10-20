# Publicación de ganadores

## Comportamiento

La entrada raíz de auditoría incorpora «Publicar ganadores», vista previa y confirmación explícita. Se exige completar todas las rondas y el final. Consolación y pozo se incluyen cuando se registran sus cartones. Solo se publica versión del contrato, fecha, categorías fijas, orden, número de cartón y premio individual en céntimos de Bs. No se publican nombres, cédulas, teléfonos, datos bancarios, comprobantes ni identificadores de compradores. No se publican resultados automáticamente con el despliegue.

El historial permite consultar las últimas 100 fechas o buscar cualquier fecha anterior. Los pagos conservan su cálculo actual: premio compartido redondeado hacia abajo a Bs enteros y premio único redondeado al entero; consolación usa el monto individual.

## Base de datos y autorización

`public.resultados_publicados` es independiente de inscripciones y cartones, sin relaciones que propaguen borrados. `Nuevo sorteo` solo borra el estado local de auditoría. Los reinicios de inscripciones/cartones no borran el historial. La fecha es única; un reintento idéntico confirma éxito sin duplicar; resultados diferentes para la misma fecha se rechazan. Los triggers bloquean UPDATE, DELETE y TRUNCATE incluso si se ejecutan desde un rol con permisos elevados.

La RPC pública `public.publicar_resultados_v1(jsonb)` es SECURITY INVOKER. Delega en una función SECURITY DEFINER del esquema no expuesto `privado_resultados`, con search_path vacío, que exige auth.uid() y pertenencia activa a `privado_resultados.publicadores_resultados`. La lista no es legible ni editable por usuarios del navegador. Antes de insertar se verifica una compra aprobada única por cartón y se rechaza cualquier campo fuera del contrato, incluidos textos personales. La autorización del operador existente se registra fuera de la migración, por identidad confirmada de Auth; nunca se incluyen UUID reales en el repositorio.

Se retiró la política `public_read_ganadores` y el permiso SELECT de anon sobre la tabla antigua `ganadores`; la web elimina su antiguo lector y formulario personal. No se copian filas de esa tabla al nuevo historial. El resto de la gestión de inscripciones conserva su comportamiento previo.

## Respaldos y alcance

Respaldos de código: ramas `backup/antes-publicar-ganadores-20261020` en ambos repositorios.

- Auditoría: `1df06228c996eaf34120d7cbbae278e369a476f7`.
- Web: `4d2bd032518675ecdde937aa948764ba717af454`.

Se guardó un respaldo privado previo de las tablas relevantes: estructura, constraints, triggers, políticas y ACL de inscripciones/ganadores, junto a 280 inscripciones y 0 ganadores. Se verificó su restauración en PostgreSQL local comparando todos los valores, con equivalencia de timestamps. No es una copia integral del proyecto: no incluye Auth, archivos de Storage ni otras tablas. Ningún dato de ese respaldo se incorpora a GitHub ni al historial público.

Las pruebas remotas usaron exclusivamente datos ficticios. Una comprobación que pretendía copiar datos reales al entorno de prueba fue bloqueada por revisión automática; se sustituyó por la restauración local. No se copiaron datos de clientes a la rama de pruebas.

## Verificación realizada

- `npm ci` y `npm test`: 9 pruebas de auditoría y 1 de web aprobadas.
- Migración probada en PostgreSQL embebido y en una rama aislada del Supabase real, con el esquema original clonado.
- Pruebas de SQL remoto: usuario sin autorización, campos personales, publicación, reintento, conflicto de fecha, bloqueo de borrado y conservación del historial al borrar inscripciones sintéticas.
- Concurrencia remota: dos transacciones con resultados distintos para la misma fecha dejaron una sola publicación y rechazaron la segunda.
- REST en la rama: lectura de resultados con clave pública devuelve 200; la tabla antigua con campos personales devuelve 401.
- Navegador Chromium en viewport móvil 390×844: vista previa, confirmación, cambio de resultados, error, reintento, historial y Nuevo sorteo sin errores JS. Inspección visual del diálogo completada.
- Se corrigieron dos identificadores `async` sueltos preexistentes en la entrada raíz que interrumpían su inicialización.
- Las rutas antiguas y de prueba, incluida `auditoria-supabase/index.html`, conservan su código; el botón se integra en la entrada raíz actual.

La prueba completa con el código OTP del operador y un resultado real queda a cargo de su sesión: no se inicia sesión como el usuario ni se publican resultados ficticios en producción.

## Reversión y asuntos fuera de alcance

Para detener nuevas publicaciones, revocar EXECUTE sobre la RPC pública a authenticated. Conservar la tabla de resultados y los triggers; nunca eliminar publicaciones para revertir una interfaz. No restaurar el antiguo lector de nombres/cédulas/teléfonos. Puede deshabilitarse temporalmente la vista de historial manteniendo los datos.

La revisión encontró permisos previos de lectura pública en `inscripciones`; modificarlos exige revisar el flujo de inscripción/consulta, que depende de esa lectura. La integración nueva no añade ni amplía esos permisos. Este hallazgo y los avisos de seguridad preexistentes requieren una tarea separada para no interrumpir reservas o consultas.
