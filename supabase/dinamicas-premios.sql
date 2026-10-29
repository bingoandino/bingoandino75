begin;
-- Ledger independiente: no tiene FK al sorteo, por lo que un reinicio no borra la semana.
create table if not exists public.dinamicas_ganadores (
 id uuid primary key,
 owner_id uuid not null,
 nombre text not null check(length(nombre) between 2 and 160),
 cedula text not null check(cedula ~ '^[1-9][0-9]{4,11}$'),
 telefono text not null check(telefono ~ '^0(412|414|416|424|426)[0-9]{7}$'),
 banco text not null check(banco ~ '^[0-9]{4}$'),
 fecha timestamptz not null default now(),
 dia date not null,
 semana date not null,
 carton bigint not null,
 registration_id bigint not null,
 source_anchor text not null,
 unique(semana,cedula)
);
alter table public.dinamicas_ganadores enable row level security;
revoke all on table public.dinamicas_ganadores from public,anon,authenticated;
grant select,insert on table public.dinamicas_ganadores to service_role;
create index if not exists dinamicas_ganadores_dia_idx on public.dinamicas_ganadores(dia,fecha);

create or replace function public.dinamicas_panel()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare hoy date:=(now() at time zone 'America/Caracas')::date; inicio date; total int; disponibles int; abierto boolean; anchor text; ganadores jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 inicio:=date_trunc('week',hoy::timestamp)::date;
 total:=public.fn_total_cartones_actual();
 select coalesce(valor,false) into abierto from public.configuracion where clave='ventas_abiertas';
 select coalesce(min(id)::text,'vacio') into anchor from public.inscripciones;
 select count(*)::int into disponibles from generate_series(1,greatest(0,least(total,10000))) x(n)
 where not exists(select 1 from public.cartones c where c.numero=x.n)
 and not exists(select 1 from public.inscripciones r where x.n::bigint=any(r.cartones) and r.estado in ('pendiente','aprobado'));
 select coalesce(jsonb_agg(to_jsonb(g) order by fecha desc),'[]'::jsonb) into ganadores from public.dinamicas_ganadores g where semana=inicio;
 return jsonb_build_object('today',hoy,'weekStart',inicio,'weekEnd',inicio+6,'winners',ganadores,'available',disponibles,'total',total,'salesOpen',coalesce(abierto,false),'anchor',anchor);
end $$;
revoke all on function public.dinamicas_panel() from public,anon,authenticated;
grant execute on function public.dinamicas_panel() to service_role;

