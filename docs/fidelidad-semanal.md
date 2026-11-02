# Premio a la Fidelidad Binguera — implementación aislada

## Alcance y estado

Esta funcionalidad vive en la rama `feature/fidelidad-semanal-20261102`.
**No aplicar SQL ni integrar la rama en producción hasta completar la verificación final.**
No modifica el bot de Mercantil, las inscripciones, la app de pagos ni el endpoint `slot-premios`.
La interfaz se añade al menú del tragamonedas y utiliza su autenticación existente.

## Reglas

- Una persona participa solo si tiene una compra **aprobada y con monto mayor a cero** en cada una de las seis jornadas (lunes a sábado).
- La identidad es la **cédula del comprador**, no la del titular del pago móvil.
- No cuentan los cartones gratuitos entregados por el slot ni los premios de dinámicas.
- Quedan excluidos los compradores que ganaron cualquier ronda, lleno final o consolación durante la semana, aunque el cartón ganador fuera uno de regalo.
- Cada comprador tiene una sola oportunidad y solo puede ganar una vez por semana.
- El sábado, los seis días deben tener resultados completos publicados; de lo contrario no hay giro.
- La cantidad de ganadores es variable. El premio es editable. **No se realizan pagos ni asignaciones automáticas de cartones**.
- Se conserva la lista y el historial de giros independientes de la ruleta del día.

## Captura privada y regla del sábado

Cuando la aplicación de pagos publica el resultado diario en `public.resultados_publicados`, un disparador nuevo copia exclusivamente las compras aprobadas necesarias para Fidelidad y asocia los cartones ganadores a sus compradores. **Nunca añade ni modifica una compra de producción**.
Las capturas se congelan al publicar: los reinicios y las pruebas del domingo no cambian la información del sábado.

Los registros están en el esquema privado `fidelidad`; no se exponen cédulas al navegador.
Si falla la captura, se registra la fecha y el error sin bloquear la publicación existente; sin captura, Fidelidad se bloquea. No hay reparación automática utilizando compras posteriores.

## Autenticación y aislamiento

La Edge Function nueva `slot-fidelidad` confirma el mismo JWT y la autorización de contraseña + código de correo usada por el tragamonedas. Consulta solo `fidelidad_estado` y `fidelidad_girar`. Los RPC públicos están explícitamente restringidos a `service_role`, y las tablas se mantienen fuera del esquema público.

El servidor escoge un ganador con una selección aleatoria de personas elegibles, dentro de una transacción con bloqueo de la semana. Los ganadores no pueden repetirse; el UUID de un intento permite recuperar el mismo resultado después de un corte de conexión. La animación del cilindro es visual y no decide el ganador.

## Activación (solo después de verificar)

1. Confirmar GitHub Actions: pruebas de slot, interfaz, SQL y acceso privado; sin regresiones en resultados publicados.
2. Probar la migración en un entorno PostgreSQL de prueba idéntico al real, incluida la captura sin bloquear la publicación.
3. Obtener un respaldo previo del esquema y confirmar plan de reversión.
4. Aplicar `supabase/fidelidad-semanal.sql` en una ventana segura, antes de la publicación del sorteo del lunes. La captura es **prospectiva**, no rellena datos pasados.
5. Desplegar la nueva Edge Function `slot-fidelidad` con `verify_jwt=true`, manteniendo intacta `slot-premios`.
6. Integrar a `main` los archivos de `slot/`, tras verificar acceso en móvil y laptop.
7. Validar en producción sin efectuar ningún giro: acceso denegado sin sesión, seis fechas, datos ocultos y funcionamiento normal de la app de pagos.
8. El sábado, después de publicar **rondas, final y consolación**, comprobar que la lista sea coherente antes del primer giro oficial.

## Precauciones

- No confundir las pruebas antiguas de domingo con compras del sábado.
- La captura se hace al publicar resultados, **no al reiniciar** y no incluye compras pendientes.
- Un día sin resultados publicados o con ganadores no identificables bloquea la dinámica.
- La capa nueva comparte únicamente la animación y la autenticación con el slot existente. No cambia los giros, la consolación ni los premios gratis.
- Si una transacción publica resultados antes de completar consolación, no hay captura válida. Debe corregirse el proceso con revisión administrativa; no admitir una importación tardía arbitraria.
