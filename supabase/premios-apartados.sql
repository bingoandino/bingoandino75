alter table public.cartones add column if not exists premio_apartado text check(premio_apartado in ('ruleta','dinamicas'));
create index if not exists cartones_premio_apartado_idx on public.cartones(premio_apartado) where premio_apartado is not null;
create or replace function bingo_security.estado_apartados_premios() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('ruleta',(select count(*) from public.cartones where premio_apartado='ruleta'),'dinamicas',(select count(*) from public.cartones where premio_apartado='dinamicas'),
'disponibles',(select count(*) from generate_series(1,public.fn_total_cartones_actual()) n where not exists(select 1 from public.cartones c where c.numero=n) and not exists(select 1 from public.inscripciones i where n::bigint=any(i.cartones) and i.estado in ('pendiente','aprobado'))),
'version',md5(coalesce((select string_agg(numero::text||':'||premio_apartado,',' order by numero) from public.cartones where premio_apartado is not null),'')||'|'||public.fn_total_cartones_actual()::text||'|'||coalesce((select min(id)::text from public.inscripciones),'vacio')||'|'||coalesce((select id::text from bingo_security.snapshots order by created_at desc,id desc limit 1),'inicial')));
$$;
revoke all on function bingo_security.estado_apartados_premios() from public,anon,authenticated;
grant execute on function bingo_security.estado_apartados_premios() to service_role;
create or replace function bingo_security.ajustar_apartados_premios(_ruleta int,_dinamicas int,_version text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare st jsonb; tipo text; objetivo int; actual int; faltan int; nums bigint[];
begin
 if _ruleta is null or _dinamicas is null or _ruleta not between 0 and 10000 or _dinamicas not between 0 and 10000 then raise exception 'Revisa las cantidades';end if;
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 lock table public.inscripciones,public.cartones in exclusive mode;
 st:=bingo_security.estado_apartados_premios();
 if _version is distinct from st->>'version' then raise exception 'Los apartados o el sorteo cambiaron. Pulsa Actualizar';end if;
 if exists(select 1 from public.cartones c join public.inscripciones i on c.numero=any(i.cartones) where c.premio_apartado is not null and i.estado in ('pendiente','aprobado')) then raise exception 'Un apartado tiene inscripción. Revisa antes de continuar';end if;
 foreach tipo in array array['ruleta','dinamicas'] loop
 objetivo:=case tipo when 'ruleta' then _ruleta else _dinamicas end;
 select count(*) into actual from public.cartones where premio_apartado=tipo;
 if actual>objetivo then delete from public.cartones where numero in (select numero from public.cartones where premio_apartado=tipo order by numero desc limit actual-objetivo);end if;
 end loop;
 foreach tipo in array array['ruleta','dinamicas'] loop
 objetivo:=case tipo when 'ruleta' then _ruleta else _dinamicas end;
 select count(*) into actual from public.cartones where premio_apartado=tipo;
 faltan:=objetivo-actual;
 if faltan>0 then
 select array_agg(q.n) into nums from (select x.n::bigint n from generate_series(1,public.fn_total_cartones_actual()) x(n) where not exists(select 1 from public.cartones c where c.numero=x.n) and not exists(select 1 from public.inscripciones i where x.n::bigint=any(i.cartones) and i.estado in ('pendiente','aprobado')) order by random() limit faltan) q;
 if coalesce(cardinality(nums),0)<>faltan then raise exception 'No hay suficientes cartones disponibles. No se cambió ningún apartado';end if;
 insert into public.cartones(numero,cedula,ocupado,partida_id,created_at,reserved_at,premio_apartado) select unnest(nums),'premio:'||tipo,true,null,now(),now(),tipo;
 end if;
 end loop;
 return bingo_security.estado_apartados_premios();
end $$;
revoke all on function bingo_security.ajustar_apartados_premios(int,int,text) from public,anon,authenticated;
grant execute on function bingo_security.ajustar_apartados_premios(int,int,text) to service_role;
create or replace function public.rpc_apartados_premios(_session_token text,_device_id text,_ruleta int default null,_dinamicas int default null,_version text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is distinct from '5121c2ba-c8f1-40f8-8b3e-130a75f60ac5'::uuid or not exists(select 1 from public.sesiones_activas s where s.session_token=_session_token and s.device_id=_device_id and s.activa is true and s.tipo='admin' and s.autenticacion_tipo='otp' and s.expires_at>now() and lower(s.user_email)=lower(auth.jwt()->>'email')) then raise exception 'Tu sesión de administrador venció. Vuelve a entrar.' using errcode='42501';end if;
 if _ruleta is null and _dinamicas is null and _version is null then return bingo_security.estado_apartados_premios();end if;
 return bingo_security.ajustar_apartados_premios(_ruleta,_dinamicas,_version);
end $$;
revoke all on function public.rpc_apartados_premios(text,text,int,int,text) from public,anon;
grant execute on function public.rpc_apartados_premios(text,text,int,int,text) to authenticated;

CREATE OR REPLACE FUNCTION public.rpc_liberar_cartones_huerfanos(_min_age interval DEFAULT '00:05:00'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_liberados integer := 0;
  v_min_age interval;
begin
  -- Seguridad: aunque alguien mande 1 segundo, mínimo siempre serán 5 minutos
  v_min_age := coalesce(_min_age, interval '5 minutes');

  if v_min_age < interval '5 minutes' then
    v_min_age := interval '5 minutes';
  end if;

  delete from public.cartones c
  where c.premio_apartado is null and coalesce(c.reserved_at, c.created_at) < now() - v_min_age
    and not exists (
      select 1
      from public.inscripciones i
      where c.numero = any(i.cartones)
        and i.estado in ('pendiente', 'aprobado')
    );

  get diagnostics v_liberados = row_count;

  return v_liberados;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.slot_asignar_premios(_session_id uuid, _owner_id uuid, _sources jsonb, _confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 select array_agg(q.n) into nums from (select c.numero n from public.cartones c where c.premio_apartado='ruleta' and c.numero between 1 and total and not exists(select 1 from public.inscripciones r where c.numero=any(r.cartones) and r.estado in ('pendiente','aprobado')) order by random()) q;
 available:=coalesce(cardinality(nums),0);
 if not _confirm then
  return jsonb_build_object('pending',pending,'skipped',skipped,'awards',awards,'available',available,'canAssign',needed>0 and available>=needed);
 end if;
 if available<needed then raise exception 'No hay suficientes cartones apartados para ruleta. Aparta más desde el administrador';end if;
 for entry in select value from jsonb_array_elements(pending) loop
  select * into strict src from public.inscripciones where id=(entry->>'sourceId')::bigint;
  n:=nums[i];i:=i+1;
  update public.cartones set cedula=src.cedula,premio_apartado=null,reserved_at=now() where numero=n and premio_apartado='ruleta';
  if not found then raise exception 'Actualiza la vista previa: el apartado cambió';end if;
  insert into public.inscripciones(nombre,telefono,cedula,referido,cartones,referencia4dig,comprobante,estado,monto_bs,pago_banco,pago_telefono,pago_cedula,usa_promo,promo_desc,precio_unitario_bs,origen_registro,slot_premio_draw_id,slot_premio_sesion_id,slot_premio_source_anchor)
  values(src.nombre,src.telefono,src.cedula,src.referido,array[n],'0000',null,'aprobado',0,src.pago_banco,src.pago_telefono,src.pago_cedula,false,'Premio del slot · 1 cartón gratis',0,'premio_slot',(entry->>'drawId')::uuid,s.id,s.source_anchor)
  returning id into registration_id;
  awards:=awards||jsonb_build_array(jsonb_build_object('drawId',entry->>'drawId','personId',entry->>'personId','name',src.nombre,'winningTicket',entry->>'winningTicket','assignedTicket',n::text,'registrationId',registration_id,'date',now()));
 end loop;
 if needed>0 then
  update public.slot_premios_sesiones set state=jsonb_set(s.state,'{awards}',awards),version=version+1,updated_at=now() where id=s.id;
 end if;
 return jsonb_build_object('pending','[]'::jsonb,'skipped',skipped,'awards',awards,'available',available-needed,'canAssign',false);
end $function$
;

CREATE OR REPLACE FUNCTION public.dinamicas_entregar_carton(_id uuid, _owner uuid, _nombre text, _cedula text, _telefono text, _banco text, _anchor text, _confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare hoy date:=(now() at time zone 'America/Caracas')::date; inicio date; anterior public.dinamicas_ganadores%rowtype; total int; n bigint; registro bigint; actual text; abierto boolean; recibo jsonb;
begin
 if auth.role() is distinct from 'service_role' or _owner is distinct from '5121c2ba-c8f1-40f8-8b3e-130a75f60ac5'::uuid then raise exception 'No autorizado' using errcode='42501';end if;
 if _id is null or _confirm is null or _nombre is null or length(btrim(_nombre)) not between 2 and 160 or _nombre ~ '[[:cntrl:]<>]' or _cedula is null or _cedula !~ '^[1-9][0-9]{4,11}$' or _telefono is null or _telefono !~ '^0(412|414|416|424|426)[0-9]{7}$' or _banco is null or _banco !~ '^[0-9]{4}$' then raise exception 'Revisa nombre, cédula, teléfono y banco';end if;
 -- Compatible con el orden de los locks de compras y del slot. El lock de tablas protege también frente al reinicio.
 perform pg_advisory_xact_lock(hashtextextended('bingo_reservar_cartones',0));
 lock table public.inscripciones,public.cartones in exclusive mode;
 select * into anterior from public.dinamicas_ganadores where id=_id;
 if found then
  if anterior.owner_id is distinct from _owner or anterior.nombre is distinct from btrim(_nombre) or anterior.cedula is distinct from _cedula or anterior.telefono is distinct from _telefono or anterior.banco is distinct from _banco then raise exception 'La solicitud ya se utilizó con otros datos';end if;
  return jsonb_build_object('awarded',true,'winner',to_jsonb(anterior),'replayed',true);
 end if;
 inicio:=date_trunc('week',hoy::timestamp)::date;
 if exists(select 1 from public.dinamicas_ganadores where semana=inicio and cedula=_cedula) then raise exception 'Esta cédula ya ganó esta semana. Solo puede ganar una vez por semana';end if;
 select coalesce(valor,false) into abierto from public.configuracion where clave='ventas_abierta' for share;
 if abierto is distinct from true then raise exception 'Abre las ventas del sorteo actual antes de entregar cartones';end if;
 select coalesce(min(id)::text,'vacio') into actual from public.inscripciones;
 if _anchor is distinct from actual then raise exception 'El sorteo cambió. Actualiza el panel y revisa la entrega nuevamente';end if;
 total:=public.fn_total_cartones_actual();
 if total not between 1 and 10000 then raise exception 'Total de cartones no configurado';end if;
 select c.numero into n from public.cartones c where c.premio_apartado='dinamicas' and c.numero between 1 and total and not exists(select 1 from public.inscripciones r where c.numero=any(r.cartones) and r.estado in ('pendiente','aprobado')) order by random() limit 1;
 if n is null then raise exception 'No hay cartones disponibles en el apartado de dinámicas. Aparta más desde el administrador';end if;
 if not _confirm then return jsonb_build_object('awarded',false,'canAssign',true,'name',btrim(_nombre),'cedula',_cedula,'phone',_telefono,'bank',_banco,'anchor',actual);end if;
 update public.cartones set cedula=_cedula,premio_apartado=null,reserved_at=now() where numero=n and premio_apartado='dinamicas';
 if not found then raise exception 'No hay cartones disponibles en el apartado de dinámicas';end if;
 insert into public.inscripciones(nombre,telefono,cedula,cartones,referencia4dig,comprobante,estado,monto_bs,pago_banco,pago_telefono,pago_cedula,usa_promo,promo_desc,precio_unitario_bs,origen_registro)
 values(btrim(_nombre),_telefono,_cedula,array[n],'0000',null,'aprobado',0,_banco,_telefono,_cedula,false,'Premio de dinámica · 1 cartón gratis',0,'premio_dinamica') returning id into registro;
 insert into public.dinamicas_ganadores(id,owner_id,nombre,cedula,telefono,banco,dia,semana,carton,registration_id,source_anchor)
 values(_id,_owner,btrim(_nombre),_cedula,_telefono,_banco,hoy,inicio,n,registro,actual) returning to_jsonb(dinamicas_ganadores.*) into recibo;
 return jsonb_build_object('awarded',true,'winner',recibo,'replayed',false);
end $function$
;

CREATE OR REPLACE FUNCTION public.dinamicas_panel()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  hoy date := (now() at time zone 'America/Caracas')::date;
  inicio date;
  total int;
  disponibles int;
  abierto boolean;
  anchor text;
  ganadores jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'No autorizado' using errcode='42501';
  end if;
  inicio := date_trunc('week', hoy::timestamp)::date;
  total := public.fn_total_cartones_actual();
  select coalesce(valor,false) into abierto
    from public.configuracion where clave='ventas_abierta';
  select coalesce(min(id)::text,'vacio') into anchor from public.inscripciones;
  select count(*)::int into disponibles from public.cartones c where c.premio_apartado='dinamicas' and c.numero between 1 and total and not exists(select 1 from public.inscripciones r where c.numero=any(r.cartones) and r.estado in ('pendiente','aprobado'));
  -- Solo lectura: identificar cada clase de premio publicado para el
  -- mismo cartón y fecha de entrega del cartón gratis.
  with premios_individuales as (
    select r.fecha,
           (w.value->>'carton')::bigint as carton,
           g.value->>'tipo' as tipo,
           coalesce((g.value->>'orden')::integer,0) as orden,
           sum((w.value->>'premio_centimos')::bigint) as premio_centimos
      from public.resultados_publicados r
      cross join lateral jsonb_array_elements(r.resultado->'grupos') g(value)
      cross join lateral jsonb_array_elements(g.value->'ganadores') w(value)
     where r.fecha between inicio and inicio+6
       and g.value->>'tipo' in ('ronda','final','consolacion','pozo','aproximacion')
     group by r.fecha,(w.value->>'carton')::bigint,
              g.value->>'tipo',coalesce((g.value->>'orden')::integer,0)
  ), premios as (
    select fecha,carton,
           sum(premio_centimos) as premio_centimos,
           jsonb_agg(
             jsonb_build_object(
               'tipo',tipo,'orden',orden,'premio_centimos',premio_centimos
             )
             order by case tipo
                when 'ronda' then 1 when 'final' then 2
                when 'consolacion' then 3 when 'pozo' then 4
                when 'aproximacion' then 5 else 6 end,
                orden
           ) as premios_detalle
      from premios_individuales
     group by fecha,carton
  )
  select coalesce(
    jsonb_agg(to_jsonb(d) || jsonb_build_object(
       'premio_centimos',coalesce(p.premio_centimos,0),
       'premios_detalle',coalesce(p.premios_detalle,'[]'::jsonb)
    ) order by d.fecha desc),
    '[]'::jsonb
  ) into ganadores
    from public.dinamicas_ganadores d
    left join premios p on p.fecha=d.dia and p.carton=d.carton
   where d.semana=inicio;
  return jsonb_build_object(
    'today',hoy,'weekStart',inicio,'weekEnd',inicio+6,
    'winners',ganadores,'available',disponibles,'total',total,
    'salesOpen',coalesce(abierto,false),'anchor',anchor
  );
end
$function$
;
