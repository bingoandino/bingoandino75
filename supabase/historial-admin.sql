-- Consulta de respaldos: no modifica compras, cartones ni respaldos.
create or replace function bingo_security.buscar_historial_admin(
 _session_token text, _device_id text, _texto text default '',
 _desde date default null, _hasta date default null, _pagina integer default 0
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q text:=lower(btrim(coalesce(_texto,''))); digits text; respuesta jsonb;
begin
 if auth.uid() is distinct from '5121c2ba-c8f1-40f8-8b3e-130a75f60ac5'::uuid or not exists(
  select 1 from public.sesiones_activas s where s.session_token=_session_token
   and s.device_id=_device_id and s.activa is true and s.tipo='admin'
   and s.autenticacion_tipo='otp' and s.expires_at>now()
   and lower(s.user_email)=lower(auth.jwt()->>'email')
 ) then raise exception 'Tu sesión de administrador venció. Vuelve a entrar.' using errcode='42501'; end if;
 if length(q)>100 or _pagina is null or _pagina<0 or _pagina>10000 then raise exception 'Búsqueda inválida';end if;
 if _desde>_hasta then raise exception 'Revisa el rango de fechas';end if;
 if length(q)<3 and _desde is null and _hasta is null then raise exception 'Escribe al menos 3 caracteres o selecciona una fecha';end if;
 digits:=regexp_replace(q,'[^0-9]','','g');
 with candidatos as (
  select s.id as respaldo_id,s.created_at,i
  from bingo_security.snapshots s cross join lateral jsonb_array_elements(s.payload->'inscripciones') i
  where (_desde is null or s.created_at>=(_desde::timestamp at time zone 'America/Caracas'))
    and (_hasta is null or s.created_at<((_hasta+1)::timestamp at time zone 'America/Caracas'))
    and (q='' or position(q in lower(coalesce(i->>'nombre','')))>0
      or (digits<>'' and (position(digits in regexp_replace(coalesce(i->>'cedula',''),'[^0-9]','','g'))>0
       or position(digits in regexp_replace(coalesce(i->>'telefono',''),'[^0-9]','','g'))>0
       or position(digits in regexp_replace(coalesce(i->>'pago_cedula',''),'[^0-9]','','g'))>0
       or position(digits in regexp_replace(coalesce(i->>'pago_telefono',''),'[^0-9]','','g'))>0))
      or q=i->>'referencia4dig' or exists(select 1 from jsonb_array_elements_text(coalesce(i->'cartones','[]')) c where c=q))
 ), unicos as (
  select distinct on(i->>'id') * from candidatos order by i->>'id',created_at desc,respaldo_id
 ), pagina as (
  select * from unicos order by created_at desc,i->>'id' desc limit 50 offset _pagina*50
 ) select jsonb_build_object('total',(select count(*) from unicos),'pagina',_pagina,'registros',coalesce((
  select jsonb_agg(jsonb_build_object('id',i->>'id','respaldo',created_at,
   'nombre',i->>'nombre','cedula',i->>'cedula','telefono',i->>'telefono',
   'cartones',i->'cartones','estado',i->>'estado','monto',i->>'monto_bs',
   'referencia',i->>'referencia4dig','origen',i->>'origen_registro',
   'pago_telefono',i->>'pago_telefono','pago_cedula',i->>'pago_cedula','pago_banco',i->>'pago_banco')
   order by created_at desc,i->>'id' desc) from pagina),'[]'::jsonb)) into respuesta;
 return respuesta;
end $$;
revoke all on function bingo_security.buscar_historial_admin(text,text,text,date,date,integer) from public,anon;
grant usage on schema bingo_security to authenticated;
grant execute on function bingo_security.buscar_historial_admin(text,text,text,date,date,integer) to authenticated;
create or replace function public.rpc_buscar_historial_admin(
 _session_token text, _device_id text, _texto text default '',
 _desde date default null, _hasta date default null, _pagina integer default 0
) returns jsonb language sql security invoker set search_path='' as $$
 select bingo_security.buscar_historial_admin(_session_token,_device_id,_texto,_desde,_hasta,_pagina)
$$;
revoke all on function public.rpc_buscar_historial_admin(text,text,text,date,date,integer) from public,anon;
grant execute on function public.rpc_buscar_historial_admin(text,text,text,date,date,integer) to authenticated;
notify pgrst,'reload schema';
