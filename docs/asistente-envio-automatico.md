# Envío automático al completar el pago

El asistente registra la compra pendiente cuando recibe el último de los dos datos: capture válido y referencia válida. Funciona en ambos órdenes. Mantiene la confirmación previa de nombre/cédula y Pago Móvil, la reserva vigente, el precio del servidor y la posterior verificación bancaria.

Se elimina la tarjeta y pregunta de confirmación final. Los enlaces a Términos y Privacidad y el aviso de envío automático aparecen junto a los datos para pagar, antes de enviar el capture y la referencia.

Adjuntar archivos usa la misma exclusión de operaciones que enviar mensajes; los eventos simultáneos no duplican el registro. Los envíos con respuesta incierta se reconcilian antes de cualquier nuevo intento, incluso si llega otro capture. No modifica ni aprueba pagos, ni crea compras de prueba en producción.

Pruebas: capture primero, referencia primero, dato incompleto, reserva vencida, cambio de precio, fallo de subida, reconciliación, doble evento y flujo DOM que muestra Compra registrada / Pendiente de verificación sin otra pregunta.
