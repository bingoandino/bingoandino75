begin;
create table public.slot_accesos(
 proof_hash text primary key check(proof_hash ~ '^[a-f0-9]{64}$'),
 owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 challenge_expires_at timestamptz not null,
 auth_session_id uuid,
 authorized_until timestamptz,
 check((auth_session_id is null)=(authorized_until is null))
);
alter table public.slot_accesos enable row level security;
revoke all on public.slot_accesos from public,anon,authenticated;
grant select,insert,update on public.slot_accesos to service_role;
commit;
