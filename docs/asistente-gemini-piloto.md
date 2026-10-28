# Piloto de Gemini para atención general

Estado: código de prueba aislado, apagado por defecto. No está conectado al asistente público.
No modifica compras, Mercantil, Supabase, reservas ni el widget. No crea una página de prueba pública. El diagnóstico temporal de servidor requiere una capacidad privada aleatoria, tiene caducidad y se cierra al terminar.

## Alcance

Cinco conversaciones sintéticas: saludo, identidad, paciencia, texto sencillo y atención humana.
El ejecutor solo admite identificadores de casos fijos, sin mensajes de clientes ni archivos.
Gemini genera la respuesta; no se simula como si ya se hubiera probado el modelo real.
Máximo cinco llamadas por proceso, sin reintentos, con límite de tiempo, tamaño y salida JSON. Respuestas limitadas a treinta palabras.
La validación de salida es una barrera adicional; no demuestra que todas las respuestas sean correctas.
Un piloto aprobado tampoco demuestra aptitud para ventas o servicios de juegos de azar.

## Pruebas sin proveedor

`node --test tests/asistente-gemini-piloto.test.mjs`

Estas pruebas usan respuestas simuladas y no consumen saldo ni envían información a Google.

## Ejecución real pendiente

1. El titular verifica su acceso a Google AI Studio y la API desde Venezuela, las condiciones
   del servicio y la facturación correspondiente. No se propone eludir restricciones regionales.
2. Configurar mediante el gestor seguro de secretos del servidor `GEMINI_API_KEY`,
   `GEMINI_PILOT_MODEL` y `GEMINI_PILOT_ENABLED=true`. Nunca guardar la clave en GitHub,
   HTML, JavaScript público, el chat, un argumento de shell o un archivo descargable.
   El modelo es explícito: comprobar su disponibilidad y precio en esa cuenta antes de elegirlo.
3. Ejecutar `node herramientas/asistente-ia/probar.mjs` en el servidor. El ejecutor termina
   con código distinto de cero ante configuración ausente, límites, errores o salida rechazada.
4. Revisar manualmente las cinco respuestas y medir tiempo y costo reales. Deshabilitar el
   piloto al terminar. Estos resultados son requisito antes de plantear integración pública.

El titular ya guardó GEMINI_API_KEY en Supabase. El 28 de octubre de 2026 se comprobó la conexión con cinco conversaciones ficticias mediante un diagnóstico protegido y temporal, sin extraer la clave del servidor. Se revisó el estilo y se ajustó la respuesta a solicitudes de atención humana. El diagnóstico se cierra al terminar; esto no activa Gemini en el asistente público.
Para una integración futura de consultas libres harán falta consentimiento y tratamiento de
datos personales, autenticación, cuotas globales en servidor, revisión del alcance y validación
de respuestas. Este ejecutor no es un endpoint público y no debe exponerse como tal.

## Referencias técnicas consultadas

- https://ai.google.dev/gemini-api/docs/available-regions (incluye Venezuela)
- https://ai.google.dev/api/generate-content (REST, configuración y respuestas)
- https://ai.google.dev/gemini-api/terms (datos, cuenta y facturación)
- https://developers.google.com/terms/ (restricciones de uso)

Revisadas el 28 de octubre de 2026. La disponibilidad regional no sustituye la revisión
de condiciones para cada uso ni una prueba real desde la cuenta del titular.

## Protección del diagnóstico temporal

`piloto-protegido.mjs` admite solo un POST vacío, autenticado mediante una capacidad aleatoria de 256 bits cuyo hash se incluye en el despliegue temporal. Se mantiene la verificación JWT del gateway. No se pasan datos de clientes, claves de base de datos ni archivos al modelo. No se lee ni escribe la base de datos. Cada instancia permite un solo lote; este límite no es global entre instancias, por lo que la capacidad no se distribuye, caduca y el diagnóstico se reemplaza por un handler cerrado después de la prueba. No hay CORS para el navegador.

## Contexto del negocio

El piloto comparte los hechos de `asistente/informacion.js` con las respuestas informativas del chat. `contextoInformativo` acepta solo un precio numérico, positivo y finito leído por el servidor; cualquier ausencia o error obliga a indicar que no se pudo consultar. El precio no se toma del texto de la pregunta. Los cinco casos informativos se seleccionan en código, no desde la solicitud HTTP. La prueba temporal del 28 de octubre leyó únicamente `configuracion.precio_carton` y se cerró al terminar.
