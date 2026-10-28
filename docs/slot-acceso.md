# Acceso privado de la ruleta

El servidor de slot-premios exige contraseña del administrador y una verificación OTP posterior.

1. password-check usa internamente la verificación existente de admin-auth y emite un secreto aleatorio de 256 bits. Solo guarda su SHA-256 en slot_accesos, válido para completar el código durante 10 minutos. No almacena la contraseña.
2. El cliente solicita el código del correo solo tras validar la contraseña.
3. authorize valida el usuario en Supabase Auth y exige un amr OTP posterior al desafío. Vincula el desafío una sola vez al session_id verificado, con actualización condicional para evitar doble uso concurrente.
4. Toda lectura o cambio de la ruleta requiere esa autorización y el mismo session_id. Dura 8 horas y admite refrescar el JWT dentro de la misma sesión. Salir la revoca en el servidor.
5. Una sesión anterior que solo usó correo no obtiene acceso. El frontend v1.0.12 invalida su almacenamiento v1 y pide reingresar.

La tabla tiene RLS activo y sin acceso directo de anon o authenticated. Solo service_role tiene select/insert/update. No se cambian admin-auth, compras, pagos, reservas ni permisos de otras apps.

Pruebas: node --test tests/slot-premios.test.mjs tests/slot-access-client.test.mjs.
