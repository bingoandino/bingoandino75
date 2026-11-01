# Administrador: máximo cuatro sesiones

El administrador admite cuatro dispositivos/navegadores simultáneos. Una quinta sesión recibe HTTP 403 con instrucciones para cerrar manualmente otra sesión. Ningún nuevo intento reemplaza ni cierra sesiones existentes. Se conserva la caducidad de seguridad y la renovación por actividad de verify-session.

La RPC `admin_abrir_sesion` es SECURITY INVOKER y únicamente `service_role` puede ejecutarla después de la validación del administrador en `admin-auth`. El bloqueo transaccional por correo y las cuatro posiciones protegidas por un índice único impiden aperturas concurrentes por encima del límite. Cada dispositivo existente conserva su token al volver a iniciar. El cierre de sesión requiere token y dispositivo y afecta exclusivamente a esa sesión.

La ampliación de dos a cuatro se aplica mediante `supabase/admin-cuatro-sesiones.sql`. Conserva sesiones activas, tokens, contraseñas, OTP, datos de compras y las restricciones para otros tipos de sesión. La función `admin-auth` debe mantener `verify_jwt=false`, pues realiza la verificación explícita de credenciales y OTP. Actualizar además los avisos en `script.js`.

Validaciones: límite SQL de 1 a 4, quinto intento bloqueado, logout selectivo, renovación sin reemplazo, permisos de RPC y acceso con OTP.
