-- Premio a la Fidelidad Binguera - PREPARADO PARA REVISIÓN. NO EJECUTAR EN PRODUCCIÓN SIN PRUEBAS.
-- Aísla toda la data en un esquema privado y nunca modifica inscripciones, cartones o pagos.
begin;

create schema if not exists fidelidad;
revoke all on schema fidelidad from public, anon, authenticated;
grant usage on schema fidelidad to service_role;

create table if not exists fidelidad.dias (
  fecha date primary key,
  capturado_en timestamptz not null default now(),
  compras jsonb not null check (jsonb_typeof(compras) = 'array'),
  ganadores jsonb not null check (jsonb_typeof(ganadores) = 'array'),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object')
);

create table if not exists fidelidad.errores_captura (
  fecha date primary key,
  motivo text not null,
  registrado_en timestamptz not null default now()
);

create table if not exists fidelidad.giros (
  id uuid primary key,
  sabado date not null,
  cedula text not null,
  nombre text not null,
  carton bigint not null,
  premio text not null check (length(trim(premio)) between 1 and 60),
  creado_en timestamptz not null default now(),
  unique (sabado, cedula)
);
create index if not exists fidelidad_giros_fecha on fidelidad.giros (sabado, creado_en);

revoke all on all tables in schema fidelidad from public, anon, authenticated;
grant select, insert, update on all tables in schema fidelidad to service_role;

create or replace function fidelidad.capturar_dia(_fecha date, _resultado jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  _compras jsonb;
  _ganadores jsonb;
  _invalidos int;
begin
  if extract(isodow from _fecha) not between 1 and 6 then
    raise exception 'Fidelidad solo captura de lunes a sábado';
  end if;
  if jsonb_typeof(_resultado->'grupos') <> 'array'
     or not exists (select 1 from jsonb_array_elements(_resultado->'grupos') g where g->>'tipo'='consolacion')
     or not exists (select 1 from jsonb_array_elements(_resultado->'grupos') g where g->>'tipo'='final')
  then raise exception 'No se han publicado todas las rondas, final y consolación del día'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'cedula',regexp_replace(i.cedula,'[^0-9]','','g'),
    'nombre',i.nombre,
    'cartones',to_jsonb(i.cartones)
  ) order by i.id),'[]'::jsonb) into _compras
  from public.inscripciones i
  where i.estado='aprobado' and i.monto_bs>0
    and coalesce(i.origen_registro,'compra') in ('compra','bot','soporte')
    and length(regexp_replace(coalesce(i.cedula,''),'[^0-9]','','g')) between 5 and 12
    and cardinality(i.cartones)>0;

  with raw as (
    select g->>'tipo' tipo, (w->>'carton')::bigint carton
    from jsonb_array_elements(_resultado->'grupos') g,
         lateral jsonb_array_elements(g->'ganadores') w
  ), resueltos as (
    select raw.tipo,raw.carton,count(i.id) cuantos,
      min(regexp_replace(i.cedula,'[^0-9]','','g')) cedula
    from raw left join public.inscripciones i
      on i.estado='aprobado' and raw.carton=any(i.cartones)
    group by raw.tipo,raw.carton
  )
  select count(*) filter (where cuantos<>1),
    coalesce(jsonb_agg(jsonb_build_object(
      'tipo',tipo,'carton',carton,'cedula',cedula)),'[]'::jsonb)
    into _invalidos,_ganadores from resueltos;

  if _invalidos>0 then
    raise exception 'Hay % cartones ganadores sin un comprador aprobado único',_invalidos;
  end if;
  insert into fidelidad.dias(fecha,compras,ganadores,resultado)
    values(_fecha,_compras,_ganadores,_resultado)
    on conflict(fecha) do nothing;
end;
$$;
revoke all on function fidelidad.capturar_dia(date,jsonb) from public, anon, authenticated;

-- El disparador nunca interrumpe la publicación existente, aunque la captura falle.
-- Un día sin copia válida bloquea Fidelidad hasta que sea revisado.
create or replace function fidelidad.al_publicar()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  begin
    perform fidelidad.capturar_dia(new.fecha,new.resultado);
  exception when others then
    begin
      insert into fidelidad.errores_captura(fecha,motivo)
      values(new.fecha,left(sqlerrm,400))
      on conflict(fecha) do update set motivo=excluded.motivo,registrado_en=now();
    exception when others then
      raise warning 'Fidelidad: no pudo registrar el error de captura de %',new.fecha;
    end;
  end;
  return new;
end;
$$;
revoke all on function fidelidad.al_publicar() from public, anon, authenticated;

drop trigger if exists fidelidad_al_publicar_resultado on public.resultados_publicados;
create trigger fidelidad_al_publicar_resultado
after insert on public.resultados_publicados
for each row execute function fidelidad.al_publicar();

-- Identificación por cédula del comprador del cartón, nunca por titular del pago móvil.
-- Una persona entra una sola vez aunque haya comprado varios cartones por día.
create or replace function fidelidad.elegibles(_sabado date)
returns table(cedula text,nombre text,carton bigint)
language sql stable security definer set search_path=''
as $$
with compras as (
 select d.fecha,c->>'cedula' cedula,c->>'nombre' nombre,
        (t.carton)::bigint carton
 from fidelidad.dias d
 cross join lateral jsonb_array_elements(d.compras) c
 cross join lateral jsonb_array_elements_text(c->'cartones') t(carton)
 where d.fecha between _sabado-5 and _sabado
), completos as (
 select c.cedula from compras c group by c.cedula
 having count(distinct c.fecha)=6
), sin_premio as (
 select c.cedula from completos c where not exists (
  select 1 from fidelidad.dias d
  cross join lateral jsonb_array_elements(d.ganadores) g
  where d.fecha between _sabado-5 and _sabado
    and g->>'cedula'=c.cedula
 )
)
select distinct on (c.cedula) c.cedula,c.nombre,c.carton
from compras c join sin_premio p on p.cedula=c.cedula
where c.fecha=_sabado
order by c.cedula,c.carton;
$$;
revoke all on function fidelidad.elegibles(date) from public, anon, authenticated;

