-- Endurecimiento de resolución de objetos y comprobaciones de administrador.
-- No cambia tablas, firmas, ACL, claves ni la lógica de los verificadores.
begin;
set local lock_timeout='1s';
set local statement_timeout='8s';
do $check$ begin
 if md5(pg_get_functiondef('public.fn_total_cartones_actual()'::regprocedure)) is distinct from '04a6968489a7dc873ea6999d88e3f5e3' then raise exception 'La definición cambió: public.fn_total_cartones_actual()';end if;
 if md5(pg_get_functiondef('public.limpiar_reservas_expiradas()'::regprocedure)) is distinct from 'f23cd18ecbb5805c8640ca531dfb0b5c' then raise exception 'La definición cambió: public.limpiar_reservas_expiradas()';end if;
 if md5(pg_get_functiondef('public.rpc_listar_cartones_huerfanos(interval)'::regprocedure)) is distinct from 'd61d9f0dbe2ef7cd740c4accd4e3d6ba' then raise exception 'La definición cambió: public.rpc_listar_cartones_huerfanos(interval)';end if;
 if md5(pg_get_functiondef('public.trg_validar_cartones_inscripcion()'::regprocedure)) is distinct from 'adabdd081c6e6f3b694ea5bcf8bd5d3b' then raise exception 'La definición cambió: public.trg_validar_cartones_inscripcion()';end if;
 if md5(pg_get_functiondef('public.trg_validar_numero_carton()'::regprocedure)) is distinct from '24542ca133315e8a695672afdb6de1d9' then raise exception 'La definición cambió: public.trg_validar_numero_carton()';end if;
 if md5(pg_get_functiondef('public.trg_validar_total_cartones_config()'::regprocedure)) is distinct from 'adf6c9188a4379a6209f290d425dc21f' then raise exception 'La definición cambió: public.trg_validar_total_cartones_config()';end if;
 if md5(pg_get_functiondef('public.trigger_limpiar_expiradas()'::regprocedure)) is distinct from '7d01368374c2ed2d54fbab90347e918f' then raise exception 'La definición cambió: public.trigger_limpiar_expiradas()';end if;
 if md5(pg_get_functiondef('public.rpc_eliminar_inscripcion_seguro(bigint)'::regprocedure)) is distinct from 'c3e7f2f270938df806530f756ac84dc7' then raise exception 'La definición cambió: public.rpc_eliminar_inscripcion_seguro(bigint)';end if;
 if md5(pg_get_functiondef('public.rpc_listar_respaldos()'::regprocedure)) is distinct from 'd1f6644e1f8d14c4cd7d758b36a2d0a3' then raise exception 'La definición cambió: public.rpc_listar_respaldos()';end if;
 if md5(pg_get_functiondef('public.rpc_respaldar_sorteo(text)'::regprocedure)) is distinct from 'aed5bf5cadb67d5a278c1d5174e66504' then raise exception 'La definición cambió: public.rpc_respaldar_sorteo(text)';end if;
 if md5(pg_get_functiondef('public.rpc_restaurar_sorteo(uuid)'::regprocedure)) is distinct from '2ce6b1a262af0fac420d7b15319fdd71' then raise exception 'La definición cambió: public.rpc_restaurar_sorteo(uuid)';end if;
end $check$;
insert into bingo_security.definition_backups(kind,payload)
select 'function_hardening_20261028_v1',jsonb_build_object('functions',jsonb_agg(to_jsonb(q)))
from (select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proconfig,p.proacl,pg_get_userbyid(p.proowner) owner from pg_proc p
 where p.oid in ('public.fn_total_cartones_actual()'::regprocedure,'public.limpiar_reservas_expiradas()'::regprocedure,'public.rpc_listar_cartones_huerfanos(interval)'::regprocedure,'public.trg_validar_cartones_inscripcion()'::regprocedure,'public.trg_validar_numero_carton()'::regprocedure,'public.trg_validar_total_cartones_config()'::regprocedure,'public.trigger_limpiar_expiradas()'::regprocedure,'public.rpc_eliminar_inscripcion_seguro(bigint)'::regprocedure,'public.rpc_listar_respaldos()'::regprocedure,'public.rpc_respaldar_sorteo(text)'::regprocedure,'public.rpc_restaurar_sorteo(uuid)'::regprocedure)) q;
