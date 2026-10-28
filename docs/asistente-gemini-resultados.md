# Resultado real del piloto de atención general

28 de octubre de 2026. Modelo: `gemini-3.5-flash-lite`. Cuenta y clave configuradas por el titular en Supabase; no se extrajeron secretos.

Dos lotes de cinco consultas sintéticas, sin clientes, compras ni escrituras de base de datos. El segundo lote se ejecutó tras acortar el texto y evitar preguntas nuevas ante una solicitud de atención humana.

| Caso | Tiempo de llamada | Respuesta del segundo lote |
| --- | --- | --- |
| saludo | 8.206 s | Hola, le saludo con mucho gusto. Soy un asistente virtual. ¿En qué le puedo colaborar hoy? 😊 |
| identidad | 2.998 s | Hola. Soy un asistente virtual para orientarle de forma sencilla y cordial en esta prueba. ¿En qué le puedo ayudar hoy? 🤖 |
| paciencia | 2.993 s | Hola. Con gusto le explico con calma cada paso para que todo sea más claro 😊 |
| sencillo | 9.406 s | Hola. Con gusto le explico todo de forma breve y clara. ¿En qué le puedo ayudar hoy? 😊 |
| humano | 1.873 s | Entiendo perfectamente su preferencia de hablar con alguien. Que tenga un excelente día. 😊 |

Los cinco casos recibieron respuestas válidas en ambos lotes. El primer lote varió de 1,494 a 6,812 segundos; el segundo de 1,873 a 9,406 segundos. Son tiempos de llamada medidos en el servidor, no una promesa de respuesta inmediata al cliente. No se midió costo real facturado ni rendimiento bajo carga.

Revisión humana: todavía hay respuestas genéricas y la despedida al pedir una persona no ofrece un contacto concreto. No se declara listo para atención pública. Falta definir respuestas útiles verificadas y un mecanismo real de derivación, además de privacidad y cuotas globales si se plantea recibir texto libre.

Seguridad verificada: solicitud sin capacidad rechazada con HTTP 403; cuerpos con texto de clientes rechazados en tests; secreto ausente y proveedor con errores fallan sin reintentos. El diagnóstico se reemplazó por un handler cerrado HTTP 410 al terminar y se mantiene la validación JWT del gateway.

La IA continúa desconectada del asistente público. La prueba solo demuestra conectividad y comportamiento en estos ejemplos.

## Información confirmada por el titular

Se añadió una fuente común `asistente/informacion.js`: lunes a sábado a las ocho de la noche en Venezuela, YouTube, bombo real y detección automática del ganador. El precio se obtuvo de la configuración pública del administrador, únicamente la fila `precio_carton`, usando la clave pública dentro del servidor. No se accedió a datos de clientes.

Un tercer lote real probó horario, bombo, ganador, precio y domingos. Las cinco consultas respondieron; se pudo cargar el precio del administrador. Los tiempos por llamada fueron de 0,686 a 4,069 segundos. El precio coincidió con el valor consultado para esa prueba; no es un precio fijo guardado en el código.

- horario: Buenas, transmitimos de lunes a sábado a las 8:00 p. m., hora de Venezuela, en vivo por YouTube. 📺 (1.271 s).
- bombo: Hola. Las bolitas se sacan en vivo de un bombo real. 😊 (2.054 s).
- ganador: Hola. El sistema es automático y detecta al ganador de forma muy segura. 🤖 (1.889 s).
- precio: Buenas, el precio consultado es de 888 bolívares. 🎟️ (0.686 s).
- domingo: Hola. Las transmisiones son de lunes a sábado a las 8:00 p. m. No hay información confirmada sobre transmisiones los domingos. 📺 (4.069 s).

Revisión pendiente del estilo: el modelo añadió «de forma muy segura» sin que ese calificativo estuviera confirmado. La respuesta informativa publicada es determinista y dice únicamente que el sistema es automático y detecta al ganador. La IA sigue en piloto; este lote no activa preguntas libres de clientes. El endpoint temporal volvió al estado cerrado.
