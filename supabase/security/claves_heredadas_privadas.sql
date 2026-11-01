-- Bingo Andino 75: retirar claves heredadas de las consultas públicas
-- manteniendo funciones existentes, apps independientes, bot y flujos de compras.
-- La función de validación conserva la clave almacenada y exige identidad admin.
create or replace function public.rpc_validar_clave_borrar_cartones(_clave text)
returns boolean language plpgsql security definer set search_path='' as $$
declare guardada text;
begin
  if public.es_admin_bingo() is not true then
    raise exception 'No autorizado' using errcode='42501';
  end if;
  if _clave is null or octet_length(_clave)>128 or btrim(_clave)='' then return false;end if;
  select valore into guardada from public.configuracion where clave='clave_borrar_cartones';
  if guardada is null or btrim(guardada)='' then raise exception 'Clave de borrado no configurada';end if;
  return btrim(_clave)=btrim(guardada);
end;
$$;
revoke all on function public.rpc_validar_clave_borrar_cartones(text) from public,anon,authenticated;
grant execute on function public.rpc_validar_clave_borrar_cartones(text) to authenticated;

-- Restrictiva: se aplica aunque existan políticas permisivas de lectura.
-- RLS de service_role sigue sin alterarse; no se borran ni cambian valores.
drop policy if exists configuracion_claves_heredadas_ocultas on public.configuracion;
create policy configuracion_claves_heredadas_ocultas on public.configuracion
 as restrictive for select to anon,authenticated
 using (clave not in ('clave_admin','clave_borrar_cartones','clave_reinicio'));
