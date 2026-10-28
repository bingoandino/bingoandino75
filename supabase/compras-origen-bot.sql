-- Mark the assistant purchase channel; payment, reservation and approval rules stay intact.
begin;
alter table public.inscripciones add column if not exists origen_registro text not null default 'compra';
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
 insert into public.inscripciones(nombre,telefono,cedula,referido,cartones,referencia4dig,comprobante,estado,monto_bs,pago_banco,pago_telefono,pago_cedula,usa_promo,promo_desc,precio_unitario_bs,origen_registro)
 values(left(_compra->>'nombre',160),left(_compra->>'telefono',30),ced,left(_compra->>'referido',160),nums,
 right(regexp_replace(coalesce(_compra->>'referencia4dig',''),'[^0-9]','','g'),4),left(_compra->>'comprobante',2048),'pendiente',precio*cardinality(nums),
 left(_compra->>'pago_banco',160),left(_compra->>'pago_telefono',30),left(_compra->>'pago_cedula',30),false,null,precio,case when _compra->>'origen_registro'='bot' then 'bot' else 'compra' end) returning id into identificador;
 return identificador;
end $function$;

notify pgrst,'reload schema';
commit;
