-- Private reset credential. Never stores a plaintext password or email OTP.
create table bingo_security.reset_key_state (
 singleton boolean primary key default true check (singleton),
 key_hash text,
 requested_at timestamptz,
 otp_attempts integer not null default 0,
 reset_window timestamptz,
 reset_attempts integer not null default 0,
 changed_at timestamptz
);
alter table bingo_security.reset_key_state enable row level security;
revoke all on bingo_security.reset_key_state from public,anon,authenticated;
insert into bingo_security.reset_key_state(singleton) values(true);

-- Only the Edge Function may start/consume a mail verification attempt.
create function public.rpc_reset_key_email_gate(_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s bingo_security.reset_key_state;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 select * into s from bingo_security.reset_key_state where singleton for update;
 if _action='request' then
  if s.requested_at > now()-interval '60 seconds' then return jsonb_build_object('ok',false,'error','Espera un minuto antes de solicitar otro código.');end if;
  update bingo_security.reset_key_state set requested_at=now(),otp_attempts=0 where singleton;
 elsif _action='verify' then
  if s.requested_at is null or s.requested_at < now()-interval '10 minutes' then return jsonb_build_object('ok',false,'error','Solicita un código nuevo. El anterior venció.');end if;
  if s.otp_attempts>=5 then return jsonb_build_object('ok',false,'error','Se agotaron los intentos. Solicita un código nuevo.');end if;
  update bingo_security.reset_key_state set otp_attempts=otp_attempts+1 where singleton;
 else raise exception 'Acción inválida';end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.rpc_reset_key_email_gate(text) from public,anon,authenticated;
grant execute on function public.rpc_reset_key_email_gate(text) to service_role;

create function public.rpc_guardar_clave_reinicio(_clave text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 if _clave is null or char_length(_clave)<10 or char_length(_clave)>64 or octet_length(_clave)>72 then raise exception 'Usa entre 10 y 64 caracteres (máximo 72 bytes).';end if;
 update bingo_security.reset_key_state set key_hash=extensions.crypt(_clave,extensions.gen_salt('bf',12)),changed_at=now(),requested_at=null,otp_attempts=0,reset_window=null,reset_attempts=0 where singleton;
end $$;
revoke all on function public.rpc_guardar_clave_reinicio(text) from public,anon,authenticated;
grant execute on function public.rpc_guardar_clave_reinicio(text) to service_role;

create function public.rpc_estado_clave_reinicio()
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if bingo_security.is_admin() is not true then raise exception 'No autorizado' using errcode='42501';end if;
 return (select key_hash is not null from bingo_security.reset_key_state where singleton);
end $$;
revoke all on function public.rpc_estado_clave_reinicio() from public,anon;
grant execute on function public.rpc_estado_clave_reinicio() to authenticated;

-- Block the old endpoint once the administrator has configured the new key.
create or replace function public.rpc_reiniciar_sorteo_seguro()
returns uuid language plpgsql security definer set search_path='' as $$
declare id_respaldo uuid;
begin
 if bingo_security.is_admin() is not true and auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 if exists(select 1 from bingo_security.reset_key_state where singleton and key_hash is not null) then raise exception 'Actualiza la página y utiliza tu clave de reinicio.';end if;
 lock table public.inscripciones,public.cartones in exclusive mode;
 id_respaldo:=bingo_security.make_snapshot('Antes de reiniciar sorteo');
 delete from public.inscripciones where id is not null;
 delete from public.cartones where numero is not null;
 return id_respaldo;
end $$;

create function public.rpc_reiniciar_sorteo_con_clave(_clave text)
returns jsonb language plpgsql security definer set search_path='' as $$
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
 lock table public.inscripciones,public.cartones in exclusive mode;
 id_respaldo:=bingo_security.make_snapshot('Antes de reiniciar sorteo');
 delete from public.inscripciones where id is not null;
 delete from public.cartones where numero is not null;
 update bingo_security.reset_key_state set reset_attempts=0,reset_window=null where singleton;
 return jsonb_build_object('ok',true,'respaldo',id_respaldo);
end $$;
revoke all on function public.rpc_reiniciar_sorteo_con_clave(text) from public,anon;
grant execute on function public.rpc_reiniciar_sorteo_con_clave(text) to authenticated;
