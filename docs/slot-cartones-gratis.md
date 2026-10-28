# Cartones gratis del slot — preparado, sin publicar

## Alcance
- Solo premios cuyo texto sea «1 cartón gratis» (también se admite sin tilde, espacios adicionales y mayúsculas).
- Botón manual al final, con vista previa de ganadores pendientes y confirmación.
- La asignación elige números disponibles del sorteo actual y copia nombre, teléfono, cédula de registro, referido y los tres campos de Pago Móvil del registro aprobado ganador. No confunde cédula del participante y cédula de Pago Móvil.
- Máximo un cartón gratis por persona y por sorteo de bingo, identificado por cédula de registro. Se aplica aunque gane varias veces, tenga varios cartones o se abra otra sesión del slot para el mismo bingo. La vista previa muestra repeticiones y entregas anteriores.
- Cada nuevo registro queda aprobado, referencia 0000, monto 0, sin comprobante y origen premio_slot. No simula verificación bancaria.
- No se modifican compras previas, pagos, referencias ni reservas existentes. La recaudación y el contador existentes conservan su cálculo, según lo solicitado.
- Se excluyen premios_slot de los dos endpoints públicos de top y del top calculado por auditoria-pagos. Permanecen en aprobados, consulta de cartones y datos para pago de premios.
- Administrador: etiqueta «Premio del slot» y filtro de origen.
- Slot: muestra el cartón ganador y por separado el nuevo cartón entregado. Copia e imagen incluyen la entrega; los datos bancarios no se exponen en la ruleta.
- Una entrega se guarda por drawId y personId en la sesión, con índices únicos por giro y por ancla del sorteo + cédula normalizada en inscripciones. También se consulta el historial de entregas del mismo bingo para evitar duplicar incluso si se elimina manualmente el registro gratuito. Reintentar no crea otro registro. Ganadores con entrega registrada no pueden borrarse desde la X del slot.
- La lista de participantes del slot permanece fija; las tarjetas nuevas entran solo si el operador actualiza aprobados explícitamente.
- Pago Móvil incompleto se conserva y se advierte en la vista previa.

## Integridad
La RPC es SECURITY INVOKER, solo service_role puede ejecutarla, y requiere rol service_role explícito. Edge valida contraseña+OTP, dueño y HMAC de identidad antes de generar las fuentes. SQL revalida el cartón y su dueño dentro de la transacción.
Adquiere primero el bloqueo de registro de compras y luego bloqueo exclusivo de escrituras en inscripciones/cartones. Comprueba el ancla del sorteo, bloquea la sesión y asigna todo o nada. Excluye cada fila de cartones, incluso reservas, y cartones en inscripciones pendientes/aprobadas aunque no tengan fila de ocupación.
No se usa el endpoint de compra del cliente ni se inventa comprobante.

## Pruebas
- PostgreSQL aislado con PGlite 0.5.10: vista previa sin escrituras; asignación exacta; exclusión de USD, reservas y compras; idempotencia; copia de los datos; top; falta de cupos; ancla reiniciada; fuente sustituida; falta de aprobación; roles no autorizados.
- API: fuentes/dueño derivados en servidor; entrega y protección de la X; no filtra cédula a la respuesta; mantiene el acceso con contraseña+OTP.
- App de pagos: carga registros de premio, consulta su cartón con Pago Móvil exacto y excluye de top.
- Comandos:
  node --test tests/slot-*.test.mjs tests/slot-*.test.cjs
  node --test tests/premios-slot.test.cjs (repo auditoria-pagos)

## Orden de publicación pendiente
1. Revisar/respaldar y aplicar supabase/slot-cartones-gratis.sql.
2. Desplegar slot-premios incluyendo award-rules.mjs, sin cambiar verify_jwt=true ni sus archivos de acceso.
3. Publicar las ramas de web/slot y auditoria-pagos. Mantener auth.js de contraseña+OTP.
4. Recargar ambas apps. El operador confirma la primera entrega; nunca lo hace una prueba automática.
5. Pulsar «Actualizar aprobados» en pagos tras entregar.
No se ejecutó migración en producción ni se entregaron cartones reales al preparar esta versión.

## Límite deliberado
El ancla actual deriva del menor id de inscripción; ante reinicio o borrado del registro mínimo se bloquea la entrega. Si se elimina manualmente un cartón de premio en el administrador, no se vuelve a entregar automáticamente: la marca histórica impide duplicarlo.


## Anuncio para grupos
Después de confirmar las entregas se abre un anuncio de texto con el botón «Copiar anuncio». Cada persona tiene su bloque con 🎊, nombre y cartón nuevo asignado; indica que fueron asignados al azar y que ya pueden consultarlos en «Verificar tu compra». Solo incluye entregas confirmadas; no incluye cédulas, teléfonos ni datos bancarios. Hay botones de copia directa en el sorteo y en resultados del historial. Si el portapapeles no está disponible, permite seleccionar y copiar manualmente. No envía mensajes automáticamente. Sustituye el anuncio en imagen; conserva la exportación general de resultados existente.

La asignación inserta la inscripción con estado `aprobado`, sin aprobación manual posterior. «Verificar tu compra» consulta las inscripciones con la cédula original y muestra los cartones asociados. Esto no simula una verificación bancaria de un regalo sin pago.
