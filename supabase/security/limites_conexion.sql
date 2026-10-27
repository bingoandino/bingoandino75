-- Cuotas privadas por origen de red: cambiar cédula o credencial no renueva la cuota.
create table bingo_security.abuse_settings (
 id boolean primary key default true check(id),
 salt text not null default encode(extensions.gen_random_bytes(32),'hex'),
 enabled boolean not null default true,
 max_reserved integer not null default 200 check(max_reserved between 100 and 1000),
 requests_per_minute integer not null default 600 check(requests_per_minute>=180),
 cards_per_hour integer not null default 1000 check(cards_per_hour>=200)
);
insert into bingo_security.abuse_settings(id) values(true);
alter table bingo_security.abuse_settings enable row level security;
revoke all on bingo_security.abuse_settings from public,anon,authenticated;
alter table bingo_security.reservation_owners add column origin_hash bytea;
create index reservation_owners_origin_idx on bingo_security.reservation_owners(origin_hash);

create function bingo_security.request_origin_hash() returns bytea
language plpgsql stable security definer set search_path='' as $$
declare raw text; direccion inet; canon text; secreto text;
begin
 -- Solo se usa la cabecera del proxy Cloudflare, nunca X-Forwarded-For del cliente.
 raw:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'cf-connecting-ip';
 if raw is null or length(raw)>64 then return null;end if;
 begin direccion:=raw::inet;exception when invalid_text_representation then return null;end;
 if position('/' in raw)>0 then return null;end if;
 canon:=case when family(direccion)=6 then network(set_masklen(direccion,64))::text else host(direccion) end;
 select salt into secreto from bingo_security.abuse_settings where id;
 return extensions.hmac(canon,secreto,'sha256');
end $$;
revoke all on function bingo_security.request_origin_hash() from public,anon,authenticated;

create function bingo_security.consume_quota(k text,amount int,span interval,maximum int) returns void
language plpgsql set search_path='' as $$
declare used int;
begin
 insert into bingo_security.rate_limits as l(key,window_start,requests) values(k,clock_timestamp(),amount)
 on conflict(key) do update set requests=case when l.window_start<=clock_timestamp()-span then amount else l.requests+amount end,
 window_start=case when l.window_start<=clock_timestamp()-span then clock_timestamp() else l.window_start end
 returning requests into used;
 if used>maximum then raise exception 'Muchas solicitudes desde tu conexión. Espera un momento y vuelve a intentarlo.' using errcode='P0001';end if;
end $$;
revoke all on function bingo_security.consume_quota(text,int,interval,int) from public,anon,authenticated;

create function bingo_security.check_origin_quota(cantidad int) returns void
language plpgsql set search_path='' as $$
declare origen bytea; cfg bingo_security.abuse_settings; ocupadas bigint; clave text;
begin
 if public.es_admin_bingo() or auth.role()='service_role' then return;end if;
 select * into cfg from bingo_security.abuse_settings where id;
 if not found then raise exception 'No se pudo verificar la protección. Vuelve a intentarlo.';end if;
 if not cfg.enabled then return;end if;
 origen:=bingo_security.request_origin_hash();
 if origen is null then raise exception 'No se pudo verificar tu conexión. Actualiza la página e inténtalo de nuevo.';end if;
 clave:=encode(origen,'hex');
 perform bingo_security.consume_quota('origen:min:'||clave,1,interval '1 minute',cfg.requests_per_minute);
 perform bingo_security.consume_quota('origen:hora:'||clave,cantidad,interval '1 hour',cfg.cards_per_hour);
 select count(*) into ocupadas from bingo_security.reservation_owners o join public.cartones c on c.numero=o.numero
 where o.origin_hash=origen and not exists(select 1 from public.inscripciones i where c.numero=any(i.cartones) and i.estado='aprobado');
 if ocupadas+cantidad>cfg.max_reserved then
  raise exception 'Hay varias compras sin completar desde tu conexión. Completa las pendientes o contacta a soporte.';
 end if;
 -- Evita conservar contadores de conexiones que ya no están activas.
 if random()<0.01 then delete from bingo_security.rate_limits where window_start<clock_timestamp()-interval '1 day';end if;
end $$;
revoke all on function bingo_security.check_origin_quota(int) from public,anon,authenticated;

create function bingo_security.assign_reservation_origin() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.origin_hash is null then new.origin_hash:=bingo_security.request_origin_hash();end if;
 return new;
end $$;
revoke all on function bingo_security.assign_reservation_origin() from public,anon,authenticated;
create trigger asignar_origen_reserva before insert on bingo_security.reservation_owners
 for each row execute function bingo_security.assign_reservation_origin();

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
 perform bingo_security.check_origin_quota(_cantidad);
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
