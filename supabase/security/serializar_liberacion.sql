create or replace function public.rpc_liberar_reserva_seguro(_numero bigint default null,_cedula text default null,_partida_id bigint default null)
 returns boolean language plpgsql security definer set search_path='' as $$
declare h bytea; afectados int;
begin
 h:=bingo_security.token_hash();
 if h is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 delete from public.cartones c using bingo_security.reservation_owners o
  where o.numero=c.numero and o.token_hash=h and trim(c.cedula)=trim(_cedula)
   and (_numero is null or c.numero=_numero) and c.partida_id is not distinct from _partida_id
   and not exists(select 1 from public.inscripciones i where c.numero=any(i.cartones) and i.estado in ('pendiente','aprobado'));
 get diagnostics afectados=row_count;return afectados>0;
end $$;
