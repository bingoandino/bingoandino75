-- Ejecutar solo después de verificar publicados script.js y referencia.js protegidos.
-- No borra datos, no cambia columnas y conserva el acceso service_role del bot.
create or replace function public.es_admin_bingo() returns boolean language sql stable set search_path='' as $$
 select coalesce(auth.role()='authenticated' and auth.uid()='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5'::uuid,false)
$$;
revoke execute on function public.rpc_reservar_carton(bigint,text,bigint),public.rpc_reservar_cartones_aleatorios(integer,text,bigint),public.rpc_liberar_reserva(bigint,text,bigint) from public,anon,authenticated;
-- Los clientes registran sus compras mediante rpc_registrar_compra_segura, que verifica la reserva.
create policy inscripciones_insert_solo_admin_directo on public.inscripciones as restrictive for insert to anon,authenticated with check(public.es_admin_bingo());
-- Mantiene las políticas existentes y limita las escrituras de otras cuentas.
create policy bingo_upload_protegido on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id='comprobantes' or public.es_admin_bingo());
create policy bingo_delete_solo_admin on storage.objects as restrictive for delete to anon,authenticated using(public.es_admin_bingo());
create policy bingo_update_solo_admin on storage.objects as restrictive for update to anon,authenticated using(public.es_admin_bingo()) with check(public.es_admin_bingo());
create policy bingo_clave_reinicio_privada on public.configuracion as restrictive for select to anon,authenticated using(clave<>'clave_reinicio' or public.es_admin_bingo());
