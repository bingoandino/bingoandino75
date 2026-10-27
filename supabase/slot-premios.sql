-- Isolated persistence for the slot app. Existing purchasing objects are untouched.
begin;
create table if not exists public.slot_premios_sesiones (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 source_anchor text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version integer not null default 0 check(version>=0),
 state jsonb not null check(jsonb_typeof(state->'participants')='array' and jsonb_typeof(state->'winners')='array')
);
alter table public.slot_premios_sesiones enable row level security;
revoke all on public.slot_premios_sesiones from public,anon,authenticated;
grant select,insert,update on public.slot_premios_sesiones to service_role;
create index if not exists slot_premios_owner_created on public.slot_premios_sesiones(owner_id,created_at desc);
commit;
