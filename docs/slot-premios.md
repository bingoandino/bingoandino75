# Bingo Andino 75 · Slot de premios

Aplicación independiente en `https://bingoandino75.com/slot/`. PWA con acceso del administrador por contraseña y código de correo, participantes aprobados de la lista actual, slot, premios editables, resultados de ocho ganadores e historial de sesiones.

## Uso

1. Ingresar con las credenciales del administrador. Verificar el código recibido por correo.
2. Cargar aprobados actuales. Comprobar las cantidades de personas y cartones.
3. Elegir premio y reglas. Con una participación por persona, cada identidad tiene la misma probabilidad y se selecciona un cartón suyo al azar. En modo por cartón, cada cartón tiene una oportunidad. La exclusión se aplica por persona o cartón según el modo activo.
4. Girar. El servidor registra el ganador antes de la animación; Siguiente ganador inicia otro giro con un clic. La lista queda fija hasta actualizarla.
5. Ampliar resultados para ver ocho por página, copiar nombres/cartones/premios o guardar una imagen con hasta ocho por archivo.
6. Nueva sesión crea otro registro del slot; conserva el historial y no reinicia el bingo ni borra compras.
7. Chrome/Edge: menú → Instalar aplicación. En iPhone: Safari → Compartir → Agregar a pantalla de inicio. No requiere ChatGPT.

## Límites y separación

- Los giros leen aprobados y guardan su estado en `slot_premios_sesiones`. La entrega opcional crea registros separados de premio y ocupaciones nuevas; ver `slot-cartones-gratis.md`.
- La función `slot-premios` valida el usuario con Supabase Auth y comprueba su ID de administrador. No se expone una clave de servicio en el navegador.
- El historial no tiene permisos para `anon` ni `authenticated`; el backend autorizado accede a la tabla mediante su clave de servidor.
- No modifica compras, reservas ni pagos existentes. La entrega crea aprobados gratuitos con referencia 0000 y excluye esos registros de los tops. No consulta claves de reinicio.
- Actualmente `partida_id` es nulo en la web. Se identifica la generación de datos por el menor ID de inscripción existente. El reinicio actual elimina las inscripciones sin reiniciar su secuencia, por lo que la siguiente generación cambia de ancla. Si se elimina individualmente la inscripción de menor ID, se requiere una nueva sesión como precaución.
- Cada giro vuelve a verificar el ancla y la aprobación de todos los cartones cargados. Las aprobaciones posteriores requieren actualizar manualmente.
- Los números se conservan tal como llegan de la base de datos; no se agregan ceros. Se rechaza un cartón aprobado para dos identidades.
- La cédula solo se utiliza en el servidor para agrupar personas. La app recibe un identificador HMAC, nombre y cartón; nunca teléfono ni datos bancarios.
- El modo de ejemplo no carga datos reales ni escribe resultados del bingo.
- Se necesita internet para cargar aprobados, girar y recuperar historial. La instalación almacena la interfaz, sin cachear respuestas de autenticación ni datos del servidor.
- El ancla de origen y la comprobación de aprobación se leen antes del registro optimista del giro. No constituyen un bloqueo transaccional del reinicio del bingo; evitar reiniciar el bingo durante una dinámica. Un giro ya registrado se conserva como parte del historial aunque luego se reinicie el bingo.

## Persistencia y concurrencia

`drawId` hace idempotente el reintento de un giro. Una actualización condicional por `version` impide que dos giros concurrentes sobrescriban el estado. El navegador conserva un identificador pendiente para recuperar el resultado ante cortes de red. Las sesiones se consultan desde Historial. La X elimina resultados individuales; si el premio ya fue entregado, se bloquea su eliminación para preservar la constancia.

## Desarrollo

- Archivos estáticos: `slot/`.
- Edge Function: `supabase/functions/slot-premios/`.
- Esquema aditivo: `supabase/slot-premios.sql`.
- Pruebas: `node --test tests/slot-*.test.mjs tests/slot-*.test.cjs`.
- La función desplegada usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno del servidor.
- La revisión de permisos espera RLS habilitado y sin políticas públicas, con el acceso de clientes revocado. El aviso informativo del linter por ausencia de políticas es intencional.
- Las credenciales y el código real del administrador deben verificarse por su titular; las pruebas automáticas usan una API simulada y datos ficticios.
