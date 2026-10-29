# Animación del cilindro

Duraciones seleccionables: 3, 5 y 8 segundos. La preferencia se conserva en el navegador. Las opciones anteriores Rápida y Normal migran a 3 y 5 segundos; una instalación nueva comienza en 5 segundos.

El servidor sigue seleccionando y guardando al ganador antes de la animación. El cambio solo afecta a su presentación. Se mezclan personas de toda la lista habilitada, conservando nombre y cartón juntos; tener muchos cartones no llena la animación con el mismo nombre. Se respeta la exclusión de ganadores previos. Una lista pequeña se repite cuando es necesario.

El cilindro usa una textura circular de seis paneles que se renuevan mientras avanza, en lugar de repetir seis nombres fijos. El tamaño de la textura no crece con la cantidad de participantes. El último panel es el ganador exacto recibido del servidor, con vecinos variados y frenado gradual. Se respeta la preferencia de movimiento reducido.

Pruebas: duraciones y migración, listas grandes y pequeñas, variedad, exclusión, nombre/cartón asociados, ganador final, tiempo exacto por cuadros, tamaño de canvas limitado y retirada de la animación. QA de navegador con datos ficticios; sin giros ni entregas reales.
