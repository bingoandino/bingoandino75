-- Execute with migration in BEGIN/ROLLBACK. No records survive.
DO $$
declare st jsonb; r jsonb; again jsonb; src public.inscripciones%rowtype; a text; sid uuid:=gen_random_uuid(); did uuid:=gen_random_uuid(); dyn uuid:=gen_random_uuid(); nums bigint[]; n bigint; blocked boolean; sources jsonb;
begin
 perform set_config('request.jwt.claim.role','service_role',true);
 -- Test transaction only: allow delivery even when sales are closed.
 update public.configuracion set valor=true where clave='ventas_abierta';
 select min(id)::text into a from public.inscripciones;
 st:=bingo_security.estado_apartados_premios();st:=bingo_security.ajustar_apartados_premios(2,1,st->>'version');
 if (st->>'ruleta')::int<>2 or (st->>'dinamicas')::int<>1 then raise exception 'counts';end if;
 blocked:=false;begin perform bingo_security.ajustar_apartados_premios(0,0,'stale');exception when others then blocked:=true;end;if not blocked then raise exception 'stale version accepted';end if;
 blocked:=false;begin perform bingo_security.ajustar_apartados_premios(10000,10000,st->>'version');exception when others then blocked:=true;end;if not blocked or bingo_security.estado_apartados_premios()<>st then raise exception 'over-reservation not atomic';end if;
 update public.cartones set reserved_at=now()-interval '1 day',created_at=now()-interval '1 day' where premio_apartado is not null;
 perform public.rpc_liberar_cartones_huerfanos();if (select count(*) from public.cartones where premio_apartado is not null)<>3 then raise exception 'expiry removed reserved prizes';end if;
 select array_agg(numero) into nums from public.cartones where premio_apartado='ruleta';
 select * into src from public.inscripciones i where estado='aprobado' and partida_id is null and cardinality(cartones)>0 and not exists(select 1 from public.inscripciones r where r.origen_registro='premio_slot' and r.slot_premio_source_anchor=a and r.cedula=i.cedula) limit 1;
 if src.id is null then raise exception 'no test participant';end if;
 insert into public.slot_premios_sesiones(id,owner_id,source_anchor,state,version) values(sid,'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',a,jsonb_build_object('participants','[]'::jsonb,'winners',jsonb_build_array(jsonb_build_object('drawId',did,'personId','test-apartados','name',src.nombre,'ticket',src.cartones[1]::text,'prize','1 cartón gratis'))),0);
 sources:=jsonb_build_array(jsonb_build_object('drawId',did,'sourceId',src.id,'cedula',regexp_replace(src.cedula,'[^0-9]','','g')));
 r:=public.slot_asignar_premios(sid,'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',sources,false);if (r->>'available')::int<>2 or r->>'canAssign'<>'true' then raise exception 'slot preview';end if;
 r:=public.slot_asignar_premios(sid,'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',sources,true);
 n:=(r->'awards'->0->>'assignedTicket')::bigint;if not n=any(nums) or (select premio_apartado from public.cartones where numero=n) is not null then raise exception 'slot pool';end if;
 again:=public.slot_asignar_premios(sid,'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5','[]'::jsonb,true);if again->'awards'<>r->'awards' then raise exception 'slot replay';end if;
 select numero into n from public.cartones where premio_apartado='dinamicas';
 r:=public.dinamicas_entregar_carton(dyn,'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5','Prueba Apartados','999999999991','04120000000','0102',a,true);
 if (r->'winner'->>'carton')::bigint<>n then raise exception 'dynamic pool';end if;
 again:=public.dinamicas_entregar_carton(dyn,'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5','Prueba Apartados','999999999991','04120000000','0102',a,true);if again->>'replayed'<>'true' then raise exception 'dynamic replay';end if;
 blocked:=false;begin perform public.dinamicas_entregar_carton(gen_random_uuid(),'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5','Otra Prueba','999999999992','04120000000','0102',a,false);exception when others then if sqlerrm like 'No hay cartones disponibles%' then blocked:=true;else raise;end if;end;if not blocked then raise exception 'empty pool';end if;
 r:=public.dinamicas_panel();if (r->>'available')::int<>0 then raise exception 'panel count';end if;
 st:=bingo_security.estado_apartados_premios();st:=bingo_security.ajustar_apartados_premios(0,0,st->>'version');if exists(select 1 from public.cartones where premio_apartado is not null) or not exists(select 1 from public.cartones where numero=n) then raise exception 'release';end if;
 perform set_config('request.jwt.claim.role','anon',true);blocked:=false;begin perform public.rpc_apartados_premios('invalid','invalid');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'unauthorized';end if;
end $$;
