-- RLS: administrador y propietario de la reserva; service_role conserva sus permisos.
create or replace function bingo_security.puede_leer_cartones(nums bigint[]) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.es_admin_bingo(),false) or exists(
 select 1 from bingo_security.reservation_owners o where o.numero=any(nums) and o.token_hash=bingo_security.token_hash());
$$;
revoke all on function bingo_security.puede_leer_cartones(bigint[]) from public;
grant usage on schema bingo_security to anon,authenticated;
grant execute on function bingo_security.puede_leer_cartones(bigint[]) to anon,authenticated;
create policy bingo_lectura_inscripciones_privada on public.inscripciones as restrictive for select to anon,authenticated
 using (bingo_security.puede_leer_cartones(cartones));
create policy bingo_lectura_reservas_privada on public.cartones as restrictive for select to anon,authenticated
 using (bingo_security.puede_leer_cartones(array[numero]));
-- Vista deliberadamente pública: solo números ocupados, sin datos del comprador.
create function bingo_security.listar_disponibilidad() returns table(numero bigint)
language sql stable security definer set search_path='' as $$ select c.numero from public.cartones c; $$;
revoke all on function bingo_security.listar_disponibilidad() from public;
grant execute on function bingo_security.listar_disponibilidad() to anon,authenticated;
create view public.cartones_disponibilidad with (security_invoker=true) as select numero from bingo_security.listar_disponibilidad();
revoke all on public.cartones_disponibilidad from public,anon,authenticated;
grant select on public.cartones_disponibilidad to anon,authenticated;
create or replace function bingo_security.consultar_cartones(ced text)
returns table(id bigint,cartones bigint[],estado text) language sql stable security definer set search_path='' as $$
 select i.id,i.cartones,i.estado from public.inscripciones i
 where length(ced)<=64 and regexp_replace(ced,'[.[:space:]]','','g') ~ '^[0-9]{5,12}$'
 and regexp_replace(i.cedula,'[.[:space:]]','','g')=regexp_replace(ced,'[.[:space:]]','','g') order by i.id desc;
$$;
revoke all on function bingo_security.consultar_cartones(text) from public;
grant execute on function bingo_security.consultar_cartones(text) to anon,authenticated;
create or replace function public.rpc_consultar_cartones_cedula(_cedula text)
returns table(id bigint,cartones bigint[],estado text) language sql stable security invoker set search_path='' as $$
 select * from bingo_security.consultar_cartones(_cedula);
$$;
revoke execute on function public.rpc_verificar_compra_por_cedula(text) from public,anon,authenticated;
create or replace function bingo_security.aprobados_publicos()
returns table(nombre text,cedula text,cartones bigint[],estado text)
language sql stable security definer set search_path='' as $$
 select i.nombre,'****'||right(i.cedula,4),i.cartones,i.estado from public.inscripciones i where i.estado='aprobado';
$$;
revoke all on function bingo_security.aprobados_publicos() from public;
grant execute on function bingo_security.aprobados_publicos() to anon,authenticated;
create or replace function public.rpc_aprobados_publicos()
returns table(nombre text,cedula text,cartones bigint[],estado text) language sql stable security invoker set search_path='' as $$
 select * from bingo_security.aprobados_publicos();
$$;
revoke all on function public.rpc_aprobados_publicos() from public;
grant execute on function public.rpc_aprobados_publicos() to anon,authenticated;
create or replace function bingo_security.top_publico()
returns table(nombre text,cedula text,total bigint) language sql stable security definer set search_path='' as $$
 select (array_agg(i.nombre order by i.id desc))[1],'****'||right(i.cedula,4),sum(cardinality(i.cartones))::bigint
 from public.inscripciones i where i.estado='aprobado' group by i.cedula order by 3 desc,2 limit 5;
$$;
revoke all on function bingo_security.top_publico() from public;
grant execute on function bingo_security.top_publico() to anon,authenticated;
create or replace function public.rpc_top_publico() returns table(nombre text,cedula text,total bigint)
language sql stable security invoker set search_path='' as $$ select * from bingo_security.top_publico(); $$;
revoke all on function public.rpc_top_publico() from public;
grant execute on function public.rpc_top_publico() to anon,authenticated;
-- Los comprobantes requieren una sesión de administrador para leerse o firmarse.
create policy bingo_comprobantes_lectura_privada on storage.objects as restrictive for select to anon,authenticated
 using (bucket_id<>'comprobantes' or public.es_admin_bingo());
update storage.buckets set public=false,file_size_limit=10485760,
 allowed_mime_types=array['image/jpeg','image/jpg','image/png','image/webp'] where id='comprobantes';

