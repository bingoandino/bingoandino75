# Endurecimiento de Supabase conservando las aplicaciones

## Aplicado el 28 de octubre de 2026

Se fijó `search_path = pg_catalog, public, pg_temp` en siete funciones que no lo
tenían definido. Los nombres temporales se resuelven al final y los objetos de
negocio siguen apuntando al esquema habitual. No se cambiaron sus cuerpos, firmas,
propietarios ni permisos. El aviso `function_search_path_mutable` desapareció.

En cuatro funciones de administración se hicieron explícitas las comprobaciones
de identidad: un resultado NULL ya no permite omitir el rechazo. Esto afecta a
eliminar registros, listar respaldos, crear respaldos y restaurarlos. Se conserva
el acceso del administrador identificado y del rol de servicio.

Antes de aplicar se guardaron las once definiciones y sus permisos en
`bingo_security.definition_backups`, bajo `function_hardening_20261028_v1`.
El script valida las definiciones anteriores y aplica todo dentro de una
transacción con tiempos de bloqueo y ejecución limitados. No modificó registros
de clientes ni ejecutó operaciones bancarias.

## Compatibilidad comprobada

- Pruebas en PostgreSQL aislado usando las definiciones reales anteriores.
- Igualdad de firmas, propietarios y ACL antes y después.
- Conservación de las validaciones de configuración, cartones y registros.
- Actualización ficticia de un registro con `service_role` permitida.
- Usuario ajeno y contexto sin claims rechazados; administrador y servicio permitidos.
- Rechazo de tablas temporales que pretendan sustituir la tabla real.
- Precondiciones verificadas: una definición distinta aborta sin cambios parciales.
- En producción: once ACL y propietarios conservados; permisos SELECT y UPDATE de
  `service_role` sobre `inscripciones` conservados; siete rutas fijadas.
- Prueba de solo lectura en producción: un usuario ajeno no puede listar respaldos.
- Lecturas públicas de configuración y disponibilidad: HTTP 200. Asistente general: HTTP 200.

Se inspeccionó el archivo aportado `verificar_pagos.py` sin imprimir ni extraer
credenciales. Usa la variable `SUPABASE_SERVICE_KEY`, recursos REST y PATCH;
no llama a las cuatro funciones de administración modificadas. La copia local
disponible de auditoria-pagos tampoco contiene referencias a ellas. Estas revisiones
no equivalen a ejecutar los bots contra bancos ni a validar sus claves actuales.

## Permisos públicos revisados

Los avisos sobre funciones SECURITY DEFINER no se resuelven revocando permisos
indiscriminadamente. Las APIs públicas de lectura y las que validan una reserva
propia necesitan seguir funcionando. La página llama a la limpieza de reservas
expiradas durante su funcionamiento normal; su intervalo mínimo es de cinco minutos
y preserva registros pendientes/aprobados. Se conservó ese contrato.

Las funciones de administración siguen requiriendo al administrador o al servicio.
Las funciones antiguas de reserva y consulta que ya eran exclusivas del servicio
siguen sin permiso para anon/authenticated. Los avisos de RLS sin políticas son
informativos y no justifican conceder acceso a tablas privadas.

Persisten avisos automáticos de SECURITY DEFINER por el modelo de API utilizado;
no se afirma que el análisis de todas las funciones sea una auditoría formal completa.

## Pendientes que requieren otro acceso o mantenimiento

### Contraseñas filtradas

El conector actual no permite modificar la configuración de Auth. El panel de
Supabase abrió la pantalla de inicio de sesión, por lo que no se cambió ese ajuste.
La función está disponible a partir de Pro según la
[documentación de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Hace falta acceso autenticado al panel y comprobar el plan antes de activarla.
No se compró ni cambió un plan de pago.

### Actualización de PostgreSQL

El proyecto continúa en PostgreSQL 15.8 / Supabase 15.8.1.079 y está activo. La base
consultada ocupa aproximadamente 63 MB. No se inició una actualización porque
Supabase documenta indisponibilidad de la base y servicios durante la operación,
lo que incumpliría la condición de no interrumpir los bots sin una ventana acordada.

Plan concreto para ejecutar cuando se acuerde el mantenimiento:

1. Confirmar una copia reciente recuperable desde el panel y el destino ofrecido por
   Supabase; revisar extensiones y validaciones previas del destino.
2. Acordar una ventana y detener de manera controlada tareas que puedan repetir acciones.
3. Actualizar desde el panel; no prometer una duración fija a partir del tamaño de la base.
4. Confirmar estado saludable, claves existentes, permisos y lecturas de cada aplicación.
5. Reanudar los bots con sus controles de idempotencia, evitando repetir pagos o verificaciones.

Fuente: [actualización de PostgreSQL y mantenimiento](https://supabase.com/docs/guides/platform/upgrading).

## Recuperación

Las definiciones anteriores están en el respaldo privado citado. Una recuperación
debe comprobar que las once funciones siguen en la versión endurecida antes de
reponer las definiciones originales dentro de una transacción. Revertir quitaría
estas protecciones y solo corresponde ante una incompatibilidad demostrada.
No se requieren cambios de contraseñas, claves del bot ni tokens para este parche.
