# Revisión de seguridad del asistente general

Fecha: 28 de octubre de 2026. Proyecto: BingoAndino75. Alcance: integración pública
`asistente-generales`, cliente de consultas generales y función existente de cuotas.
Se revisaron el código publicado, los archivos desplegados, los permisos de la cuota y
los avisos de Supabase. No se accedió a datos de clientes ni al valor de las claves.

## Hallazgos corregidos

En pruebas con respuestas de modelo simuladas, el filtro admitía un correo inventado,
dígitos de ancho completo y una instrucción oculta con un carácter invisible. No se
demostró que un usuario pudiera imponer esas respuestas al modelo: el servidor solo
acepta temas predefinidos, no texto libre. Aun así, se reforzó la salida no confiable:

- Normalización Unicode NFKC antes de comprobar palabras y números.
- Rechazo de caracteres invisibles, controles, letras ajenas al alfabeto latino y
  números no admitidos; se conserva el español con acentos y la marca oficial.
- Rechazo de correos, dominios, esquemas ejecutables e instrucciones de datos sensibles.
- Los resultados rechazados usan respaldo y no se guardan en caché.
- La llamada de cuota también impide redirecciones para proteger sus cabeceras.

## Pruebas y evidencia

| Control | Evidencia | Resultado |
| --- | --- | --- |
| Gateway | Petición real sin credenciales | HTTP 401 |
| Origen | Petición real con origen ajeno | HTTP 403 |
| Inyección | Petición real con un campo `system` añadido | HTTP 400, antes de Gemini |
| Temas | Petición real con tema fuera de la lista | HTTP 400, antes de Gemini |
| Datos personales | Mensajes ficticios con nombre, números e instrucciones | Solo salen enums `topic` y `style` |
| Esquema | Tipos incorrectos, prototipos, campos de herramientas, historial, URL y archivos | Rechazados sin llamadas externas |
| Tamaño | Cuerpos grandes y caracteres UTF-8 multibyte | Límite por bytes, sin depender de Content-Length |
| Lecturas incompletas | Streams de cliente y proveedor que no terminan | Cancelación tras dos segundos; respaldo o rechazo |
| Tiempo de red | AbortSignal de cuota y proveedor probado con red simulada sin respuesta | Aborta y devuelve respaldo |
| Contenido | HTML, enlaces, contactos inventados, Unicode oculto, números y horarios incorrectos | Rechazo y respaldo |
| Caché | Modelo hostil y cuota agotada tras una respuesta válida | No guarda respuestas hostiles; la cuota se comprueba antes de la caché |
| Permisos | SQL de solo lectura en producción | `anon` y `authenticated` no ejecutan la cuota; `service_role` sí |
| Límites | PostgreSQL aislado con SQL del repositorio | 8/minuto/IP, 80/día/IP y 500/día global; agrupación IPv6 /64 |
| Atomicidad | Consumo rechazado en PostgreSQL aislado | No consume la cuota global al fallar el límite individual |
| Credenciales | Escaneo de los módulos públicos implicados | Sin claves Gemini ni JWT con rol de servicio |
| Regresión | Suite del proyecto y pruebas de seguridad adicionales | Pasaron localmente; GitHub ejecuta las comprobaciones del commit |

Las pruebas de volumen, cuota y respuestas maliciosas se realizaron localmente con
datos ficticios. Las peticiones negativas reales fueron pequeñas y no llamaron al
modelo. No se agotaron cuotas de producción ni se hizo una prueba de denegación de
servicio. Los tests de red simulada validan el manejo de errores, no una caída real de Google.

## Avisos pendientes del proyecto Supabase

Estos avisos proceden del análisis general del proyecto, no de una explotación probada
del endpoint de consultas. No deben confundirse con el resultado de sus tests.

| Aviso | Cantidad | Interpretación y seguimiento |
| --- | ---: | --- |
| PostgreSQL con parches pendientes | 1 | Planificar [actualización de la base](https://supabase.com/docs/guides/platform/upgrading), considerando ventana de servicio y respaldo. No se actualizó la base durante las pruebas. |
| Protección frente a contraseñas filtradas desactivada | 1 | Revisar [seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) y disponibilidad en el plan del titular. |
| Funciones con search_path mutable | 7 | Revisar dependencias y fijar [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) explícito de forma compatible. |
| SECURITY DEFINER ejecutables por anon | 7 | Revisar [permisos y comprobaciones internas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). Algunas APIs públicas pueden necesitar ese permiso; el aviso por sí solo no demuestra un fallo. |
| SECURITY DEFINER ejecutables por authenticated | 14 | Revisar [autorización interna](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), sin revocar automáticamente APIs usadas por el administrador. |
| RLS activa sin políticas | 15 | Aviso informativo de [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), que deniega acceso por defecto. Varias tablas están en esquemas privados; no se agregaron permisos. |

## Límites de la revisión

El JWT público identifica el acceso a una API pública, no autentica a una persona.
Un cliente externo puede reproducir Origin; CORS no sustituye autenticación. La cuota
persistente limita llamadas al modelo y el respaldo mantiene orientación cuando se
agota. No elimina toda posibilidad de abuso o indisponibilidad.

La validación de texto reduce errores pero no prueba que cualquier respuesta de IA sea
semánticamente correcta. Esta revisión no certifica toda la plataforma ni reemplaza
la revisión pendiente de los avisos de la base de datos. No se ejecutaron transacciones,
reservas, compras, aprobaciones ni verificaciones bancarias.
