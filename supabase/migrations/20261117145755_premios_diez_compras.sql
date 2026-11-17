-- No altera los apartados del sorteo en curso; se activa desde el siguiente reinicio.
create table if not exists bingo_security.premios_automaticos (
 singleton boolean primary key default true check(singleton),
 activo boolean not null default false,
 completado boolean not null default false,
 estado text not null default 'proximo_reinicio',
 actualizado timestamptz not null default now()
);
alter table bingo_security.premios_automaticos enable row level security;
revoke all on bingo_security.premios_automaticos from public,anon,authenticated;
grant select on bingo_security.premios_automaticos to service_role;
insert into bingo_security.premios_automaticos(singleton) values(true) on conflict do nothing;

create or replace function bingo_security.intentar_apartado_automatico()
returns void language plpgsql security definer set search_path='' as $$
declare st jsonb; compras int; ruleta int; dinamicas int; faltan int;
begin
 if not exists(select 1 from bingo_security.premios_automaticos where singleton and activo and not completado) then return;end if;
 -- No bloquear aprobaciones ni invertir el orden de locks con compras/reinicios.
 if not pg_try_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0)) then return;end if;
 begin
 lock table public.inscripciones,public.cartones in exclusive mode nowait;
 perform 1 from bingo_security.premios_automaticos where singleton and activo and not completado for update nowait;
 if not found then return;end if;
 select count(*) into compras from public.inscripciones where estado='aprobado' and monto_bs>0 and origen_registro not in ('premio_slot','premio_dinamica');
 if compras<10 then return;end if;
 st:=bingo_security.estado_apartados_premios();
 ruleta:=greatest(8,(st->>'ruleta')::int);dinamicas:=greatest(5,(st->>'dinamicas')::int);
 faltan:=ruleta+dinamicas-(st->>'ruleta')::int-(st->>'dinamicas')::int;
 if (st->>'disponibles')::int<faltan then
 update bingo_security.premios_automaticos set estado='sin_cupos',actualizado=now() where singleton;return;
 end if;
 perform bingo_security.ajustar_apartados_premios(ruleta,dinamicas,st->>'version');
 update bingo_security.premios_automaticos set completado=true,estado='completado',actualizado=now() where singleton;
 exception when lock_not_available then return;
 end;
 exception when others then
 -- Un fallo en premios nunca debe revertir una compra/aprobación. Cron reintenta.
 raise warning 'Apartado automático pendiente: %',sqlerrm;
end $$;
revoke all on function bingo_security.intentar_apartado_automatico() from public,anon,authenticated,service_role;

create or replace function bingo_security.comprobar_compras_para_premios()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform bingo_security.intentar_apartado_automatico();return null;
end $$;
revoke all on function bingo_security.comprobar_compras_para_premios() from public,anon,authenticated,service_role;
create trigger apartados_tras_compras_aprobadas after insert or update on public.inscripciones
for each statement execute function bingo_security.comprobar_compras_para_premios();
-- Respaldo frente a dos aprobaciones concurrentes o cartones temporalmente reservados.
select cron.schedule('apartados-premios-diez-compras','* * * * *','select bingo_security.intentar_apartado_automatico();');

CREATE OR REPLACE FUNCTION public.rpc_reiniciar_sorteo_con_clave(_clave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s bingo_security.reset_key_state; id_respaldo uuid;
begin
 if bingo_security.is_admin() is not true then raise exception 'No autorizado' using errcode='42501';end if;
 select * into s from bingo_security.reset_key_state where singleton for update;
 if s.key_hash is null then return jsonb_build_object('ok',false,'error','Primero configura tu clave en Seguridad · Clave de reinicio.');end if;
 if s.reset_window is null or s.reset_window<now()-interval '15 minutes' then
  s.reset_attempts:=0;
  update bingo_security.reset_key_state set reset_window=now(),reset_attempts=0 where singleton;
 end if;
 if s.reset_attempts>=5 then return jsonb_build_object('ok',false,'error','Demasiados intentos. Espera 15 minutos.');end if;
 update bingo_security.reset_key_state set reset_attempts=reset_attempts+1 where singleton;
 if _clave is null or octet_length(_clave)>72 or extensions.crypt(_clave,s.key_hash) is distinct from s.key_hash then return jsonb_build_object('ok',false,'error','Clave de reinicio incorrecta.');end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 lock table public.inscripciones,public.cartones in exclusive mode;
 id_respaldo:=bingo_security.make_snapshot('Antes de reiniciar sorteo');
 delete from public.inscripciones where id is not null;
 delete from public.cartones where numero is not null;
 update bingo_security.premios_automaticos set activo=true,completado=false,estado='esperando',actualizado=now() where singleton;
 update bingo_security.reset_key_state set reset_attempts=0,reset_window=null where singleton;
 return jsonb_build_object('ok',true,'respaldo',id_respaldo);
end $function$
;

CREATE OR REPLACE FUNCTION public.rpc_reiniciar_sorteo_seguro()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare id_respaldo uuid;
begin
 if bingo_security.is_admin() is not true and auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 if exists(select 1 from bingo_security.reset_key_state where singleton and key_hash is not null) then raise exception 'Actualiza la página y utiliza tu clave de reinicio.';end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 lock table public.inscripciones,public.cartones in exclusive mode;
 id_respaldo:=bingo_security.make_snapshot('Antes de reiniciar sorteo');
 delete from public.inscripciones where id is not null;
 delete from public.cartones where numero is not null;
 update bingo_security.premios_automaticos set activo=true,completado=false,estado='esperando',actualizado=now() where singleton;
 return id_respaldo;
end $function$
;

CREATE OR REPLACE FUNCTION bingo_security.estado_apartados_premios()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select jsonb_build_object('ruleta',(select count(*) from public.cartones where premio_apartado='ruleta'),'dinamicas',(select count(*) from public.cartones where premio_apartado='dinamicas'),
'disponibles',(select count(*) from generate_series(1,public.fn_total_cartones_actual()) n where not exists(select 1 from public.cartones c where c.numero=n) and not exists(select 1 from public.inscripciones i where n::bigint=any(i.cartones) and i.estado in ('pendiente','aprobado'))),
'version',md5(coalesce((select string_agg(numero::text||':'||premio_apartado,',' order by numero) from public.cartones where premio_apartado is not null),'')||'|'||public.fn_total_cartones_actual()::text||'|'||coalesce((select min(id)::text from public.inscripciones),'vacio')||'|'||coalesce((select id::text from bingo_security.snapshots order by created_at desc,id desc limit 1),'inicial'))) || jsonb_build_object('automatico',coalesce((select estado from bingo_security.premios_automaticos where singleton),'proximo_reinicio'),'comprasAprobadas',(select count(*) from public.inscripciones where estado='aprobado' and monto_bs>0 and origen_registro not in ('premio_slot','premio_dinamica')));
$function$
;
