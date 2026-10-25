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
create or replace function bingo_private_security_test.token_hash() returns bytea language plpgsql stable set search_path='' as $$
declare t text;
begin
 t:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-bingo-reserva';
 if t is null or t !~ '^[a-f0-9-]{36,128}$' then return null; end if;
 return extensions.digest(t,'sha256');
end $$;
create or replace function bingo_private_security_test.check_reservation(_cedula text,_cantidad int) returns bytea language plpgsql set search_path='' as $$
declare h bytea; total int; ocupadas int; abiertas text; r int; ip text; bucket text;
begin
 h:=bingo_private_security_test.token_hash();
 if h is null then raise exception 'Actualiza la página para reservar tus cartones de forma segura' using errcode='42501'; end if;
 if coalesce(trim(_cedula),'')='' then raise exception 'Cédula requerida'; end if;
 total:=bingo_public_security_test.fn_total_cartones_actual();
 if _cantidad is null or _cantidad<1 or _cantidad>total then raise exception 'Cantidad inválida'; end if;
 select coalesce(valore,valor::text,'true') into abiertas from bingo_public_security_test.configuracion where clave='ventas_abierta';
 if coalesce(lower(abiertas),'true') not in ('true','1') then raise exception 'Las ventas están cerradas'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 select count(*) into ocupadas from bingo_public_security_test.cartones c where trim(c.cedula)=trim(_cedula)
  and not exists(select 1 from bingo_public_security_test.inscripciones i where c.numero=any(i.cartones) and i.estado='aprobado');
 if ocupadas+_cantidad>greatest(100,(select coalesce(max(case when clave='cartones_obligatorios' and valore ~ '^[0-9]{1,6}$' then valore::int end),0) from bingo_public_security_test.configuracion)) then
  raise exception 'Demasiados cartones reservados sin enviar el comprobante. Completa tu compra antes de reservar más';
 end if;
 if h is not null then
  bucket:='token:'||encode(h,'hex');
  insert into bingo_private_security_test.rate_limits as l values(bucket,clock_timestamp(),1)
   on conflict(key) do update set requests=case when l.window_start<clock_timestamp()-interval '1 minute' then 1 else l.requests+1 end,
    window_start=case when l.window_start<clock_timestamp()-interval '1 minute' then clock_timestamp() else l.window_start end returning requests into r;
  if r>180 then raise exception 'Demasiadas solicitudes. Espera un minuto'; end if;
 end if;
 return h;
end $$;
create or replace function bingo_public_security_test.rpc_reservar_carton_seguro(_numero bigint,_cedula text,_partida_id bigint) returns boolean language plpgsql security definer set search_path='' as $$
declare h bytea;
begin
 h:=bingo_private_security_test.check_reservation(_cedula,1);
 if _partida_id is not null or _numero is null or _numero<1 or _numero>bingo_public_security_test.fn_total_cartones_actual() then return false; end if;
 if exists(select 1 from bingo_public_security_test.inscripciones where _numero=any(cartones) and estado in ('pendiente','aprobado')) then return false; end if;
 insert into bingo_public_security_test.cartones(numero,cedula,ocupado,partida_id,created_at,reserved_at) values(_numero,trim(_cedula),true,null,now(),now());
 if h is not null then insert into bingo_private_security_test.reservation_owners values(_numero,h,trim(_cedula)); end if;
 return true;
exception when unique_violation then return false;
end $$;
create or replace function bingo_public_security_test.rpc_reservar_cartones_aleatorios_seguro(_cantidad integer,_cedula text,_partida_id bigint default null)
 returns table(exito boolean,mensaje text,cartones integer[]) language plpgsql security definer set search_path='' as $$
declare h bytea; nums int[]; total int;
begin
 h:=bingo_private_security_test.check_reservation(_cedula,_cantidad);total:=bingo_public_security_test.fn_total_cartones_actual();
 if _partida_id is not null then return query select false,'Sorteo no válido',array[]::int[];return; end if;
 select array_agg(n) into nums from(select s.n from generate_series(1,total) s(n)
  where not exists(select 1 from bingo_public_security_test.cartones c where c.numero=s.n)
   and not exists(select 1 from bingo_public_security_test.inscripciones i where s.n::bigint=any(i.cartones) and i.estado in ('pendiente','aprobado'))
  order by random() limit _cantidad) q;
 if coalesce(cardinality(nums),0)<_cantidad then return query select false,'No hay suficientes cartones disponibles',array[]::int[];return;end if;
 insert into bingo_public_security_test.cartones(numero,cedula,ocupado,partida_id,created_at,reserved_at) select unnest(nums),trim(_cedula),true,null,now(),now();
 if h is not null then insert into bingo_private_security_test.reservation_owners select unnest(nums),h,trim(_cedula);end if;
 return query select true,'Cartones reservados correctamente',nums;
