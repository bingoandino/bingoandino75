-- Solo la función del servidor consume esta cuota. No concede acceso a compras.
create function public.rpc_asistente_consumir_cupo(_origen text) returns boolean
language plpgsql security definer set search_path='' as $$
declare direccion inet; canon text; secreto text; clave text;
begin
 if length(coalesce(_origen,''))>64 or position('/' in coalesce(_origen,''))>0 then return false;end if;
 begin direccion:=_origen::inet;exception when invalid_text_representation then return false;end;
 if direccion is null then return false;end if;
 canon:=case when family(direccion)=6 then network(set_masklen(direccion,64))::text else host(direccion) end;
 select salt into secreto from bingo_security.abuse_settings where id;
 if secreto is null then return false;end if;
 clave:=encode(extensions.hmac(canon,secreto,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('asistente_consultas_cupo',0));
 perform bingo_security.consume_quota('asistente:global:dia',1,interval '1 day',500);
 perform bingo_security.consume_quota('asistente:ip:min:'||clave,1,interval '1 minute',8);
 perform bingo_security.consume_quota('asistente:ip:dia:'||clave,1,interval '1 day',80);
 return true;
end $$;
revoke all on function public.rpc_asistente_consumir_cupo(text) from public,anon,authenticated;
grant execute on function public.rpc_asistente_consumir_cupo(text) to service_role;
