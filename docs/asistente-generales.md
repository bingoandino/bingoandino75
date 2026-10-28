# IA para consultas generales

Gemini se conecta exclusivamente a temas públicos: identidad virtual, horario habitual,
bombo real, detección automática, explicación mecánica general, saludo, agradecimiento
y aclaración del último tema. Privacidad y contacto con soporte tienen respuesta fija.

El cliente clasifica el tema localmente y transmite solo dos enums: `topic` y `style`.
No envía el mensaje original, registro, historial, archivos, cédulas ni teléfonos.
El endpoint rechaza campos adicionales y cualquier tema de ventas o pagos. El modelo
recibe hechos públicos revisados; nunca obtiene herramientas, credenciales de Supabase,
datos de clientes ni permisos de compra, reserva o verificación. No se envía el precio
a esta integración. La lógica de transacciones existente no se modifica.

No es un chat de IA abierto a cualquier pregunta: el reconocimiento local se limita a
estos temas. Los temas desconocidos siguen el tratamiento anterior del chat.
El contexto de aclaración conserva solo el último identificador de tema general.

## Protección y respaldo

- JWT del gateway y origen esperado; CORS por sí solo no es autenticación privada.
- Cuerpo máximo de 256 bytes, solo `topic` y `style` con valores permitidos.
- Tiempo y tamaño limitados para lectura de cuerpos y llamadas externas.
- Cuota persistente existente: 8 solicitudes/minuto/IP, 80/día/IP y 500/día global.
  Solo service_role puede consumirla. Las IP se agrupan y guardan mediante HMAC
  en la función existente; no se envían a Gemini.
- Sin IP confiable, secreto, cupo, respuesta válida o disponibilidad del proveedor,
  se usa respaldo aprobado. Los límites globales acotan abuso; no garantizan servicio
  ilimitado frente a denegación de servicio. El respaldo no requiere el proveedor.
- Caché temporal por tema/estilo, sin datos personales, con cuota antes de la caché del servidor.
- Rechazo de HTML, enlaces, teléfonos, acciones financieras, horarios no confirmados,
  texto demasiado largo, apodos y emojis de casino. Texto renderizado con textContent.
  Estas barreras reducen errores, no demuestran corrección semántica universal.

## Operación

Función: `asistente-generales`. Modelo explícito: `gemini-3.5-flash-lite`.
La clave permanece en el secreto `GEMINI_API_KEY` configurado por el titular.
`BINGO_GENERIC_AI_DISABLED=true` desactiva llamadas al modelo y mantiene respaldo.
No debe registrarse la clave ni añadirse a HTML, repositorio o respuestas.

La integración usa la cuenta y cuotas del titular. La prueba observada no garantiza
latencia fija, calidad para preguntas no probadas ni disponibilidad permanente en una región.
Las consultas generales no alteran los campos ni el paso de registro.

## Validación

Tests de clasificador, payload sin datos personales, campos extra rechazados, permisos
de cuota, errores, truncamiento, herramientas, XSS, números inventados, respaldo,
trato profesional y prueba de interfaz con el estado conservado. Se comprobaron también
consultas reales al endpoint con temas ficticios, sin datos de clientes.

## Revisión de seguridad del 28 de octubre

Se reforzó el filtro frente a correos y dominios inventados, caracteres invisibles y
números o palabras ocultos mediante Unicode. Los resultados rechazados no se cachean.
La llamada de cuota impide redirecciones. Las pruebas y los avisos pendientes del
proyecto están en [el informe de seguridad](seguridad-asistente-generales-20261028.md).
