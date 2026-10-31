begin;
create table bingo_security.soporte_equipo (
 email text primary key check(email=lower(btrim(email))),
 activo boolean not null default true,
 creado_en timestamptz not null default now()
);
create table bingo_security.soporte_login_limites(key text primary key,window_start timestamptz not null,requests int not null);
create table bingo_security.soporte_clientes (
 cedula text primary key, nombre text not null, telefono text not null,
 banco text, actualizado_en timestamptz not null default now()
);
create table bingo_security.soporte_gestiones (
 id uuid primary key, operador uuid not null, cedula text not null,
 anchor text not null, cartones bigint[] not null, precio numeric not null,
 vence timestamptz not null, creado_en timestamptz not null default now(),
 estado text not null default 'reservado', registro_id bigint,
 compra jsonb, recibo jsonb
);
alter table bingo_security.soporte_equipo enable row level security;
alter table bingo_security.soporte_login_limites enable row level security;
alter table bingo_security.soporte_clientes enable row level security;
alter table bingo_security.soporte_gestiones enable row level security;
revoke all on bingo_security.soporte_equipo,bingo_security.soporte_clientes,bingo_security.soporte_gestiones from public,anon,authenticated;
revoke all on bingo_security.soporte_login_limites from public,anon,authenticated;
grant usage on schema bingo_security to service_role;
grant select,insert,update on bingo_security.soporte_equipo,bingo_security.soporte_clientes,bingo_security.soporte_gestiones to service_role;
grant select,insert,update on bingo_security.soporte_login_limites to service_role;
grant select on bingo_security.snapshots to service_role;
create index soporte_gestiones_operador on bingo_security.soporte_gestiones(operador,creado_en desc);
insert into bingo_security.soporte_equipo(email) select lower(email) from auth.users where id='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5';

-- Conserva el directorio aunque se reinicie el sorteo; no conserva comprobantes en el navegador.
create function bingo_security.soporte_guardar_cliente() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(btrim(new.cedula),'') ~ '^[0-9]{5,12}$' and new.nombre is not null and new.telefono is not null then
  insert into bingo_security.soporte_clientes(cedula,nombre,telefono,banco)
  values(btrim(new.cedula),new.nombre,new.telefono,new.pago_banco)
  on conflict(cedula) do update set nombre=excluded.nombre,telefono=excluded.telefono,
   banco=coalesce(excluded.banco,soporte_clientes.banco),actualizado_en=now();
 end if;
 return new;
end $$;
revoke all on function bingo_security.soporte_guardar_cliente() from public,anon,authenticated;
create trigger soporte_directorio after insert or update of nombre,telefono,pago_banco on public.inscripciones
 for each row execute function bingo_security.soporte_guardar_cliente();
insert into bingo_security.soporte_clientes(cedula,nombre,telefono,banco)
 select distinct on(btrim(cedula)) btrim(cedula),nombre,telefono,pago_banco from public.inscripciones
 where btrim(cedula) ~ '^[0-9]{5,12}$' and nombre is not null and telefono is not null
 order by btrim(cedula),id desc;

