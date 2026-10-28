-- PREPARADO: no ejecutar en producción hasta publicar la funcionalidad completa.
begin;
alter table public.inscripciones add column if not exists origen_registro text not null default 'compra';
alter table public.inscripciones add column if not exists slot_premio_draw_id uuid;
alter table public.inscripciones add column if not exists slot_premio_sesion_id uuid;
alter table public.inscripciones add column if not exists slot_premio_source_anchor text;
create unique index if not exists inscripciones_slot_premio_draw_unique on public.inscripciones(slot_premio_draw_id) where slot_premio_draw_id is not null;
create unique index if not exists inscripciones_slot_persona_sorteo_unique
 on public.inscripciones(slot_premio_source_anchor,(regexp_replace(cedula,'[^0-9]','','g')))
 where origen_registro='premio_slot' and slot_premio_source_anchor is not null;

create or replace function public.slot_asignar_premios(_session_id uuid,_owner_id uuid,_sources jsonb,_confirm boolean default false)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 s public.slot_premios_sesiones%rowtype;
 src public.inscripciones%rowtype;
 w jsonb; link jsonb; awards jsonb; pending jsonb:='[]'::jsonb; skipped jsonb:='[]'::jsonb; entry jsonb;
 seen_cedulas text[]:=array[]::text[]; person_cedula text;
 anchor text; nums bigint[]; n bigint; needed int:=0; total int; available int; i int:=1; registration_id bigint; result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501';end if;
 if jsonb_typeof(_sources) is distinct from 'array' or jsonb_array_length(_sources)>1000 then raise exception 'Fuentes no válidas';end if;
 -- Same lock order as purchase registration, then block concurrent purchase/reservation writes and resets.
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 lock table public.inscripciones,public.cartones in exclusive mode;
 select * into s from public.slot_premios_sesiones where id=_session_id and owner_id=_owner_id for update;
 if not found then raise exception 'Sesión no encontrada';end if;
 select min(id)::text into anchor from public.inscripciones;
 if anchor is null or anchor is distinct from s.source_anchor then raise exception 'El sorteo cambió. No se pueden entregar cartones de otra sesión';end if;
 awards:=coalesce(s.state->'awards','[]'::jsonb);
 for w in select value from jsonb_array_elements(s.state->'winners') loop
  if regexp_replace(lower(btrim(w->>'prize')),'[[:space:]]+',' ','g') not in ('1 cartón gratis','1 carton gratis') then continue;end if;
  if exists(select 1 from jsonb_array_elements(awards) a where a->>'drawId'=w->>'drawId') then continue;end if;
  if exists(select 1 from public.inscripciones where slot_premio_draw_id=(w->>'drawId')::uuid) then raise exception 'Este premio ya tiene un cartón registrado';end if;
  select value into link from jsonb_array_elements(_sources) where value->>'drawId'=w->>'drawId';
  if link is null then raise exception 'Actualiza la vista previa: falta el registro del ganador';end if;
  select * into src from public.inscripciones where id=(link->>'sourceId')::bigint and estado='aprobado' and (w->>'ticket')::bigint=any(cartones) and regexp_replace(cedula,'[^0-9]','','g')=link->>'cedula';
  if not found then raise exception 'El cartón ganador ya no pertenece al aprobado original';end if;
  if src.partida_id is not null then raise exception 'Sorteo no compatible con esta entrega';end if;
  person_cedula:=regexp_replace(src.cedula,'[^0-9]','','g');
  if person_cedula=any(seen_cedulas) then
   skipped:=skipped||jsonb_build_array(jsonb_build_object('drawId',w->>'drawId','name',src.nombre,'reason','duplicate-person'));
   continue;
  end if;
  -- The bingo source, not the slot session, defines the one-card-per-person limit.
  if exists(select 1 from public.inscripciones r where r.origen_registro='premio_slot' and r.slot_premio_source_anchor=s.source_anchor and regexp_replace(r.cedula,'[^0-9]','','g')=person_cedula)
   or exists(select 1 from public.slot_premios_sesiones old,
    lateral jsonb_array_elements(coalesce(old.state->'awards','[]'::jsonb)) a
    where old.source_anchor=s.source_anchor and (
     (w->>'personId' is not null and a->>'personId'=w->>'personId') or
     exists(select 1 from jsonb_array_elements(old.state->'winners') ow where ow->>'drawId'=a->>'drawId' and w->>'personId' is not null and ow->>'personId'=w->>'personId')
    )) then
   skipped:=skipped||jsonb_build_array(jsonb_build_object('drawId',w->>'drawId','name',src.nombre,'reason','already-received'));
   continue;
  end if;
  seen_cedulas:=array_append(seen_cedulas,person_cedula);
  needed:=needed+1;
  pending:=pending||jsonb_build_array(jsonb_build_object('drawId',w->>'drawId','personId',w->>'personId','name',src.nombre,'winningTicket',w->>'ticket','paymentComplete',coalesce(btrim(src.pago_banco),'')<>'' and coalesce(btrim(src.pago_telefono),'')<>'' and coalesce(btrim(src.pago_cedula),'')<>'','sourceId',src.id));
 end loop;
 total:=public.fn_total_cartones_actual();
 if total<1 then raise exception 'Total de cartones no configurado';end if;
 select array_agg(q.n) into nums from(
  select x.n::bigint n from generate_series(1,total) x(n)
  where not exists(select 1 from public.cartones c where c.numero=x.n)
    and not exists(select 1 from public.inscripciones r where x.n::bigint=any(r.cartones) and r.estado in ('pendiente','aprobado'))
  order by random()
 ) q;
 available:=coalesce(cardinality(nums),0);
 if not _confirm then
  return jsonb_build_object('pending',pending,'skipped',skipped,'awards',awards,'available',available,'canAssign',needed>0 and available>=needed);
 end if;
 if available<needed then raise exception 'No hay suficientes cartones libres. No se entregó ninguno';end if;
 for entry in select value from jsonb_array_elements(pending) loop
  select * into strict src from public.inscripciones where id=(entry->>'sourceId')::bigint;
  n:=nums[i];i:=i+1;
  insert into public.cartones(numero,cedula,ocupado,partida_id,created_at,reserved_at)
  values(n,src.cedula,true,null,now(),now());
  insert into public.inscripciones(nombre,telefono,cedula,referido,cartones,referencia4dig,comprobante,estado,monto_bs,pago_banco,pago_telefono,pago_cedula,usa_promo,promo_desc,precio_unitario_bs,origen_registro,slot_premio_draw_id,slot_premio_sesion_id,slot_premio_source_anchor)
  values(src.nombre,src.telefono,src.cedula,src.referido,array[n],'0000',null,'aprobado',0,src.pago_banco,src.pago_telefono,src.pago_cedula,false,'Premio del slot · 1 cartón gratis',0,'premio_slot',(entry->>'drawId')::uuid,s.id,s.source_anchor)
  returning id into registration_id;
  awards:=awards||jsonb_build_array(jsonb_build_object('drawId',entry->>'drawId','personId',entry->>'personId','name',src.nombre,'winningTicket',entry->>'winningTicket','assignedTicket',n::text,'registrationId',registration_id,'date',now()));
 end loop;
 if needed>0 then
  update public.slot_premios_sesiones set state=jsonb_set(s.state,'{awards}',awards),version=version+1,updated_at=now() where id=s.id;
 end if;
 return jsonb_build_object('pending','[]'::jsonb,'skipped',skipped,'awards',awards,'available',available-needed,'canAssign',false);
