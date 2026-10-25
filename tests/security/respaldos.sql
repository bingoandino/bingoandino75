begin;
create schema bingo_public_security_test;
create table bingo_public_security_test.cartones (like public.cartones including all);
create table bingo_public_security_test.inscripciones (like public.inscripciones including all);
create table bingo_public_security_test.configuracion (like public.configuracion including all);
insert into bingo_public_security_test.configuracion(clave,valore) values('total_cartones','800'),('ventas_abierta','true'),('cartones_obligatorios','1'),('precio_carton','10');
create function bingo_public_security_test.fn_total_cartones_actual() returns int language sql stable set search_path='' as $$select valore::int from bingo_public_security_test.configuracion where clave='total_cartones'$$;
create schema if not exists bingo_private_security_test;
revoke all on schema bingo_private_security_test from public, anon, authenticated;
create table if not exists bingo_private_security_test.settings(id boolean primary key default true check(id), enforce_owner boolean not null default false);
insert into bingo_private_security_test.settings(id) values(true) on conflict do nothing;
create table if not exists bingo_private_security_test.definition_backups(id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), kind text not null, payload jsonb not null);
create table if not exists bingo_private_security_test.snapshots(id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), reason text not null, payload jsonb not null);
create table if not exists bingo_private_security_test.reservation_owners(numero bigint primary key references bingo_public_security_test.cartones(numero) on delete cascade, token_hash bytea not null, cedula text not null);
create table if not exists bingo_private_security_test.rate_limits(key text primary key, window_start timestamptz not null, requests integer not null);
alter table bingo_private_security_test.settings enable row level security;
alter table bingo_private_security_test.definition_backups enable row level security;
alter table bingo_private_security_test.snapshots enable row level security;
alter table bingo_private_security_test.reservation_owners enable row level security;
alter table bingo_private_security_test.rate_limits enable row level security;
revoke all on all tables in schema bingo_private_security_test from public, anon, authenticated;

insert into bingo_private_security_test.definition_backups(kind,payload) values('antes_anti_sabotaje',jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='bingo_public_security_test' and p.proname in ('es_admin_bingo','rpc_reservar_carton','rpc_reservar_cartones_aleatorios','rpc_liberar_reserva')),
 'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname in ('public','storage'))));

-- El identificador del administrador proviene de auth.users, nunca de datos editables del usuario.
create or replace function bingo_private_security_test.is_admin() returns boolean language sql stable set search_path='' as $$
 select auth.role()='authenticated' and auth.uid()='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5'::uuid
$$;
-- Respaldos privados: los datos y comprobantes no se publican en el repositorio.
create or replace function bingo_private_security_test.make_snapshot(_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare id_respaldo uuid;
begin
 insert into bingo_private_security_test.snapshots(reason,payload) values(left(_reason,160),jsonb_build_object(
  'inscripciones',(select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) from bingo_public_security_test.inscripciones i),
  'cartones',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from bingo_public_security_test.cartones c),
  'configuracion',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from bingo_public_security_test.configuracion c),
  'owners',(select coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) from bingo_private_security_test.reservation_owners o))) returning id into id_respaldo;
 perform set_config('bingo_private_security_test.backup_done','true',true);
 return id_respaldo;
end $$;
create or replace function bingo_public_security_test.rpc_respaldar_sorteo(_motivo text default 'Respaldo manual') returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not bingo_private_security_test.is_admin() and auth.role()<>'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 return bingo_private_security_test.make_snapshot(_motivo);
end $$;
create or replace function bingo_public_security_test.rpc_listar_respaldos() returns table(id uuid,fecha timestamptz,motivo text,compras int,cartones int) language plpgsql security definer set search_path='' as $$
begin
 if not bingo_private_security_test.is_admin() and auth.role()<>'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 return query select s.id,s.created_at,s.reason,jsonb_array_length(s.payload->'inscripciones'),jsonb_array_length(s.payload->'cartones') from bingo_private_security_test.snapshots s order by s.created_at desc limit 30;
end $$;
create or replace function bingo_public_security_test.rpc_reiniciar_sorteo_seguro() returns uuid language plpgsql security definer set search_path='' as $$
declare id_respaldo uuid;
begin
 if not bingo_private_security_test.is_admin() and auth.role()<>'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 lock table bingo_public_security_test.inscripciones,bingo_public_security_test.cartones in exclusive mode;
 id_respaldo:=bingo_private_security_test.make_snapshot('Antes de reiniciar sorteo');
 delete from bingo_public_security_test.inscripciones;delete from bingo_public_security_test.cartones;
 -- Los archivos se conservan para poder restaurar el respaldo.
 return id_respaldo;