create function public.soporte_compras_backend(_actor uuid,_accion text,_datos jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
<<operacion>>
declare propietario constant uuid:='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5';
 correo text; permitido boolean; total int; precio numeric; abierto text; anchor text;
 nums bigint[]; pedidos bigint[]; conflictos bigint[]; cantidad int; n bigint; ced text;
 g bingo_security.soporte_gestiones%rowtype; ident uuid; registro bigint; cliente jsonb;
 recibo jsonb; archivo text; meta jsonb; compra jsonb; limite int;
begin
 if current_user <> 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 if _accion='login' then
  correo:=lower(btrim(_datos->>'email'));
  if correo is null or length(correo)>254 then return jsonb_build_object('allowed',false);end if;
  if not exists(select 1 from bingo_security.soporte_equipo where email=correo and activo) then return jsonb_build_object('allowed',false);end if;
  insert into bingo_security.soporte_login_limites as r values('soporte-login:'||correo,clock_timestamp(),1)
  on conflict(key) do update set requests=case when r.window_start<clock_timestamp()-interval '1 hour' then 1 else r.requests+1 end,
   window_start=case when r.window_start<clock_timestamp()-interval '1 hour' then clock_timestamp() else r.window_start end returning requests into limite;
  return jsonb_build_object('allowed',limite<=6 and exists(select 1 from bingo_security.soporte_equipo where email=correo and activo));
 end if;
 -- El servidor valida el token con Auth y aporta el correo confirmado; nunca se recibe del navegador.
 select email into correo from bingo_security.soporte_equipo e where e.email=lower(_datos->>'actor_email') and e.activo and _actor is not null;
 if correo is null then raise exception 'Acceso de soporte no autorizado' using errcode='42501';end if;
 if _accion='equipo' then
  if _actor<>propietario then raise exception 'Solo el administrador puede gestionar accesos' using errcode='42501';end if;
  if _datos ? 'email' then
   if coalesce(_datos->>'email','') !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$' or length(_datos->>'email')>254 then raise exception 'Revisa el correo';end if;
   if lower(_datos->>'email')=correo then raise exception 'No puedes desactivar tu propio acceso';end if;
   insert into bingo_security.soporte_equipo(email,activo) values(lower(_datos->>'email'),coalesce((_datos->>'activo')::boolean,true))
   on conflict(email) do update set activo=excluded.activo;
  end if;
  return jsonb_build_object('equipo',(select coalesce(jsonb_agg(to_jsonb(e) order by e.email),'[]') from bingo_security.soporte_equipo e));
 end if;
 total:=public.fn_total_cartones_actual();
 select valore::numeric into precio from public.configuracion where clave='precio_carton';
 select coalesce(valore,valor::text,'false') into abierto from public.configuracion where clave='ventas_abierta';
 anchor:=md5(coalesce((select id::text from bingo_security.snapshots order by created_at desc,id desc limit 1),'inicial')||'|'||total::text||'|'||coalesce((select valore from public.configuracion where clave='version_cartones'),''));
 if _accion='panel' then
  return jsonb_build_object('email',correo,'admin',_actor=propietario,'total',total,'precio',precio,'abierto',coalesce(abierto in ('true','1'),false),'anchor',anchor,
   'ocupados',(select coalesce(jsonb_agg(numero),'[]') from public.cartones),
   'registrados',(select coalesce(jsonb_agg(distinct x.n),'[]') from public.inscripciones i cross join lateral unnest(i.cartones) x(n) where estado in ('pendiente','aprobado')));
 end if;
 if _accion='cliente' then
  ced:=_datos->>'cedula';if coalesce(ced,'') !~ '^[0-9]{5,12}$' then raise exception 'Revisa la cédula';end if;
  select to_jsonb(c) into cliente from bingo_security.soporte_clientes c where c.cedula=ced;
  return jsonb_build_object('cliente',cliente,'compras',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'cartones',cartones,'estado',estado,'monto',monto_bs) order by id desc),'[]') from public.inscripciones where btrim(cedula)=ced));
 end if;
 if _accion='historial' then
  return jsonb_build_object('gestiones',(select coalesce(jsonb_agg(to_jsonb(h) order by creado_en desc),'[]') from
   (select s.id,s.creado_en,s.cedula,s.cartones,s.estado,s.registro_id,s.recibo,
    case when s.anchor=anchor then i.estado else null end as estado_actual
    from bingo_security.soporte_gestiones s left join public.inscripciones i on i.id=s.registro_id
    where s.operador=_actor or _actor=propietario order by s.creado_en desc limit 100) h));
 end if;
 ident:=(_datos->>'id')::uuid;
 if ident is null then raise exception 'Solicitud inválida';end if;
 -- Mismo orden de locks que el resto de compras; el bloqueo de tablas coordina el reinicio.
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 lock table public.inscripciones,public.cartones in exclusive mode;
 perform 1 from public.configuracion where clave in ('precio_carton','ventas_abierta','total_cartones','version_cartones') for share;
 total:=public.fn_total_cartones_actual();
 select valore::numeric into precio from public.configuracion where clave='precio_carton';
 select coalesce(valore,valor::text,'false') into abierto from public.configuracion where clave='ventas_abierta';
 -- Recalcular después del bloqueo por si se reinició mientras se esperaba.
 anchor:=md5(coalesce((select id::text from bingo_security.snapshots order by created_at desc,id desc limit 1),'inicial')||'|'||total::text||'|'||coalesce((select valore from public.configuracion where clave='version_cartones'),''));
 select * into g from bingo_security.soporte_gestiones where id=ident for update;
 if found and g.operador<>_actor then raise exception 'Esta gestión pertenece a otro operador' using errcode='42501';end if;
 if _accion='resultado' then return jsonb_build_object('gestion',to_jsonb(g),'vigente',g.anchor=anchor);end if;
 if _accion='liberar' then
  if g.estado='reservado' and g.anchor=anchor then
   delete from public.cartones c where c.numero=any(g.cartones) and c.cedula=g.cedula and c.reserved_at=g.creado_en
    and not exists(select 1 from public.inscripciones i where c.numero=any(i.cartones) and i.estado in ('pendiente','aprobado'));
   update bingo_security.soporte_gestiones set estado='cancelado' where id=ident;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if _accion='reservar' then
  if g.id is not null then
   if g.cedula is distinct from _datos->>'cedula' then raise exception 'La solicitud ya se utilizó con otros datos';end if;
   return jsonb_build_object('gestion',to_jsonb(g),'vigente',g.anchor=anchor);
  end if;
  if _datos->>'anchor' is distinct from anchor then raise exception 'El sorteo cambió. Actualiza antes de reservar';end if;
  if coalesce(abierto,'false') not in ('true','1') then raise exception 'Las ventas están cerradas';end if;
  if precio is null or precio<=0 or precio::text in ('NaN','Infinity','-Infinity') then raise exception 'Precio no configurado';end if;
  ced:=_datos->>'cedula';cantidad:=(_datos->>'cantidad')::int;
  if coalesce(ced,'') !~ '^[0-9]{5,12}$' or cantidad is null or cantidad not between 1 and 100 then raise exception 'Revisa cédula y cantidad (1 a 100)';end if;
  if exists(select 1 from bingo_security.soporte_gestiones where operador=_actor and estado='reservado' and vence>now() and anchor=soporte_gestiones.anchor) then raise exception 'Completa o libera tu reserva anterior';end if;
  select coalesce(array_agg(value::bigint),array[]::bigint[]) into pedidos from jsonb_array_elements_text(coalesce(_datos->'numeros','[]'));
  if cardinality(pedidos)>cantidad or cardinality(pedidos)<>(select count(distinct x) from unnest(pedidos) x) or exists(select 1 from unnest(pedidos) x where x<1 or x>total) then raise exception 'Revisa los números solicitados';end if;
  select array_agg(x) into conflictos from unnest(pedidos) x where exists(select 1 from public.cartones where numero=x)
   or exists(select 1 from public.inscripciones where x=any(cartones) and estado in ('pendiente','aprobado'));
  if cardinality(conflictos)>0 then return jsonb_build_object('conflictos',conflictos);end if;
  select pedidos||coalesce(array_agg(q.n),array[]::bigint[]) into nums from
   (select x.n::bigint n from generate_series(1,total) x(n) where not(x.n=any(pedidos)) and not exists(select 1 from public.cartones c where c.numero=x.n)
    and not exists(select 1 from public.inscripciones i where x.n::bigint=any(i.cartones) and i.estado in ('pendiente','aprobado'))
    order by random() limit cantidad-cardinality(pedidos)) q;
  if cardinality(nums)<>cantidad then raise exception 'No hay suficientes cartones disponibles';end if;
  insert into public.cartones(numero,cedula,ocupado,partida_id,created_at,reserved_at) select unnest(nums),ced,true,null,now(),now();
  insert into bingo_security.soporte_gestiones(id,operador,cedula,anchor,cartones,precio,vence)
   values(ident,_actor,ced,anchor,nums,precio,now()+interval '5 minutes') returning * into g;
  return jsonb_build_object('gestion',to_jsonb(g),'vigente',true);
 end if;
 if g.id is null then raise exception 'No se encontró la reserva';end if;
 if _accion='registrar' and g.estado='registrado' then
  if g.compra is distinct from _datos->'compra' then raise exception 'La solicitud ya se utilizó con otros datos';end if;
  return jsonb_build_object('recibo',g.recibo,'repetido',true);
 end if;
 if g.anchor is distinct from anchor or _datos->>'anchor' is distinct from anchor then raise exception 'El sorteo cambió. Actualiza antes de comprar';end if;
 if g.estado<>'reservado' or g.vence<=now() then raise exception 'La reserva venció. Selecciona nuevamente los cartones';end if;
 foreach n in array g.cartones loop
  if not exists(select 1 from public.cartones where numero=n and cedula=g.cedula and reserved_at=g.creado_en)
   or exists(select 1 from public.inscripciones where n=any(cartones) and estado in ('pendiente','aprobado')) then raise exception 'Un cartón ya no está reservado. Selecciona nuevamente';end if;
 end loop;
 if _accion='upload' then return jsonb_build_object('ok',true);end if;
 if _accion<>'registrar' then raise exception 'Acción inválida';end if;
 if coalesce(abierto,'false') not in ('true','1') then raise exception 'Las ventas están cerradas';end if;
 if precio is distinct from g.precio or (_datos->>'precio')::numeric is distinct from precio then raise exception 'El precio cambió. Libera la reserva y revisa el nuevo monto';end if;
 compra:=_datos->'compra';
 if jsonb_typeof(compra) is distinct from 'object' or length(compra::text)>4000 or coalesce(compra->>'nombre','') !~ '[[:alpha:]]+[[:space:]]+.*[[:alpha:]]' or compra->>'nombre' ~ '[0-9[:cntrl:]<>]' or length(compra->>'nombre')>160
  or coalesce(compra->>'telefono','') !~ '^0(412|414|416|424|426)[0-9]{7}$'
  or coalesce(compra->>'banco','') !~ '^[0-9]{4}$'
  or coalesce(compra->>'referencia','') !~ '^[0-9]{4,64}$'
  or coalesce(compra->>'pago_cedula','') !~ '^[0-9]{5,12}$'
  or coalesce(compra->>'pago_telefono','') !~ '^0(412|414|416|424|426)[0-9]{7}$'
  or coalesce(compra->>'pago_banco','') !~ '^[0-9]{4}$' then raise exception 'Revisa nombre, teléfono, banco, referencia y datos de quien pagó';end if;
 archivo:='soporte/'||ident::text||'.jpg';
 select metadata into meta from storage.objects where bucket_id='comprobantes' and name=archivo;
 if meta is null or meta->>'mimetype'<>'image/jpeg' or coalesce((meta->>'size')::bigint,0) not between 1 and 5242880 then raise exception 'Adjunta una captura válida del pago';end if;
 if exists(select 1 from bingo_security.soporte_gestiones s where s.estado='registrado' and s.anchor=anchor and s.compra->>'referencia'=compra->>'referencia') then raise exception 'Esta referencia completa ya fue registrada por soporte. Revisa el historial';end if;
 insert into public.inscripciones(nombre,telefono,cedula,cartones,referencia4dig,comprobante,estado,monto_bs,pago_banco,pago_telefono,pago_cedula,usa_promo,precio_unitario_bs,origen_registro)
 values(btrim(compra->>'nombre'),compra->>'telefono',g.cedula,g.cartones,right(compra->>'referencia',4),
  'https://dbkixcpwirjwjvjintkr.supabase.co/storage/v1/object/public/comprobantes/'||archivo,'pendiente',precio*cardinality(g.cartones),
  compra->>'pago_banco',compra->>'pago_telefono',compra->>'pago_cedula',false,precio,'soporte') returning id into registro;
 -- Banco del cliente independiente del banco de la persona que pagó.
 update bingo_security.soporte_clientes set banco=compra->>'banco' where cedula=g.cedula;
 recibo:=jsonb_build_object('id',registro,'nombre',compra->>'nombre','cedula',g.cedula,'cartones',g.cartones,'monto',precio*cardinality(g.cartones),'estado','pendiente');
 update bingo_security.soporte_gestiones set estado='registrado',registro_id=registro,compra=operacion.compra,recibo=operacion.recibo where id=ident;
 return jsonb_build_object('recibo',recibo);
end $$;
revoke all on function public.soporte_compras_backend(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.soporte_compras_backend(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