exception when unique_violation then return query select false,'Un cartón fue tomado. Intenta nuevamente',array[]::int[];
end $$;
create or replace function bingo_public_security_test.rpc_liberar_reserva_seguro(_numero bigint default null,_cedula text default null,_partida_id bigint default null)
 returns boolean language plpgsql security definer set search_path='' as $$
declare h bytea; afectados int;
begin
 h:=bingo_private_security_test.token_hash();
 if h is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 delete from bingo_public_security_test.cartones c using bingo_private_security_test.reservation_owners o
  where o.numero=c.numero and o.token_hash=h and trim(c.cedula)=trim(_cedula)
   and (_numero is null or c.numero=_numero) and c.partida_id is not distinct from _partida_id
   and not exists(select 1 from bingo_public_security_test.inscripciones i where c.numero=any(i.cartones) and i.estado in ('pendiente','aprobado'));
 get diagnostics afectados=row_count;return afectados>0;
end $$;
revoke all on function bingo_public_security_test.rpc_reservar_carton_seguro(bigint,text,bigint),bingo_public_security_test.rpc_reservar_cartones_aleatorios_seguro(integer,text,bigint),bingo_public_security_test.rpc_liberar_reserva_seguro(bigint,text,bigint) from public;
grant execute on function bingo_public_security_test.rpc_reservar_carton_seguro(bigint,text,bigint),bingo_public_security_test.rpc_reservar_cartones_aleatorios_seguro(integer,text,bigint),bingo_public_security_test.rpc_liberar_reserva_seguro(bigint,text,bigint) to anon,authenticated,service_role;

