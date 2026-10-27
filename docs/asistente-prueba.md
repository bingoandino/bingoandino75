# Prueba del asistente

Ruta independiente: `/prueba-asistente/` en bingoandino75.com. No requiere ChatGPT ni iniciar sesión. No está enlazada desde la página de ventas ni modifica sus compras.

La primera respuesta es únicamente: «¡Hola! 😊 Bienvenido a BingoAndino75. ¿En qué puedo ayudarte?» El precio se presenta al preguntar por él o manifestar intención de compra.

La demo usa una conversación guiada, precio y disponibilidad ficticios. No tiene conexión a la base de datos ni a un proveedor de IA. La política de contenido bloquea conexiones de red desde el chat; los datos y las imágenes permanecen en memoria y se descartan al recargar o iniciar otra prueba.

El botón de pago copia banco, teléfono, cédula y monto juntos. Los datos de pago son ficticios y no deben usarse para transferir.

Las pruebas están en `tests/asistente/`. Antes de activarlo para clientes se requiere integrar IA y operaciones de compra controladas desde el servidor, y verificar el flujo completo en un entorno de pruebas.
