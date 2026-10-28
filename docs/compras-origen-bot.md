# Marca de compras del bot

Las nuevas compras enviadas por `/asistente/` incluyen `origen_registro=bot`. El RPC de compra admite únicamente `bot` o `compra`; cualquier otro valor usa `compra`, sin permitir simular premios del slot. El precio sigue calculándose en el servidor, la compra queda pendiente y conserva los controles de reserva, comprobante y datos de Pago Móvil.

El administrador muestra «🤖 Compra del bot» debajo del nombre y permite filtrar esas compras. «Compras (todas)» reúne las compras directas y las del bot; los premios del slot siguen separados. Las compras del bot conservan su participación normal en el Top una vez aprobadas. La etiqueta no implica pago verificado. No se cambian registros anteriores ni se intenta deducir su origen.

La marca identifica el canal del asistente; es metadato enviado por el cliente, no una prueba de identidad ni de verificación bancaria. No identifica al verificador Mercantil, que conserva su flujo independiente.

Publicación: ejecutar `supabase/compras-origen-bot.sql` y publicar frontend. Pruebas aisladas de origen, precio/estado, reserva, rechazo de premios simulados, visualización segura y filtros, además del flujo del asistente.
