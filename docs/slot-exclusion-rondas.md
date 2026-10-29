# Ganadores de rondas y consolación

La app de pagos envía los cartones registrados en las rondas (incluido el lleno final y todos los ganadores cuando hay empate). No incluye Top, pozo ni consolación. Puede enviar rondas parciales y volver a enviar para reemplazar/corregir la lista del bingo actual.

1. Cargar aprobados actuales en la app de pagos. Este paso vincula la lista con el bingo vigente.
2. Registrar todos los cartones ganadores de las rondas.
3. Pulsar **Enviar / actualizar ganadores en la ruleta** debajo de las rondas. Consultar la lista enviada en ese mismo recuadro.
4. En la ruleta, elegir **10 USD**. Aparecen el número de personas excluidas y una lista desplegable con nombre, cartón y ronda. Se actualiza al cargar/seleccionar, manualmente y cada 30 segundos; el servidor vuelve a consultar antes de elegir cada ganador.

Si no se envió ninguna lista, se muestra una advertencia y se permite girar. Si se enviaron algunos ganadores y luego se agregan otros en pagos, hay que volver a enviar. La app de pagos advierte al editar cartones, fecha o cantidad de rondas. No se presupone que la lista esté completa por haberla enviado.

La exclusión se aplica a la cédula del registro, con todos sus cartones, incluso en modo por cartón o al permitir ganadores repetidos. La ruleta recibe solo una identidad HMAC, nunca la cédula. Solo aplica a `10 USD`, `10$` o `$10` (ignorando mayúsculas/espacios). Cambiar el texto a otro premio no lo convierte automáticamente en consolación. El premio de 1 cartón gratis conserva sus reglas.

## Datos y permisos

`supabase/slot-rondas.sql` crea una tabla independiente, con RLS y acceso directo revocado a clientes. No modifica inscripciones, pagos, reservas ni publicaciones. La escritura requiere un usuario autorizado en la lista existente de publicadores; se valida nuevamente cada dueño aprobado en el servidor. Se guarda la cédula del registro, nunca la de Pago Móvil.

Las funciones públicas son envolturas invoker de funciones en un esquema privado, con search_path vacío y permisos explícitos. La consulta pública deliberada devuelve únicamente nombre, cartón, ronda, fecha, conteo y ancla técnica. Permite mostrar la lista durante la transmisión; no publica datos de contacto/bancarios ni abre la ruleta privada.

La lista queda vinculada al ancla de inscripciones actual, igual que las sesiones del slot. Un nuevo bingo no hereda exclusiones del anterior. Abrir una nueva sesión de premios del mismo bingo conserva la lista. Los giros existentes no se cambian retroactivamente. Cada giro registra si había una lista enviada y su fecha de envío; la sesión guarda la lista utilizada. Los reintentos devuelven el mismo ganador.

Pruebas: tests/slot-premios.test.mjs, tests/slot-rounds-database.test.cjs y suite de pagos tests/rondas-ruleta.test.cjs. Cubren permisos, empates, identidad de registro, varios cartones, listas faltantes, corrección/reenvío, reinicio del bingo, idempotencia y conservación de compras.
