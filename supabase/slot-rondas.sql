begin;
-- Separado de compras, pagos, reservas y resultados publicados.
create schema if not exists privado_slot_rondas;
revoke all on schema privado_slot_rondas from public, anon, authenticated;
grant usage on schema privado_slot_rondas to anon, authenticated;
create table if not exists public.slot_rondas_excluidos (
 source_anchor text primary key,
 fecha date not null,
 enviados_en timestamptz not null default now(),
 enviados_por uuid not null,
 ganadores jsonb not null check (jsonb_typeof(ganadores)='array')
);
alter table public.slot_rondas_excluidos enable row level security;
revoke all on public.slot_rondas_excluidos from public, anon, authenticated;
grant select on public.slot_rondas_excluidos to service_role;

-- Lectura pública deliberada: solo nombres, cartones y rondas. Nunca cédulas.
create or replace function privado_slot_rondas.estado() returns jsonb
language sql stable security definer set search_path='' as $$
 with actual as (select min(id)::text source from public.inscripciones),
 lista as (select e.* from public.slot_rondas_excluidos e, actual a where e.source_anchor=a.source)
 select jsonb_build_object('source',a.source,'sent',l.source_anchor is not null,
 'fecha',l.fecha,'sentAt',l.enviados_en,
 'people',coalesce((select count(distinct w->>'cedula') from jsonb_array_elements(l.ganadores) w),0),
 'winners',coalesce((select jsonb_agg(w-'cedula') from jsonb_array_elements(l.ganadores) w),'[]'::jsonb))
 from actual a left join lista l on true;
$$;
revoke all on function privado_slot_rondas.estado() from public;
grant execute on function privado_slot_rondas.estado() to anon,authenticated;
create or replace function public.slot_estado_rondas() returns jsonb
language sql stable security invoker set search_path='' as $$ select privado_slot_rondas.estado(); $$;
revoke all on function public.slot_estado_rondas() from public;
grant execute on function public.slot_estado_rondas() to anon,authenticated;

create or replace function privado_slot_rondas.enviar(p_source text,p_fecha date,p_rondas jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actual text; g jsonb; v jsonb; c bigint; orden int; vistos int[]:=array[]::int[];
 cartas bigint[]; lista jsonb:='[]'::jsonb; nombre text; ci text; personas int; malos int;
begin
 if auth.uid() is null or not exists(select 1 from privado_resultados.publicadores_resultados where usuario_id=auth.uid() and activo)
 then raise exception 'Usuario no autorizado para enviar ganadores' using errcode='42501'; end if;
 if p_fecha is null or p_fecha<date '2020-01-01' or p_fecha>date '2100-12-31' then raise exception 'Fecha inválida'; end if;
 if p_rondas is null or jsonb_typeof(p_rondas)<>'array' or octet_length(p_rondas::text)>100000 then raise exception 'Rondas inválidas'; end if;
 if jsonb_array_length(p_rondas)<1 or jsonb_array_length(p_rondas)>6 then raise exception 'Registra al menos una ronda'; end if;
 -- Evita asociar una lista con un reinicio concurrente del bingo.
 lock table public.inscripciones in share mode;
 select min(id)::text into actual from public.inscripciones;
 if actual is null or p_source is distinct from actual then raise exception 'El sorteo cambió. Actualiza los aprobados antes de enviar'; end if;
 perform pg_advisory_xact_lock(hashtextextended('slot-rondas:'||actual,0));
 for g in select value from jsonb_array_elements(p_rondas) loop
  if jsonb_typeof(g)<>'object' or g-array['orden','tipo','cartones']<>'{}'::jsonb or
     jsonb_typeof(g->'orden') is distinct from 'number' or (g->>'orden')!~'^[1-6]$' or
     coalesce(g->>'tipo','') not in ('ronda','final') or jsonb_typeof(g->'cartones') is distinct from 'array'
  then raise exception 'Ronda inválida'; end if;
  orden:=(g->>'orden')::int;
  if orden=any(vistos) then raise exception 'Ronda repetida'; end if;
  vistos:=array_append(vistos,orden); cartas:=array[]::bigint[];
  if jsonb_array_length(g->'cartones')<1 or jsonb_array_length(g->'cartones')>100 then raise exception 'Cantidad de ganadores inválida'; end if;
  for v in select value from jsonb_array_elements(g->'cartones') loop
   if jsonb_typeof(v)<>'number' or v::text!~'^[0-9]{1,4}$' then raise exception 'Cartón inválido'; end if;
   c:=v::text::bigint;
   if c<1 or c=any(cartas) then raise exception 'Cartón inválido o repetido'; end if;
   cartas:=array_append(cartas,c);
   select count(distinct regexp_replace(i.cedula,'\D','','g')),
    min(regexp_replace(i.cedula,'\D','','g')),min(trim(i.nombre)),
    count(*) filter(where coalesce(regexp_replace(i.cedula,'\D','','g'),'')='' or coalesce(trim(i.nombre),'')='')
    into personas,ci,nombre,malos from public.inscripciones i where i.estado='aprobado' and c=any(i.cartones);
   if personas<>1 or malos>0 then raise exception 'El cartón % no tiene un dueño aprobado único. Actualiza los aprobados',c; end if;
   lista:=lista||jsonb_build_array(jsonb_build_object('name',nombre,'cedula',ci,'ticket',c::text,'round',orden,'type',g->>'tipo'));
  end loop;
 end loop;
 insert into public.slot_rondas_excluidos(source_anchor,fecha,enviados_por,ganadores)
 values(actual,p_fecha,auth.uid(),lista)
 on conflict(source_anchor) do update set fecha=excluded.fecha,enviados_por=excluded.enviados_por,ganadores=excluded.ganadores,enviados_en=now();
 return privado_slot_rondas.estado();
end;
$$;
revoke all on function privado_slot_rondas.enviar(text,date,jsonb) from public,anon;
grant execute on function privado_slot_rondas.enviar(text,date,jsonb) to authenticated;
create or replace function public.slot_enviar_rondas(p_source text,p_fecha date,p_rondas jsonb) returns jsonb
language sql security invoker set search_path='' as $$select privado_slot_rondas.enviar(p_source,p_fecha,p_rondas);$$;
revoke all on function public.slot_enviar_rondas(text,date,jsonb) from public,anon;
grant execute on function public.slot_enviar_rondas(text,date,jsonb) to authenticated;
commit;