alter function public.fn_total_cartones_actual() set search_path=pg_catalog,public,pg_temp;
alter function public.limpiar_reservas_expiradas() set search_path=pg_catalog,public,pg_temp;
alter function public.rpc_listar_cartones_huerfanos(interval) set search_path=pg_catalog,public,pg_temp;
alter function public.trg_validar_cartones_inscripcion() set search_path=pg_catalog,public,pg_temp;
alter function public.trg_validar_numero_carton() set search_path=pg_catalog,public,pg_temp;
alter function public.trg_validar_total_cartones_config() set search_path=pg_catalog,public,pg_temp;
alter function public.trigger_limpiar_expiradas() set search_path=pg_catalog,public,pg_temp;
CREATE OR REPLACE FUNCTION public.rpc_eliminar_inscripcion_seguro(_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cartones bigint[];
  v_liberados integer := 0;
begin
  if auth.role() is distinct from 'service_role' and public.es_admin_bingo() is not true then
    raise exception 'No autorizado para eliminar inscripción'
      using errcode = '42501';
  end if;

  select cartones
  into v_cartones
  from public.inscripciones
  where id = _id
  for update;

  if not found then
    return 0;
  end if;

  if v_cartones is not null then
    delete from public.cartones c
    where c.numero = any(v_cartones)
      and not exists (
        select 1
        from public.inscripciones i
        where i.id <> _id
          and c.numero = any(i.cartones)
          and i.estado in ('pendiente', 'aprobado')
      );

    get diagnostics v_liberados = row_count;
  end if;

  delete from public.inscripciones
  where id = _id;

  return v_liberados;
end;
$function$;
CREATE OR REPLACE FUNCTION public.rpc_listar_respaldos()
 RETURNS TABLE(id uuid, fecha timestamp with time zone, motivo text, compras integer, cartones integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if bingo_security.is_admin() is not true and auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 return query select s.id,s.created_at,s.reason,jsonb_array_length(s.payload->'inscripciones'),jsonb_array_length(s.payload->'cartones') from bingo_security.snapshots s order by s.created_at desc limit 30;
end $function$;
CREATE OR REPLACE FUNCTION public.rpc_respaldar_sorteo(_motivo text DEFAULT 'Respaldo manual'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if bingo_security.is_admin() is not true and auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 return bingo_security.make_snapshot(_motivo);
end $function$;
CREATE OR REPLACE FUNCTION public.rpc_restaurar_sorteo(_respaldo uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare datos jsonb; antes uuid; secuencia text;
begin
 if bingo_security.is_admin() is not true and auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 select payload into datos from bingo_security.snapshots where id=_respaldo;
 if datos is null then raise exception 'Respaldo no encontrado';end if;
 lock table public.inscripciones,public.cartones,public.configuracion in exclusive mode;
 antes:=bingo_security.make_snapshot('Antes de restaurar otro respaldo');
 delete from public.inscripciones;delete from public.cartones;delete from public.configuracion;
 insert into public.configuracion overriding system value select * from jsonb_populate_recordset(null::public.configuracion,datos->'configuracion');
 insert into public.cartones overriding system value select * from jsonb_populate_recordset(null::public.cartones,datos->'cartones');
 insert into public.inscripciones overriding system value select * from jsonb_populate_recordset(null::public.inscripciones,datos->'inscripciones');
 insert into bingo_security.reservation_owners select * from jsonb_populate_recordset(null::bingo_security.reservation_owners,datos->'owners');
 secuencia:=pg_get_serial_sequence('public.inscripciones','id');
 if secuencia is not null and exists(select 1 from public.inscripciones) then perform setval(secuencia::regclass,(select max(id) from public.inscripciones),true);end if;
 return antes;
end $function$;
commit;