CREATE OR REPLACE FUNCTION bingo_security.check_reservation(_cedula text, _cantidad integer)
 RETURNS bytea
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare h bytea; total int; ocupadas int; propias int; abiertas text; r int; ip text; bucket text;
begin
 h:=bingo_security.token_hash();
 if h is null then raise exception 'Actualiza la página para reservar tus cartones de forma segura' using errcode='42501'; end if;
 if coalesce(trim(_cedula),'') !~ '^[0-9]{5,12}$' then raise exception 'Cédula requerida'; end if;
 total:=public.fn_total_cartones_actual();
 if _cantidad is null or _cantidad<1 or _cantidad>total then raise exception 'Cantidad inválida'; end if;
 select coalesce(valore,valor::text,'true') into abiertas from public.configuracion where clave='ventas_abierta';
 if coalesce(lower(abiertas),'false') not in ('true','1') then raise exception 'Las ventas están cerradas'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 select count(*) into ocupadas from public.cartones c where trim(c.cedula)=trim(_cedula)
  and not exists(select 1 from public.inscripciones i where c.numero=any(i.cartones) and i.estado='aprobado');
 select count(*) into propias from public.cartones c join bingo_security.reservation_owners o on o.numero=c.numero where o.token_hash=h and not exists(select 1 from public.inscripciones i where c.numero=any(i.cartones) and i.estado='aprobado');
 if propias+_cantidad>100 then raise exception 'Completa tu compra antes de reservar más cartones';end if;
 if ocupadas+_cantidad>greatest(100,(select coalesce(max(case when clave='cartones_obligatorios' and valore ~ '^[0-9]{1,6}$' then valore::int end),0) from public.configuracion)) then
  raise exception 'Demasiados cartones reservados sin enviar el comprobante. Completa tu compra antes de reservar más';
 end if;
 if h is not null then
  bucket:='token:'||encode(h,'hex');
  insert into bingo_security.rate_limits as l values(bucket,clock_timestamp(),1)
   on conflict(key) do update set requests=case when l.window_start<clock_timestamp()-interval '1 minute' then 1 else l.requests+1 end,
    window_start=case when l.window_start<clock_timestamp()-interval '1 minute' then clock_timestamp() else l.window_start end returning requests into r;
  if r>180 then raise exception 'Demasiadas solicitudes. Espera un minuto'; end if;
 end if;
 return h;
end $function$
;
CREATE OR REPLACE FUNCTION public.rpc_registrar_compra_segura(_compra jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h bytea; nums bigint[]; n bigint; ced text; identificador bigint; precio numeric; archivo text; meta jsonb;
begin
 h:=bingo_security.token_hash();ced:=trim(coalesce(_compra->>'cedula',''));
 if jsonb_typeof(_compra) is distinct from 'object' or octet_length(_compra::text)>24000 then raise exception 'Compra inválida';end if;
 if ced !~ '^[0-9]{5,12}$' or length(trim(coalesce(_compra->>'nombre','')))<2 or length(_compra->>'nombre')>160 then raise exception 'Revisa nombre y cédula';end if;
 if coalesce(_compra->>'telefono','') !~ '^[+0-9 ()-]{10,30}$' or length(regexp_replace(_compra->>'telefono','[^0-9]','','g')) not between 10 and 15 then raise exception 'Revisa el teléfono';end if;
 if coalesce(_compra->>'referencia4dig','') !~ '^[0-9]{4,64}$' then raise exception 'Referencia inválida';end if;
 if length(trim(coalesce(_compra->>'pago_banco','')))=0 or length(_compra->>'pago_banco')>160 or coalesce(_compra->>'pago_cedula','') !~ '^[0-9]{4,12}$' or coalesce(_compra->>'pago_telefono','') !~ '^[0-9]{10,15}$' then raise exception 'Revisa los datos de Pago Móvil';end if;
 if coalesce(_compra->>'comprobante','') !~ '^https://dbkixcpwirjwjvjintkr[.]supabase[.]co/storage/v1/object/public/comprobantes/[A-Za-z0-9/_-]+[.](jpg|jpeg|png|webp)$' then raise exception 'Comprobante inválido';end if;
 archivo:=substring(_compra->>'comprobante' from '/comprobantes/(.+)$');
 select metadata into meta from storage.objects where bucket_id='comprobantes' and name=archivo;
 if meta is null or lower(coalesce(meta->>'mimetype','')) not in ('image/jpeg','image/png','image/webp') or coalesce((meta->>'size')::bigint,0) not between 1 and 10485760 then raise exception 'El comprobante no está disponible o no es válido';end if;
 if jsonb_typeof(_compra->'cartones') is distinct from 'array' or jsonb_array_length(_compra->'cartones') not between 1 and 100 then raise exception 'Cantidad de cartones inválida';end if;
 select array_agg(value::bigint) into nums from jsonb_array_elements_text(coalesce(_compra->'cartones','[]'::jsonb));
 if h is null or ced='' or coalesce(cardinality(nums),0)<1 then raise exception 'Reserva de compra no válida' using errcode='42501';end if;
 if cardinality(nums)<>(select count(distinct x) from unnest(nums) x) then raise exception 'Cartones repetidos';end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 foreach n in array nums loop
  if not exists(select 1 from public.cartones c join bingo_security.reservation_owners o on o.numero=c.numero where c.numero=n and trim(c.cedula)=ced and o.token_hash=h and c.partida_id is null and coalesce(c.reserved_at,c.created_at)>now()-interval '5 minutes') then raise exception 'Un cartón no tiene una reserva vigente de esta pestaña' using errcode='42501';end if;
  if exists(select 1 from public.inscripciones i where n=any(i.cartones) and i.estado in ('pendiente','aprobado')) then raise exception 'Un cartón ya está registrado';end if;
 end loop;
 select valore::numeric into precio from public.configuracion where clave='precio_carton';
 if precio is null or precio<=0 or precio::text in ('NaN','Infinity','-Infinity') then raise exception 'Precio no configurado';end if;
 insert into public.inscripciones(nombre,telefono,cedula,referido,cartones,referencia4dig,comprobante,estado,monto_bs,pago_banco,pago_telefono,pago_cedula,usa_promo,promo_desc,precio_unitario_bs)
 values(left(_compra->>'nombre',160),left(_compra->>'telefono',30),ced,left(_compra->>'referido',160),nums,
 right(regexp_replace(coalesce(_compra->>'referencia4dig',''),'[^0-9]','','g'),4),left(_compra->>'comprobante',2048),'pendiente',precio*cardinality(nums),
 left(_compra->>'pago_banco',160),left(_compra->>'pago_telefono',30),left(_compra->>'pago_cedula',30),false,null,precio) returning id into identificador;
 return identificador;
end $function$
;
