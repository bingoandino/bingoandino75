-- Apartar 8 ruleta y 5 dinámicas dentro de la misma transacción del reinicio.
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
 perform bingo_security.ajustar_apartados_premios(8,5,bingo_security.estado_apartados_premios()->>'version');
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
 perform bingo_security.ajustar_apartados_premios(8,5,bingo_security.estado_apartados_premios()->>'version');
 return id_respaldo;
end $function$
;