create or replace function public.dinamicas_entregar_carton(_id uuid,_owner uuid,_nombre text,_cedula text,_telefono text,_banco text,_anchor text,_confirm boolean default false)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare hoy date:=(now() at time zone 'America/Caracas')::date; inicio date; anterior public.dinamicas_ganadores%rowtype; total int; n bigint; registro bigint; actual text; abierto boolean; recibo jsonb;
begin
 if auth.role() is distinct from 'service_role' or _owner is distinct from '5121c2ba-c8f1-40f8-8b3e-130a75f60ac5'::uuid then raise exception 'No autorizado' using errcode='42501';end if;
 if _id is null or _confirm is null or _nombre is null or length(btrim(_nombre)) not between 2 and 160 or _nombre ~ '[[:cntrl:]<>]' or _cedula is null or _cedula !~ '^[1-9][0-9]{4,11}$' or _telefono is null or _telefono !~ '^0(412|414|416|424|426)[0-9]{7}$' or _banco is null or _banco !~ '^[0-9]{4}$' then raise exception 'Revisa nombre, cédula, teléfono y banco';end if;
 -- Compatible con el orden de los locks de compras y del slot. El lock de tablas protege también frente al reinicio.
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 lock table public.inscripciones,public.cartones in exclusive mode;
 select * into anterior from public.dinamicas_ganadores where id=_id;
 if found then
  if anterior.owner_id is distinct from _owner or anterior.nombre is distinct from btrim(_nombre) or anterior.cedula is distinct from _cedula or anterior.telefono is distinct from _telefono or anterior.banco is distinct from _banco then raise exception 'La solicitud ya se utilizó con otros datos';end if;
  return jsonb_build_object('awarded',true,'winner',to_jsonb(anterior),'replayed',true);
 end if;
 inicio:=date_trunc('week',hoy::timestamp)::date;
 if exists(select 1 from public.dinamicas_ganadores where semana=inicio and cedula=_cedula) then raise exception 'Esta cédula ya ganó esta semana. Solo puede ganar una vez por semana';end if;
 select coalesce(valor,false) into abierto from public.configuracion where clave='ventas_abiertas' for share;
 if abierto is distinct from true then raise exception 'Abre las ventas del sorteo actual antes de entregar cartones';end if;
 select coalesce(min(id)::text,'vacio') into actual from public.inscripciones;
 if _anchor is distinct from actual then raise exception 'El sorteo cambió. Actualiza el panel y revisa la entrega nuevamente';end if;
 total:=public.fn_total_cartones_actual();
 if total not between 1 and 10000 then raise exception 'Total de cartones no configurado';end if;
 select x.n::bigint into n from generate_series(1,total) x(n)
 where not exists(select 1 from public.cartones c where c.numero=x.n)
 and not exists(select 1 from public.inscripciones r where x.n::bigint=any(r.cartones) and r.estado in ('pendiente','aprobado'))
 order by random() limit 1;
 if n is null then raise exception 'No hay cartones disponibles. No se entregó ningún premio';end if;
 if not _confirm then return jsonb_build_object('awarded',false,'canAssign',true,'name',btrim(_nombre),'cedula',_cedula,'phone',_telefono,'bank',_banco,'anchor',actual);end if;
 insert into public.cartones(numero,cedula,ocupado,partida_id,created_at,reserved_at) values(n,_cedula,true,null,now(),now());
 insert into public.inscripciones(nombre,telefono,cedula,cartones,referencia4dig,comprobante,estado,monto_bs,pago_banco,pago_telefono,pago_cedula,usa_promo,promo_desc,precio_unitario_bs,origen_registro)
 values(btrim(_nombre),_telefono,_cedula,array[n],'0000',null,'aprobado',0,_banco,_telefono,_cedula,false,'Premio de dinámica · 1 cartón gratis',0,'premio_dinamica') returning id into registro;
 insert into public.dinamicas_ganadores(id,owner_id,nombre,cedula,telefono,banco,dia,semana,carton,registration_id,source_anchor)
 values(_id,_owner,btrim(_nombre),_cedula,_telefono,_banco,hoy,inicio,n,registro,actual) returning to_jsonb(dinamicas_ganadores.*) into recibo;
 return jsonb_build_object('awarded',true,'winner',recibo,'replayed',false);
end $$;
revoke all on function public.dinamicas_entregar_carton(uuid,uuid,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.dinamicas_entregar_carton(uuid,uuid,text,text,text,text,text,boolean) to service_role;

-- Los cartones regalados participan, pero no se suman al ranking de compras.
create or replace function bingo_security.top_publico()
returns table(nombre text,cedula text,total bigint) language sql stable security definer set search_path='' as $$
 select (array_agg(i.nombre order by i.id desc))[1],'****'||right(i.cedula,4),sum(cardinality(i.cartones))::bigint
 from public.inscripciones i where i.estado='aprobado' and i.origen_registro not in ('premio_slot','premio_dinamica')
 group by i.cedula order by 3 desc,2 limit 5;
$$;
create or replace function public.rpc_public_top_compradores(_limit integer default 10)
returns table(nombre text,cantidad_cartones integer) language sql security definer set search_path='' as $$
 select max(i.nombre),sum(coalesce(cardinality(i.cartones),0))::integer
 from public.inscripciones i where i.estado='aprobado' and coalesce(trim(i.cedula),'')<>'' and i.origen_registro not in ('premio_slot','premio_dinamica')
 group by regexp_replace(i.cedula,'[^0-9]','','g') order by 2 desc,max(i.nombre) asc limit least(greatest(coalesce(_limit,10),1),50);
$$;
commit;