-- La compra se registra en una función nueva: no altera el INSERT usado por versiones anteriores.
create or replace function bingo_public_security_test.rpc_registrar_compra_segura(_compra jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare h bytea; nums bigint[]; n bigint; ced text; identificador bigint; precio numeric;
begin
 h:=bingo_private_security_test.token_hash();ced:=trim(coalesce(_compra->>'cedula',''));
 select array_agg(value::bigint) into nums from jsonb_array_elements_text(coalesce(_compra->'cartones','[]'::jsonb));
 if h is null or ced='' or coalesce(cardinality(nums),0)<1 then raise exception 'Reserva de compra no válida' using errcode='42501';end if;
 if cardinality(nums)<>(select count(distinct x) from unnest(nums) x) then raise exception 'Cartones repetidos';end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 foreach n in array nums loop
  if not exists(select 1 from bingo_public_security_test.cartones c join bingo_private_security_test.reservation_owners o on o.numero=c.numero where c.numero=n and trim(c.cedula)=ced and o.token_hash=h and c.partida_id is null and coalesce(c.reserved_at,c.created_at)>now()-interval '5 minutes') then raise exception 'Un cartón no tiene una reserva vigente de esta pestaña' using errcode='42501';end if;
  if exists(select 1 from bingo_public_security_test.inscripciones i where n=any(i.cartones) and i.estado in ('pendiente','aprobado')) then raise exception 'Un cartón ya está registrado';end if;
 end loop;
 select valore::numeric into precio from bingo_public_security_test.configuracion where clave='precio_carton';
 if precio is null or precio<=0 then raise exception 'Precio no configurado';end if;
 insert into bingo_public_security_test.inscripciones(nombre,telefono,cedula,referido,cartones,referencia4dig,comprobante,estado,monto_bs,pago_banco,pago_telefono,pago_cedula,usa_promo,promo_desc,precio_unitario_bs)
 values(left(_compra->>'nombre',160),left(_compra->>'telefono',30),ced,left(_compra->>'referido',160),nums,
 right(regexp_replace(coalesce(_compra->>'referencia4dig',''),'[^0-9]','','g'),4),left(_compra->>'comprobante',2048),'pendiente',precio*cardinality(nums),
 left(_compra->>'pago_banco',160),left(_compra->>'pago_telefono',30),left(_compra->>'pago_cedula',30),false,null,precio) returning id into identificador;
 return identificador;
end $$;
revoke all on function bingo_public_security_test.rpc_registrar_compra_segura(jsonb) from public;
grant execute on function bingo_public_security_test.rpc_registrar_compra_segura(jsonb) to anon,authenticated,service_role;

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

update bingo_private_security_test.settings set enforce_owner=true;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers','{"x-bingo-reserva":"1111111111111111111111111111111111111111111111111111111111111111"}',true);
do $test$
declare result record; n int; snap uuid; failure boolean; claims text; compra_id bigint;
begin
 select * into result from bingo_public_security_test.rpc_reservar_cartones_aleatorios_seguro(50,'CLIENTE-FICTICIO',null);
 assert result.exito and cardinality(result.cartones)=50,'Debe permitir una compra de 50 cartones';
 select count(*) into n from bingo_public_security_test.cartones;assert n=50;
 perform set_config('request.headers','{"x-bingo-reserva":"2222222222222222222222222222222222222222222222222222222222222222"}',true);
 assert not bingo_public_security_test.rpc_liberar_reserva_seguro(result.cartones[1],'CLIENTE-FICTICIO',null),'Un tercero no puede liberar cartones ajenos aunque sepa la cédula';
 perform set_config('request.headers','{}',true);
 assert not bingo_public_security_test.rpc_liberar_reserva_seguro(result.cartones[1],'CLIENTE-FICTICIO',null),'Sin credencial no puede liberar';
 failure:=false;
 begin perform bingo_public_security_test.rpc_reservar_carton_seguro(700,'FICTICIO',null); exception when insufficient_privilege then failure:=true;end;
 assert failure,'No debe reservar sin credencial';
 perform set_config('request.headers','{"x-bingo-reserva":"1111111111111111111111111111111111111111111111111111111111111111"}',true);
 compra_id:=bingo_public_security_test.rpc_registrar_compra_segura(jsonb_build_object('nombre','Prueba aislada','cedula','CLIENTE-FICTICIO','cartones',jsonb_build_array(result.cartones[1])));
 assert not bingo_public_security_test.rpc_liberar_reserva_seguro(result.cartones[1],'CLIENTE-FICTICIO',null),'No debe liberar una compra pendiente';
 assert bingo_public_security_test.rpc_liberar_reserva_seguro(result.cartones[2],'CLIENTE-FICTICIO',null),'Su dueño sí puede liberar una reserva sin compra';
 perform set_config('request.headers','{"x-bingo-reserva":"2222222222222222222222222222222222222222222222222222222222222222"}',true);
 failure:=false;
 begin perform bingo_public_security_test.rpc_registrar_compra_segura(jsonb_build_object('nombre','Prueba','cedula','CLIENTE-FICTICIO','cartones',jsonb_build_array(result.cartones[3]))); exception when insufficient_privilege then failure:=true;end;
 assert failure,'No puede inscribir cartones de otra pestaña';
 update bingo_public_security_test.configuracion set valore='false' where clave='ventas_abierta';failure:=false;
 begin perform bingo_public_security_test.rpc_reservar_carton_seguro(700,'FICTICIO',null); exception when raise_exception then failure:=true;end;
 assert failure,'No puede saltarse ventas cerradas';
 update bingo_public_security_test.configuracion set valore='true' where clave='ventas_abierta';
 failure:=false;begin perform bingo_public_security_test.rpc_reiniciar_sorteo_seguro();exception when insufficient_privilege then failure:=true;end;
 assert failure,'Un anónimo no puede reiniciar';
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001","email":"otro@example.invalid"}',true);
 failure:=false;begin perform bingo_public_security_test.rpc_respaldar_sorteo('Prueba');exception when insufficient_privilege then failure:=true;end;
 assert failure,'Otra cuenta autenticada no tiene privilegios de administrador';
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 update bingo_public_security_test.inscripciones set estado='aprobado',banco_ref='REFERENCIA-FICTICIA' where id=compra_id;
 assert exists(select 1 from bingo_public_security_test.inscripciones where id=compra_id and estado='aprobado'),'El flujo del bot mantiene su actualización autorizada';
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"5121c2ba-c8f1-40f8-8b3e-130a75f60ac5"}',true);
 snap:=bingo_public_security_test.rpc_reiniciar_sorteo_seguro();
 assert not exists(select 1 from bingo_public_security_test.cartones),'Reinicio de prueba vacía reservas';
 assert exists(select 1 from bingo_private_security_test.snapshots where id=snap),'Siempre respalda antes de reiniciar';
 perform bingo_public_security_test.rpc_restaurar_sorteo(snap);
 assert (select count(*) from bingo_public_security_test.cartones)=49,'Restauración recupera todos los cartones';
 assert exists(select 1 from bingo_public_security_test.inscripciones where id=compra_id and estado='aprobado' and banco_ref='REFERENCIA-FICTICIA'),'Restauración conserva aprobación y verificación bancaria';
end $test$;
rollback;