end $$;
revoke all on function public.slot_asignar_premios(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.slot_asignar_premios(uuid,uuid,jsonb,boolean) to service_role;

-- Preserve the existing public top endpoint and exclude only prize registrations.
create or replace function bingo_security.top_publico()
returns table(nombre text,cedula text,total bigint)
language sql stable security definer set search_path=''
as $$
 select (array_agg(i.nombre order by i.id desc))[1],'****'||right(i.cedula,4),sum(cardinality(i.cartones))::bigint
 from public.inscripciones i
 where i.estado='aprobado' and i.origen_registro<>'premio_slot'
 group by i.cedula order by 3 desc,2 limit 5;
$$;
create or replace function public.rpc_public_top_compradores(_limit integer default 10)
returns table(nombre text,cantidad_cartones integer)
language sql security definer set search_path=''
as $$
 select max(i.nombre),sum(coalesce(cardinality(i.cartones),0))::integer cantidad_cartones
 from public.inscripciones i
 where i.estado='aprobado' and coalesce(trim(i.cedula),'')<>'' and i.origen_registro<>'premio_slot'
 group by regexp_replace(i.cedula,'[^0-9]','','g')
 order by cantidad_cartones desc,max(i.nombre) asc
 limit least(greatest(coalesce(_limit,10),1),50);
$$;
commit;
