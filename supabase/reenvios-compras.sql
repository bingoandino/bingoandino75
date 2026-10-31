-- Reenvío accidental: misma cédula, últimos cuatro dígitos y archivo idéntico.
-- El ETag lo calcula Storage; no se acepta una huella enviada por el navegador.
-- La referencia 0000 queda excluida. Se conserva el RPC anterior para compatibilidad.
create or replace function public.rpc_registrar_compra_idempotente(_compra jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  ced text;
  ref text;
  archivo text;
  meta jsonb;
  huella text;
  existente public.inscripciones%rowtype;
  identificador bigint;
  numero bigint;
begin
  if jsonb_typeof(_compra) is distinct from 'object' or octet_length(_compra::text)>24000 then
    raise exception 'Compra inválida';
  end if;
  ced := trim(coalesce(_compra->>'cedula',''));
  if bingo_security.token_hash() is null or ced !~ '^[0-9]{5,12}$' then
    raise exception 'Reserva de compra no válida' using errcode='42501';
  end if;
  if coalesce(_compra->>'referencia4dig','') !~ '^[0-9]{4,64}$' then raise exception 'Referencia inválida';end if;
  ref := right(_compra->>'referencia4dig',4);
  if coalesce(_compra->>'comprobante','') !~ '^https://dbkixcpwirjwjvjintkr[.]supabase[.]co/storage/v1/object/public/comprobantes/[A-Za-z0-9/_-]+[.](jpg|jpeg|png|webp)$' then
    raise exception 'Comprobante inválido';
  end if;
  if jsonb_typeof(_compra->'cartones') is distinct from 'array' or jsonb_array_length(_compra->'cartones') not between 1 and 100 then
    raise exception 'Cantidad de cartones inválida';
  end if;
  archivo := substring(_compra->>'comprobante' from '/comprobantes/(.+)$');
  select metadata into meta from storage.objects where bucket_id='comprobantes' and name=archivo;
  huella := lower(trim(both '"' from coalesce(meta->>'eTag','')));
  -- Comparar y registrar comparten el mismo bloqueo que la reserva/compra original.
  perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
  if ref <> '0000' and huella ~ '^[a-f0-9]{32}$' then
    select i.* into existente
    from public.inscripciones i
    join storage.objects o on o.bucket_id='comprobantes'
      and o.name=substring(i.comprobante from '/comprobantes/(.+)$')
    where trim(i.cedula)=ced
      and right(regexp_replace(coalesce(i.referencia4dig,''),'[^0-9]','','g'),4)=ref
      and lower(trim(both '"' from coalesce(o.metadata->>'eTag','')))=huella
      and o.metadata->>'size'=meta->>'size'
      and o.metadata->>'mimetype'=meta->>'mimetype'
    order by i.id asc limit 1;
    if found then
      -- Libera solo la selección de esta pestaña que no pertenece a una compra activa.
      for numero in select value::bigint from jsonb_array_elements_text(_compra->'cartones') loop
        perform public.rpc_liberar_reserva_seguro(numero,ced,null);
      end loop;
      return jsonb_build_object('id',existente.id,'cartones',existente.cartones,
        'estado',existente.estado,'monto_bs',existente.monto_bs,'reenvio',true);
    end if;
  end if;
  -- Conserva las validaciones y los permisos de la compra original.
  identificador := public.rpc_registrar_compra_segura(_compra);
  select * into existente from public.inscripciones where id=identificador;
  return jsonb_build_object('id',existente.id,'cartones',existente.cartones,
    'estado',existente.estado,'monto_bs',existente.monto_bs,'reenvio',false);
end;
$function$;
revoke all on function public.rpc_registrar_compra_idempotente(jsonb) from public;
grant execute on function public.rpc_registrar_compra_idempotente(jsonb) to anon,authenticated;
comment on function public.rpc_registrar_compra_idempotente(jsonb) is
  'Registro público con credencial de reserva; evita reenvíos accidentales de un cliente con referencia y comprobante idénticos. Excluye 0000.';
