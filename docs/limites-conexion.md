# Límites de conexión

Aplicar después de `supabase/security/privacidad_compras.sql`.

Los RPC de reserva conservan sus contratos y su credencial por pestaña. La función privada de validación agrega cuotas compartidas por conexión, antes de escribir una reserva. Las operaciones se serializan con el bloqueo de reservas existente.

Valores iniciales, ajustables en `bingo_security.abuse_settings`:

| Control | Límite |
|---|---|
| Cartones sin aprobar por conexión | 200 |
| Solicitudes de reserva por minuto y conexión | 600 |
| Unidades solicitadas por hora y conexión | 1000 |
| Límite existente por credencial | 100 cartones sin aprobar |

Las compras aprobadas dejan de consumir la cuota de cartones sin aprobar. Liberar una reserva no devuelve el consumo de la cuota horaria. Las cuotas no se reinician al cambiar cédula o credencial. Los contadores vencidos se depuran de forma probabilística, sin guardar registros de conexiones por más de un día una vez ejecutada la limpieza.

El identificador se deriva de `cf-connecting-ip`, comprobada en el servicio alojado. No se usa `X-Forwarded-For`, `X-Real-IP` ni un identificador enviado por JavaScript como alternativa. IPv6 se agrupa por /64. Se guarda un HMAC con secreto privado, nunca la IP en claro. Los clientes sin cabecera de origen verificable fallan de forma cerrada; el administrador verificado y `service_role` quedan exentos de estas cuotas de conexión.

Esta protección limita el abuso desde una misma conexión. No sustituye una protección de infraestructura frente a ataques distribuidos, ni evita por sí sola la rotación entre redes independientes. No añade límites al bot de Mercantil, que lee y actualiza compras con su acceso privado.

Ante un bloqueo de un cliente legítimo, revisar las cuotas y las compras pendientes de esa conexión; evitar desactivar toda la protección. El interruptor privado `enabled` sirve como recuperación operativa y no se expone al público.

Las pruebas en PGlite sustituyen las funciones criptográficas por equivalentes deterministas solo para probar agrupación y aislamiento. La base alojada utiliza las funciones reales de pgcrypto.
