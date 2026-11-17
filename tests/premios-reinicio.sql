-- Integration check: execute only inside BEGIN/ROLLBACK.
DO $$
declare st jsonb; respaldo uuid; ruleta bigint[]; dinamicas bigint[]; n bigint; bloqueado boolean;
begin
 perform set_config('request.jwt.claim.role','service_role',true);
 -- Only within this rolled-back test, select the legacy service reset path.
 update bingo_security.reset_key_state set key_hash=null where singleton;
 respaldo:=public.rpc_reiniciar_sorteo_seguro();
 if respaldo is null or not exists(select 1 from bingo_security.snapshots where id=respaldo) then raise exception 'No reset snapshot';end if;
 if exists(select 1 from public.inscripciones) then raise exception 'Reset registrations';end if;
 st:=bingo_security.estado_apartados_premios();
 if st->>'ruleta'<>'8' or st->>'dinamicas'<>'5' or (select count(*) from public.cartones)<>13 then raise exception 'Defaults missing';end if;
 select array_agg(numero) into ruleta from public.cartones where premio_apartado='ruleta';
 select array_agg(numero) into dinamicas from public.cartones where premio_apartado='dinamicas';
 if ruleta && dinamicas then raise exception 'Overlapping groups';end if;
 -- Simulate seven consumed pool rows; delivery logic has its own integration test.
 update public.cartones set premio_apartado=null,cedula='test-delivered' where numero=any(ruleta[1:7]);
 st:=bingo_security.estado_apartados_premios();if st->>'ruleta'<>'1' then raise exception 'One should remain';end if;
 st:=bingo_security.ajustar_apartados_premios(0,5,st->>'version');
 if st->>'ruleta'<>'0' or st->>'dinamicas'<>'5' then raise exception 'Release crossed groups';end if;
 if (select count(*) from public.cartones where numero=any(ruleta[1:7]))<>7 or exists(select 1 from public.cartones where numero=ruleta[8]) then raise exception 'Release touched consumed cards';end if;
 st:=bingo_security.ajustar_apartados_premios(0,0,st->>'version');
 if exists(select 1 from public.cartones where numero=any(dinamicas)) then raise exception 'Dynamic leftovers remain';end if;
 respaldo:=public.rpc_reiniciar_sorteo_seguro();
 st:=bingo_security.estado_apartados_premios();if st->>'ruleta'<>'8' or st->>'dinamicas'<>'5' then raise exception 'Next reset defaults';end if;
end $$;
