# Publicación de resultados: preparación y despliegue

Estado: implementación en rama; NO desplegar antes de validar Supabase.

## Respaldos de código

Repositorio auditoría: `backup/antes-publicar-ganadores-20261020`, commit `1df06228c996eaf34120d7cbbae278e369a476f7`.
Repositorio web: `backup/antes-publicar-ganadores-20261020`, commit `4d2bd032518675ecdde937aa948764ba717af454`.
Las ramas apuntan al código anterior completo. No son un respaldo de los datos de Supabase ni del estado local de los teléfonos.

## Contrato y privacidad

La tabla nueva `resultados_publicados` contiene solo fecha, hora de publicación y un JSON de versión 1. Cada grupo tiene categoría fija, orden, cartón y premio en céntimos de Bs. No se publican nombres, cédulas, teléfonos, comprobantes, IDs de compradores ni datos bancarios. No se copia la tabla antigua `ganadores`. La web deja de consultarla y de usar su formulario antiguo.

Una función transaccional admite exclusivamente usuarios de `publicadores_resultados`. Estar autenticado no basta. La lista se administra exclusivamente desde una conexión privilegiada, nunca desde el navegador; comienza vacía. Se vuelven a verificar las compras aprobadas antes de insertar. El cálculo no valida quién ganó la partida: el operador revisa las rondas en la vista previa y confirma.

La fecha es única, y no se permiten reemplazos ni borrados. Un reintento con el mismo JSON devuelve éxito sin duplicar; uno con otro resultado se rechaza. El bloqueo de fecha evita dos escrituras simultáneas. `Nuevo sorteo` solo borra el estado local. La tabla no tiene relaciones que propaguen el borrado de inscripciones/cartones. También se bloquean UPDATE, DELETE y TRUNCATE sobre resultados.

Se conserva el cálculo actual de pagos: si hay varios cartones se redondea el premio individual hacia abajo a Bs enteros; si hay uno se redondea al entero. Consolación usa el monto individual. La vista previa muestra los importes que se publicarán; no se cambia la operativa de pago.

## Secuencia obligatoria antes de producción

1. Conectar Supabase y verificar el proyecto `dbkixcpwirjwjvjintkr`, esquema real, tipo de `inscripciones.cartones`, políticas RLS, usuarios autorizados y mecanismos de reinicio. Comprobar si `ganadores` permite lecturas anónimas de información privada y cerrar ese acceso mediante una migración revisada. Retirar la consulta de la UI no revoca acceso a la API antigua.
2. Obtener respaldo completo de esquema y datos, roles/políticas y funciones existentes con el mecanismo de Supabase o pg_dump, con almacenamiento privado. Registrar fecha, ubicación, tamaño y prueba de restauración en un entorno aislado. No guardar datos de clientes ni respaldos SQL de producción en estos repositorios públicos.
3. Crear una rama de desarrollo/base aislada, restaurar el respaldo y aplicar la migración nueva. Verificar que no altera las tablas actuales. La migración crea objetos, no copia los datos existentes.
4. Identificar con el propietario el UUID del operador ya verificado en Auth. Insertar exclusivamente ese UUID en `public.publicadores_resultados(usuario_id)`. No autorizar automáticamente a todos los autenticados ni usar metadatos editables del usuario.
5. Probar con dos sesiones (operador y usuario sin autorización), además de acceso anónimo: solo el operador publica; cualquiera lee exclusivamente la tabla pública; nadie puede escribir directamente en ella ni consultar la lista de operadores.
6. Completar la prueba de punta a punta: cargar aprobados, registrar todas las rondas, final, consolación y pozo, revisar, cancelar, confirmar, simular pérdida de respuesta, reintentar, comprobar duplicados y ejecutar Nuevo sorteo en el entorno aislado. Verificar que las publicaciones y fechas anteriores siguen presentes. Probar dos publicaciones simultáneas para la misma fecha.
7. Tras superar esos controles, aplicar migración y autorizar operador en producción; desplegar primero web y después auditoría desde las ramas revisadas. Nunca publicar datos ficticios de prueba en producción.
8. Comprobar las dos URLs públicas y la actualización de la PWA. La variante `auditoria-supabase/index.html` y las rutas antiguas/de prueba no se modifican; el botón se integra en la entrada raíz actual.

## Reversión

Antes de tener publicaciones: revertir los commits de interfaz si hace falta y revocar EXECUTE sobre `publicar_resultados_v1(jsonb)` a authenticated. Después de publicar, conservar siempre la tabla y sus datos; NO eliminarla ni desactivar sus triggers. No restaurar el viejo lector público de nombres/cédulas/teléfonos: deshabilitar temporalmente la vista pública si se revierte el código de la web. Los respaldos de código solo son puntos de referencia, no una orden de restauración ciega.

## Pruebas reproducibles

Ejecutar `npm ci` y `npm test` en este repositorio. Las pruebas de base de datos usan PostgreSQL embebido (PGlite) con Auth e inscripciones sintéticos; no conectan a producción. Las pruebas DOM no sustituyen la comprobación visual en navegador móvil ni las pruebas del proyecto real de Supabase. No afirmar que producción está validada con estos resultados.

## Verificación local completada (20 octubre 2026)

- `npm ci --ignore-scripts` y `npm test`: 9 pruebas aprobadas en auditoría y 1 en web.
- Migración ejecutada en PostgreSQL embebido: autorización, RLS/privilegios, campos personales, cartones duplicados/no aprobados, fechas inválidas, publicación y reintento idéntico, conflicto de fecha, revocación de operador y bloqueo de UPDATE/DELETE/TRUNCATE. La publicación sobrevive al borrado de las inscripciones de prueba.
- DOM: carga del formulario real, vista previa sin nombres, ausencia de escritura antes de confirmar, cambio de resultado, error, reintento, consulta de historial y Nuevo sorteo sin escritura remota. Lector web consulta únicamente columnas públicas de resultados_publicados.
- Se eliminaron dos identificadores `async` sueltos preexistentes en la entrada raíz, que producían ReferenceError e interrumpían la inicialización.
- La prueba en navegador real no pudo ejecutarse: no hay Chromium instalado y la descarga no se completó. La comprobación visual móvil queda pendiente.
- No se ejecutaron consultas ni cambios en Supabase real; no existe todavía respaldo de esa base en esta tarea. Pendientes: permisos/esquema reales, restauración del respaldo, concurrencia de sesiones, integración real y despliegue público.
