begin;
alter table public.sesiones_activas add column if not exists admin_session_slot smallint;
-- Keep every existing session/token; assign the existing active session its slot.
with ranked as (
 select id,row_number() over(partition by lower(user_email) order by id) slot
 from public.sesiones_activas where tipo='admin' and activa=true
)
update public.sesiones_activas s set admin_session_slot=r.slot
from ranked r where s.id=r.id and s.admin_session_slot is null;
alter table public.sesiones_activas drop constraint if exists sesiones_activas_tipo_email_key;
drop index if exists public.sesiones_unica_activa;
create unique index if not exists sesiones_otras_tipo_email_unique on public.sesiones_activas(tipo,user_email) where tipo<>'admin';
create unique index if not exists sesiones_admin_slot_unique on public.sesiones_activas(lower(user_email),admin_session_slot) where tipo='admin' and activa=true;
create unique index if not exists sesiones_admin_device_unique on public.sesiones_activas(lower(user_email),device_id) where tipo='admin' and activa=true;
alter table public.sesiones_activas add constraint sesiones_admin_slot_check check(tipo<>'admin' or activa is not true or (admin_session_slot is not null and admin_session_slot between 1 and 2));

create or replace function public.admin_abrir_sesion(_email text,_device_id text,_authentication text default 'otp')
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare e text:=lower(btrim(_email)); s public.sesiones_activas%rowtype; slot smallint; expires timestamptz:=now()+interval '2 hours';
begin
 if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 if e is null or e='' or length(e)>100 or _device_id is null or btrim(_device_id)='' or length(_device_id)>200 or _authentication not in ('otp','password') then raise exception 'Datos de sesión inválidos';end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-session:'||e,0));
 select * into s from public.sesiones_activas where tipo='admin' and lower(user_email)=e and device_id=_device_id and activa=true for update;
 if found then
  update public.sesiones_activas set ultima_actividad=now(),expires_at=expires,updated_at=now() where id=s.id;
  return jsonb_build_object('sessionToken',s.session_token,'expiresAt',expires,'deviceId',_device_id);
 end if;
 select x.n into slot from generate_series(1,2) x(n)
 where not exists(select 1 from public.sesiones_activas a where a.tipo='admin' and lower(a.user_email)=e and a.activa=true and a.admin_session_slot=x.n)
 order by x.n limit 1;
 if slot is null then raise exception 'SESION_ACTIVA: Ya hay 2 sesiones activas. Cierra sesión manualmente en uno de los otros dispositivos para entrar aquí.';end if;
 insert into public.sesiones_activas(user_id,user_email,tipo,session_token,device_id,activa,ultima_actividad,expires_at,updated_at,cerrada_en,autenticacion_tipo,admin_session_slot)
 values(e,e,'admin','sess_'||gen_random_uuid()::text,_device_id,true,now(),expires,now(),null,_authentication,slot) returning * into s;
 return jsonb_build_object('sessionToken',s.session_token,'expiresAt',expires,'deviceId',_device_id);
end $$;
revoke all on function public.admin_abrir_sesion(text,text,text) from public,anon,authenticated;
grant execute on function public.admin_abrir_sesion(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
