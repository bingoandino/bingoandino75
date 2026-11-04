-- ANDY Marketing: telemetría mínima, separada de compras y pagos.
-- Esta migración se revisa antes de aplicarse a producción.
create table if not exists public.marketing_visitas (
  id bigint generated always as identity primary key,
  sesion_id uuid not null,
  fecha_ve date not null default (now() at time zone 'America/Caracas')::date,
  tipo text not null check (tipo in ('visita','click_comprar','click_whatsapp')),
  origen text not null check (origen in ('instagram','facebook','whatsapp','google','directo','otro','desconocido')),
  campania text check (campania is null or (length(campania) between 1 and 80 and campania ~ '^[a-zA-Z0-9_. -]+$')),
  creado_en timestamptz not null default now(),
  constraint marketing_visitas_sesion_dia_tipo unique (sesion_id,fecha_ve,tipo)
);
create index if not exists marketing_visitas_fecha_tipo on public.marketing_visitas(fecha_ve desc,tipo,origen);
alter table public.marketing_visitas enable row level security;
-- Ningún visitante, comprador ni usuario autenticado puede leer o escribir eventos por la Data API.
revoke all on table public.marketing_visitas from public, anon, authenticated;
grant select, insert, delete on table public.marketing_visitas to service_role;
revoke all on sequence public.marketing_visitas_id_seq from public, anon, authenticated;
grant usage, select on sequence public.marketing_visitas_id_seq to service_role;
-- No se crean políticas RLS para anon/authenticated. Solo Edge Function con clave server-side.
-- Retención operativa propuesta: eliminar eventos de más de 90 días con tarea programada.
-- No activar la tarea sin revisar impacto y horario en la instancia de producción.