end $$;
create or replace function bingo_public_security_test.rpc_restaurar_sorteo(_respaldo uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare datos jsonb; antes uuid; secuencia text;
begin
 if not bingo_private_security_test.is_admin() and auth.role()<>'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 select payload into datos from bingo_private_security_test.snapshots where id=_respaldo;
 if datos is null then raise exception 'Respaldo no encontrado';end if;
 lock table bingo_public_security_test.inscripciones,bingo_public_security_test.cartones,bingo_public_security_test.configuracion in exclusive mode;
 antes:=bingo_private_security_test.make_snapshot('Antes de restaurar otro respaldo');
 delete from bingo_public_security_test.inscripciones;delete from bingo_public_security_test.cartones;delete from bingo_public_security_test.configuracion;
 insert into bingo_public_security_test.configuracion overriding system value select * from jsonb_populate_recordset(null::bingo_public_security_test.configuracion,datos->'configuracion');
 insert into bingo_public_security_test.cartones overriding system value select * from jsonb_populate_recordset(null::bingo_public_security_test.cartones,datos->'cartones');
 insert into bingo_public_security_test.inscripciones overriding system value select * from jsonb_populate_recordset(null::bingo_public_security_test.inscripciones,datos->'inscripciones');
 insert into bingo_private_security_test.reservation_owners select * from jsonb_populate_recordset(null::bingo_private_security_test.reservation_owners,datos->'owners');
 secuencia:=pg_get_serial_sequence('bingo_public_security_test.inscripciones','id');
 if secuencia is not null and exists(select 1 from bingo_public_security_test.inscripciones) then perform setval(secuencia::regclass,(select max(id) from bingo_public_security_test.inscripciones),true);end if;
 return antes;
end $$;
revoke all on all functions in schema bingo_private_security_test from public,anon,authenticated;
revoke all on function bingo_public_security_test.rpc_respaldar_sorteo(text),bingo_public_security_test.rpc_listar_respaldos(),bingo_public_security_test.rpc_reiniciar_sorteo_seguro(),bingo_public_security_test.rpc_restaurar_sorteo(uuid) from public,anon;
grant execute on function bingo_public_security_test.rpc_respaldar_sorteo(text),bingo_public_security_test.rpc_listar_respaldos(),bingo_public_security_test.rpc_reiniciar_sorteo_seguro(),bingo_public_security_test.rpc_restaurar_sorteo(uuid) to authenticated,service_role;


select bingo_private_security_test.make_snapshot('Antes de protección contra sabotaje');


select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into bingo_public_security_test.cartones(numero,cedula,ocupado,created_at,reserved_at) select n,'FICTICIO',true,now(),now() from generate_series(1,50) s(n);
insert into bingo_public_security_test.inscripciones(id,nombre,cedula,cartones,estado,banco_ref) values(500001,'Prueba','FICTICIO',array[1]::bigint[],'aprobado','REFERENCIA-FICTICIA');
do $test$ declare snap uuid; failure boolean:=false;begin
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform bingo_public_security_test.rpc_reiniciar_sorteo_seguro();exception when insufficient_privilege then failure:=true;end;
 assert failure,'Un anónimo no puede reiniciar';
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',true);failure:=false;
 begin perform bingo_public_security_test.rpc_respaldar_sorteo('Prueba');exception when insufficient_privilege then failure:=true;end;
 assert failure,'Otra cuenta autenticada no puede respaldar';
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"5121c2ba-c8f1-40f8-8b3e-130a75f60ac5"}',true);
 snap:=bingo_public_security_test.rpc_reiniciar_sorteo_seguro();
 assert not exists(select 1 from bingo_public_security_test.cartones);assert exists(select 1 from bingo_private_security_test.snapshots where id=snap);
 perform bingo_public_security_test.rpc_restaurar_sorteo(snap);
 assert (select count(*) from bingo_public_security_test.cartones)=50,'Restaura los 50 cartones';
 assert exists(select 1 from bingo_public_security_test.inscripciones where id=500001 and banco_ref='REFERENCIA-FICTICIA' and estado='aprobado'),'Conserva la verificación del bot';
end $test$;
rollback;
select true as backup_security_passed;
