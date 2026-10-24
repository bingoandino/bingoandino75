# Sorteos Instagram · BingoAndino75

Aplicación independiente de ChatGPT, con cliente estático React/Vite y función Supabase `instagram-sorteos`. Conserva modalidades por persona, por comentario o por combinaciones diferentes de al menos tres menciones. Incluye animación, confeti, vista previa, confirmación e historial descargable de sesión.

## Estructura
- `frontend`: código y lockfile del cliente. `pnpm install --frozen-lockfile`, `pnpm build`.
- `backend`: código de la función y esquema privado de Postgres.
- `tests`: pruebas de reglas y autenticación. `node --test tests/*.test.mjs`.
- Salida estática publicada en `/sorteos-instagram/`. No modifica archivos de la página de inicio ni pagos.

## Seguridad
La API comprueba cada sesión y el rol de administrador. Sesiones opacas de 12 horas; solo se guardan sus hashes. El navegador guarda el token de sesión en sessionStorage, separado de la cuenta del administrador. Cerrar sesión y cambiar contraseña revoca sesiones en el servidor. La clave de Instagram y el pepper de la contraseña se guardan cifrados en Vault y nunca se envían al cliente. La función SQL pública requiere service_role y delega a una función privada que solo lee los IDs de secretos propios de la aplicación. No se conceden permisos nuevos de lectura general sobre Vault. Migración de configuración de un solo uso y con vencimiento.

## Administración
Acceso del operador con la contraseña existente (mínimo 8 caracteres). Administración con código de Supabase enviado al correo `bingoandino75@gmail.com`, validando el UUID autorizado. No depende de login ni APIs de OpenAI.

## Restauración
Respaldo del sitio en rama `backup/antes-sorteos-instagram-20261024`. La aplicación original conserva su versión anterior. Para retirar el nuevo cliente basta revertir el commit que añade los dos directorios del sorteo. Los datos del bingo y los pagos no se migran ni se modifican.
