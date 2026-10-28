# Asistente en la página

Ruta independiente: `/asistente/`. El botón flotante de inicio abre esa misma ruta en un diálogo con iframe, sin login externo. La demo anterior `/prueba-asistente/` conserva datos ficticios y no escribe compras.

## Compras

Carga precio, total, modo de venta y cantidad fija desde la configuración pública de Supabase. Extrae los datos para transferir de los mismos elementos `adminPagoBanco`, `adminPagoTelefono` y `adminPagoCedula` de la página principal; falla si faltan o no son válidos. No duplica esos datos en una segunda configuración.

Solicita registro y Pago Móvil para premios, confirma los datos y reserva mediante los RPC seguros existentes. Cada conversación usa una credencial de reserva aleatoria independiente del proceso de compra manual. No muestra el botón de copiar transferencia hasta que la reserva esté confirmada. Informa del límite de cinco minutos y muestra el tiempo restante.

Valida tipo, firma y tamaño de la imagen, sube el comprobante al bucket privado y registra con `rpc_registrar_compra_segura`. El servidor determina precio y estado pendiente. El administrador usa los mismos campos y enlaces privados de comprobantes existentes; el verificador Mercantil conserva su flujo.

No se marca éxito hasta recibir el identificador de compra o reconciliar una respuesta perdida con la inscripción visible para la misma credencial. Un envío incierto bloquea nuevos intentos y remite a Verificar tu compra. Un cambio de cédula o cantidad libera la reserva anterior y requiere seleccionar nuevamente. Recargar pierde el archivo y el diálogo; las reservas abandonadas vencen con el mecanismo existente.

## Consultas e IA

Las preguntas conocidas se resuelven con reglas. Las demás remiten a soporte. **No es todavía un asistente generativo.** El cliente publicado no envía consultas a ningún proveedor de IA.

El código preparado en `supabase/functions/asistente-consultas` NO se desplegó: revisión automática rechazó transmitir consultas potencialmente personales a OpenAI sin autorización específica del usuario. Para activarlo hay que obtener esa autorización, configurar `OPENAI_API_KEY` y `BINGO_ASSISTANT_MODEL` en secretos del servidor, desplegar la función y conectar el método `question` del cliente. No pedir claves en el chat.

La función preparada no posee herramientas para comprar, aprobar, borrar ni consultar datos privados. Omite secuencias numéricas del texto y no recibe historial ni capturas; esto no garantiza eliminar todos los datos personales que alguien escriba libremente. Usa `store:false`, límites de texto y salida, y tiempo máximo. La autorización debe explicar que el texto puede contener datos personales pese al filtrado.

Cuotas preparadas y aplicadas: función SQL exclusiva de `service_role`, 8 consultas/minuto por red, 80/día por red y 500/día globales. IPv6 se agrupa por /64 y el origen se guarda como HMAC. El límite global restringe el número de consultas, no equivale a un presupuesto monetario exacto. Sin clave y modelo no hay llamadas al proveedor.

## Verificación

Pruebas de motor, interfaz DOM, reservas rechazadas/vencidas, precio cambiado, confirmación, copia conjunta, captura, doble envío y respuestas inciertas. Pruebas PostgreSQL aisladas de compra pendiente, privacidad y permisos de administrador/verificador, junto con cuotas privadas. Lecturas reales de configuración y disponibilidad sin crear compras de prueba en el sorteo activo. No se hizo una compra/pago real ni una prueba bancaria en la laptop. Las pruebas DOM no sustituyen una revisión visual en un teléfono.
