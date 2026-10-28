# Administrador: máximo dos sesiones

El administrador admite dos dispositivos/navegadores simultáneos. Una tercera sesión recibe HTTP 403 con instrucciones para cerrar manualmente una de las otras dos. Nunca se reemplaza ni cierra una sesión por un nuevo intento de acceso. Se conserva la caducidad de seguridad existente y la renovación por actividad de verify-session.

La RPC admin_abrir_sesion es SECURITY INVOKER y solo service_role puede ejecutarla, después de la validación del administrador en admin-auth. Un bloqueo transaccional por correo y dos posiciones únicas en base de datos impiden carreras de apertura. Cada dispositivo activo mantiene su token al repetir el acceso. El logout exige el token y el dispositivo, y cierra exclusivamente esa sesión.

La actualización conserva los tokens y las sesiones existentes; solo añade su posición. Se mantienen las restricciones originales para tipos distintos de admin. No modifica contraseñas, OTP, datos de compras ni el acceso independiente del slot. Publicación: aplicar admin-dos-sesiones.sql, desplegar admin-auth con verify_jwt=false (ya valida al administrador dentro del código) y publicar los mensajes de script.js.

Validación aislada: dos sesiones, rechazo de la tercera, renovación sin reemplazo, logout selectivo, aperturas concurrentes, imposibilidad de eludir las posiciones, permisos, rutas OTP y contraseña, y rechazo sin autenticación.
