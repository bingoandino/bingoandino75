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
