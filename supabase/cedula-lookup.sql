create function public.rpc_consultar_cartones_cedula(_cedula text)
returns table(id bigint,cartones bigint[],estado text)
language sql stable security invoker set search_path='' as $$
 select i.id,i.cartones,i.estado from public.inscripciones i
 where regexp_replace(_cedula,'[.[:space:]]','','g') ~ '^[0-9]{5,12}$'
 and length(_cedula)<=64
 and regexp_replace(i.cedula,'[.[:space:]]','','g') = regexp_replace(_cedula,'[.[:space:]]','','g')
 order by i.id desc;
$$;
revoke all on function public.rpc_consultar_cartones_cedula(text) from public;
grant execute on function public.rpc_consultar_cartones_cedula(text) to anon,authenticated;
