begin;
create table bingo_security.soporte_selecciones (
 id uuid primary key default gen_random_uuid(), operador uuid not null, correo text not null,
 token_hash text not null unique, cedula text not null, anchor text not null,
 cantidad int not null check(cantidad between 1 and 100), cartones bigint[] not null default '{}',
 revision int not null default 0, estado text not null default 'activo', gestion uuid,
 creado_en timestamptz not null default now(), vence timestamptz not null default now()+interval '30 minutes'
);
alter table bingo_security.soporte_selecciones enable row level security;
revoke all on bingo_security.soporte_selecciones from public,anon,authenticated;
grant select,insert,update on bingo_security.soporte_selecciones to service_role;
create index soporte_selecciones_operador on bingo_security.soporte_selecciones(operador,creado_en desc);

create function public.soporte_seleccion_backend(_actor uuid,_accion text,_datos jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare s bingo_security.soporte_selecciones%rowtype; p jsonb; nums bigint[]; ocupados bigint[];
 h text; actual text; respuesta jsonb; g bingo_security.soporte_gestiones%rowtype;
begin
 if current_user<>'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 if coalesce(_datos->>'token','') !~ '^[a-f0-9]{64}$' then raise exception 'Enlace de selección inválido';end if;
 h:=encode(extensions.digest(_datos->>'token','sha256'),'hex');
 if _accion not in ('leer','elegir','crear','reservar') then raise exception 'Acción inválida';end if;
 if _actor is not null then
  p:=public.soporte_compras_backend(_actor,'panel',jsonb_build_object('actor_email',_datos->>'actor_email'));
 end if;
 -- Orden idéntico al flujo de compras para impedir cruces con el reinicio y otras reservas.
 if _accion in ('crear','elegir','reservar') then
  perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
  lock table public.inscripciones,public.cartones in exclusive mode;
 end if;
 select * into s from bingo_security.soporte_selecciones where token_hash=h for update;
 if _accion='crear' and s.id is null then
  if _actor is null then raise exception 'No autorizado' using errcode='42501';end if;
  p:=public.soporte_compras_backend(_actor,'panel',jsonb_build_object('actor_email',_datos->>'actor_email'));
  if (p->>'abierto')::boolean is distinct from true then raise exception 'Las ventas están cerradas';end if;
  if coalesce(_datos->>'cedula','') !~ '^[0-9]{5,12}$' or coalesce((_datos->>'cantidad')::int,0) not between 1 and 100 then raise exception 'Revisa la cédula y la cantidad';end if;
  if (select count(*) from bingo_security.soporte_selecciones where operador=_actor and creado_en>now()-interval '30 minutes')>=30 then raise exception 'Espera antes de crear más enlaces';end if;
  insert into bingo_security.soporte_selecciones(operador,correo,token_hash,cedula,anchor,cantidad)
   values(_actor,_datos->>'actor_email',h,_datos->>'cedula',p->>'anchor',(_datos->>'cantidad')::int) returning * into s;
 end if;
 if s.id is null or s.vence<=now() then raise exception 'Enlace vencido o inválido. Pide otro enlace a soporte';end if;
 if _actor is not null and s.operador<>_actor then raise exception 'Enlace de otro operador' using errcode='42501';end if;
 if _accion='crear' and (s.cedula is distinct from _datos->>'cedula' or s.cantidad is distinct from (_datos->>'cantidad')::int) then raise exception 'Enlace asociado a otra compra';end if;
 -- Solo se devuelven números y disponibilidad; jamás datos del cliente o de otras compras.
 p:=public.soporte_compras_backend(s.operador,'panel',jsonb_build_object('actor_email',s.correo));
 if s.anchor is distinct from p->>'anchor' then raise exception 'El sorteo cambió. Pide otro enlace a soporte';end if;
 if s.gestion is not null then select * into g from bingo_security.soporte_gestiones where id=s.gestion;end if;
 if _accion='reservar' then
  if _actor is null then raise exception 'No autorizado' using errcode='42501';end if;
  if s.cedula is distinct from _datos->>'cedula' or s.cantidad is distinct from (_datos->>'cantidad')::int then raise exception 'Revisa la cédula y la cantidad del enlace';end if;
  if s.gestion is not null and s.gestion is distinct from (_datos->>'id')::uuid then raise exception 'La selección ya fue reservada. Crea otro enlace';end if;
  if s.gestion is null and (s.revision is distinct from (_datos->>'revision')::int or cardinality(s.cartones)=0) then raise exception 'La selección cambió. Actualiza antes de reservar';end if;
  respuesta:=public.soporte_compras_backend(_actor,'reservar',_datos||jsonb_build_object('numeros',to_jsonb(s.cartones),'anchor',s.anchor));
  if respuesta ? 'gestion' then
   update bingo_security.soporte_selecciones set estado='reservado',gestion=(_datos->>'id')::uuid,cartones=array(select jsonb_array_elements_text(respuesta->'gestion'->'cartones')::bigint),revision=revision+1 where id=s.id;
  end if;
  return respuesta;
 end if;
 if _accion='elegir' then
  if s.estado<>'activo' then raise exception 'La selección ya fue reservada por soporte';end if;
  if (p->>'abierto')::boolean is distinct from true then raise exception 'Las ventas están cerradas';end if;
  if (_datos->>'revision')::int is distinct from s.revision then
   return jsonb_build_object('conflicto_revision',true,'revision',s.revision,'seleccionados',s.cartones);
  end if;
  if jsonb_typeof(_datos->'numeros') is distinct from 'array' or jsonb_array_length(_datos->'numeros')>s.cantidad then raise exception 'Revisa la cantidad de cartones';end if;
  select coalesce(array_agg(x::bigint),array[]::bigint[]) into nums from jsonb_array_elements_text(_datos->'numeros') x;
  if cardinality(nums)<>(select count(distinct x) from unnest(nums) x) or exists(select 1 from unnest(nums) x where x is null or x<1 or x>(p->>'total')::int) then raise exception 'Revisa los números seleccionados';end if;
  if exists(select 1 from unnest(nums) x where x in (select jsonb_array_elements_text(p->'ocupados')::bigint union select jsonb_array_elements_text(p->'registrados')::bigint)) then raise exception 'Un cartón ya está ocupado. Actualiza y elige otro';end if;
  update bingo_security.soporte_selecciones set cartones=nums,revision=revision+1 where id=s.id returning * into s;
 end if;
 return jsonb_build_object('total',p->'total','precio',p->'precio','abierto',p->'abierto','ocupados',p->'ocupados','registrados',p->'registrados',
  'seleccionados',s.cartones,'cantidad',s.cantidad,'revision',s.revision,'vence',s.vence,
  'estado',case when s.estado='activo' then 'activo' when g.estado='registrado' then 'registrado' when g.estado='cancelado' or g.vence<=now() then 'vencido' else 'reservado' end,
  'reserva_vence',g.vence);
end $$;
revoke all on function public.soporte_seleccion_backend(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.soporte_seleccion_backend(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