create or replace function public.fidelidad_estado(_sabado date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
 _faltan jsonb;
 _participantes jsonb;
 _ganadores jsonb;
 _cerrados int;
begin
 if _sabado is null or extract(isodow from _sabado)<>6 then
  return jsonb_build_object('ready',false,'error','Selecciona un sábado válido.');
 end if;
 select coalesce(jsonb_agg(to_char(f.fecha,'YYYY-MM-DD')),'[]'::jsonb)
 into _faltan from generate_series(_sabado-5,_sabado,interval '1 day') f(fecha)
 where not exists (select 1 from fidelidad.dias d where d.fecha=f.fecha::date);
 if jsonb_array_length(_faltan)>0 then
  return jsonb_build_object('ready',false,'fecha',_sabado,'faltan',_faltan,
  'error','Faltan los resultados completos o las compras de uno o más días. No se puede sortear.');
 end if;

 select count(*) into _cerrados from fidelidad.dias d where d.fecha between _sabado-5 and _sabado
 and exists(select 1 from jsonb_array_elements(d.resultado->'grupos') g where g->>'tipo'='consolacion')
 and exists(select 1 from jsonb_array_elements(d.resultado->'grupos') g where g->>'tipo'='final');
 if _cerrados<>6 then return jsonb_build_object('ready',false,'error','Hay resultados diarios incompletos.');end if;

 select coalesce(jsonb_agg(jsonb_build_object('cedula',e.cedula,'name',e.nombre,'ticket',e.carton)
 order by e.nombre),'[]'::jsonb)
 into _participantes from fidelidad.elegibles(_sabado) e;
 select coalesce(jsonb_agg(jsonb_build_object('drawId',g.id,'name',g.nombre,
 'ticket',g.carton,'prize',g.premio,'createdAt',g.creado_en)
 order by g.creado_en),'[]'::jsonb)
 into _ganadores from fidelidad.giros g where g.sabado=_sabado;
 return jsonb_build_object('ready',true,'fecha',_sabado,'participants',_participantes,
  'winners',_ganadores,'cantidad',jsonb_array_length(_participantes));
end;
$$;
revoke all on function public.fidelidad_estado(date) from public, anon, authenticated;
grant execute on function public.fidelidad_estado(date) to service_role;

create or replace function fidelidad.girar_en_fecha(_sabado date,_giro uuid,_premio text,_hoy date)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare _ganador record; _anterior record; _dias int;
begin
 if _sabado is null or extract(isodow from _sabado)<>6
   or _sabado<>_hoy
 then raise exception 'Fidelidad solo puede sortearse el sábado por la noche'; end if;
 if _giro is null or length(trim(coalesce(_premio,''))) not between 1 and 60
 then raise exception 'Premio o giro inválido';end if;
 perform pg_advisory_xact_lock(75,to_char(_sabado,'YYYYMMDD')::int);
 select * into _anterior from fidelidad.giros where id=_giro;
 if found then
  if _anterior.sabado<>_sabado then raise exception 'Giro de otra semana';end if;
  return jsonb_build_object('drawId',_anterior.id,'name',_anterior.nombre,'ticket',_anterior.carton,'prize',_anterior.premio);
 end if;
 select count(*) into _dias from fidelidad.dias d
 where d.fecha between _sabado-5 and _sabado;
 if _dias<>6 then raise exception 'Faltan días; no se puede sortear';end if;
 if exists (select 1 from fidelidad.dias d where d.fecha between _sabado-5 and _sabado
   and not exists(select 1 from jsonb_array_elements(d.resultado->'grupos') g where g->>'tipo'='consolacion'))
 then raise exception 'Faltan premios de consolación publicados'; end if;
 select e.* into _ganador
 from fidelidad.elegibles(_sabado) e
 where not exists(select 1 from fidelidad.giros g where g.sabado=_sabado and g.cedula=e.cedula)
 order by gen_random_uuid() limit 1;
 if not found then raise exception 'No quedan participantes elegibles';end if;
 insert into fidelidad.giros(id,sabado,cedula,nombre,carton,premio)
 values(_giro,_sabado,_ganador.cedula,_ganador.nombre,_ganador.carton,trim(_premio));
 return jsonb_build_object('drawId',_giro,'name',_ganador.nombre,'ticket',_ganador.carton,'prize',trim(_premio));
end;
$$;
revoke all on function fidelidad.girar_en_fecha(date,uuid,text,date) from public, anon, authenticated;
-- La única entrada pública invocable por el servicio utiliza la fecha real de Caracas.
-- _hoy existe solo en el procedimiento privado para pruebas sin usar relojes falsos.
create or replace function public.fidelidad_girar(_sabado date,_giro uuid,_premio text)
returns jsonb language sql volatile security definer set search_path=''
as $$
 select fidelidad.girar_en_fecha(_sabado,_giro,_premio,(now() at time zone 'America/Caracas')::date);
$$;
revoke all on function public.fidelidad_girar(date,uuid,text) from public, anon, authenticated;
grant execute on function public.fidelidad_girar(date,uuid,text) to service_role;
commit;