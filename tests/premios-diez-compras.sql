-- Run in a transaction and ROLLBACK, including the migration.
DO $$
declare i int; st jsonb; respaldo uuid; count_before int;
begin
 perform set_config('request.jwt.claim.role','service_role',true);
 update bingo_security.reset_key_state set key_hash=null where singleton;
 respaldo:=public.rpc_reiniciar_sorteo_seguro();
 if exists(select 1 from public.cartones) then raise exception 'Reset reserved cards too early';end if;
 -- Nine approved purchases, several cards each: count purchases, not cards.
 for i in 1..9 loop
 insert into public.inscripciones(nombre,telefono,cedula,cartones,estado,monto_bs,origen_registro) values('Prueba Umbral','04120000000','999999999991',array[i*2-1,i*2]::bigint[],'aprobado',100,'compra');
 end loop;
 if exists(select 1 from public.cartones where premio_apartado is not null) then raise exception 'Reserved before tenth';end if;
 -- A free prize and pending purchase do not count.
 insert into public.inscripciones(nombre,telefono,cedula,cartones,estado,monto_bs,origen_registro) values('Premio Prueba','04120000000','999999999992',array[19]::bigint[],'aprobado',0,'premio_dinamica');
 insert into public.inscripciones(nombre,telefono,cedula,cartones,estado,monto_bs,origen_registro) values('Compra Prueba','04120000000','999999999993',array[20]::bigint[],'pendiente',100,'soporte');
 if exists(select 1 from public.cartones where premio_apartado is not null) then raise exception 'Counted gift or pending';end if;
 update public.inscripciones set estado='aprobado' where cedula='999999999993';
 st:=bingo_security.estado_apartados_premios();
 if st->>'ruleta'<>'8' or st->>'dinamicas'<>'5' or st->>'automatico'<>'completado' then raise exception 'Tenth did not reserve: %',st;end if;
 if exists(select 1 from public.cartones c join public.inscripciones r on c.numero=any(r.cartones) where c.premio_apartado is not null) then raise exception 'Reserved sold cards';end if;
 st:=bingo_security.ajustar_apartados_premios(0,0,st->>'version');
 insert into public.inscripciones(nombre,telefono,cedula,cartones,estado,monto_bs,origen_registro) values('Compra Once','04120000000','999999999994',array[21]::bigint[],'aprobado',100,'compra');
 perform bingo_security.intentar_apartado_automatico();
 if exists(select 1 from public.cartones where premio_apartado is not null) then raise exception 'Rearmed after releasing';end if;
 respaldo:=public.rpc_reiniciar_sorteo_seguro();
 st:=bingo_security.estado_apartados_premios();if st->>'automatico'<>'esperando' or st->>'comprasAprobadas'<>'0' or st->>'ruleta'<>'0' then raise exception 'Next reset not rearmed';end if;
 -- Sold-out threshold must not prevent approving a purchase, then retry when free.
 insert into public.cartones(numero,cedula,ocupado) select n,'test',true from generate_series(1,public.fn_total_cartones_actual()) n;
 for i in 1..10 loop
 insert into public.inscripciones(nombre,telefono,cedula,cartones,estado,monto_bs,origen_registro) values('Prueba Sin Cupos','04120000000','999999999995',array[i]::bigint[],'aprobado',100,'compra');
 end loop;
 if (select count(*) from public.inscripciones)<>10 or (select estado from bingo_security.premios_automaticos where singleton)<>'sin_cupos' then raise exception 'Insufficient stock blocked purchases';end if;
 delete from public.cartones where numero>10;
 perform bingo_security.intentar_apartado_automatico();
 st:=bingo_security.estado_apartados_premios();if st->>'ruleta'<>'8' or st->>'dinamicas'<>'5' then raise exception 'Retry failed';end if;
end $$;
