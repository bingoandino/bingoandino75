-- Isolated Instagram application; no changes to bingo registrations or payments.
create schema privado_sorteos_instagram;
revoke all on schema privado_sorteos_instagram from public,anon,authenticated;
grant usage on schema privado_sorteos_instagram to service_role;
create table privado_sorteos_instagram.config (
 id integer primary key check(id=1), owner_id uuid not null,
 password_hash text not null, salt text not null, revision integer not null default 1,
 instagram_secret_id uuid not null, pepper_secret_id uuid not null,
 created_at timestamptz not null default now()
);
create table privado_sorteos_instagram.sessions (
 token_hash text primary key, revision integer not null, expires_at bigint not null
);
create table privado_sorteos_instagram.limits (
 bucket text primary key, attempts integer not null, window_start bigint not null
);
create table privado_sorteos_instagram.migration_ticket (
 id integer primary key check(id=1), token_hash text not null, expires_at timestamptz not null, used_at timestamptz
);
alter table privado_sorteos_instagram.config enable row level security;
alter table privado_sorteos_instagram.sessions enable row level security;
alter table privado_sorteos_instagram.limits enable row level security;
alter table privado_sorteos_instagram.migration_ticket enable row level security;
revoke all on all tables in schema privado_sorteos_instagram from public,anon,authenticated;
grant select,insert,update,delete on all tables in schema privado_sorteos_instagram to service_role;
-- Narrow privileged bridge: only application-owned secret IDs are readable.
create function privado_sorteos_instagram.backend(action text,payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c privado_sorteos_instagram.config%rowtype; t privado_sorteos_instagram.migration_ticket%rowtype;
 now_ms bigint := floor(extract(epoch from clock_timestamp())*1000); cutoff bigint;
 count_ip integer; count_all integer; ig uuid; pepper uuid; result jsonb;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Service role required';end if;
 if action='status' then return jsonb_build_object('configured',exists(select 1 from privado_sorteos_instagram.config)); end if;
 if action='import' then
  select * into t from privado_sorteos_instagram.migration_ticket where id=1 for update;
  if t.token_hash is null or t.token_hash <> payload->>'ticket_hash' or t.used_at is not null or t.expires_at<now() or exists(select 1 from privado_sorteos_instagram.config) then raise exception 'Migration unavailable'; end if;
  if length(payload->>'instagram_token')<50 or length(payload->>'pepper')<32 or (payload->>'password_hash') !~ '^[a-f0-9]{64}$' or length(payload->>'salt')<16 then raise exception 'Invalid settings';end if;
  ig:=vault.create_secret(payload->>'instagram_token','instagram_sorteos_token','Instagram connection for isolated giveaway app');
  pepper:=vault.create_secret(payload->>'pepper','instagram_sorteos_pepper','Password hashing pepper for isolated giveaway app');
  insert into privado_sorteos_instagram.config(id,owner_id,password_hash,salt,instagram_secret_id,pepper_secret_id) values(1,'5121c2ba-c8f1-40f8-8b3e-130a75f60ac5',payload->>'password_hash',payload->>'salt',ig,pepper);
  update privado_sorteos_instagram.migration_ticket set used_at=now() where id=1;
  return '{"ok":true}'::jsonb;
 end if;
 select * into c from privado_sorteos_instagram.config where id=1;
 if c.id is null then raise exception 'Not configured';end if;
 if action='config' then
  return jsonb_build_object('owner_id',c.owner_id,'password_hash',c.password_hash,'salt',c.salt,'revision',c.revision,
  'instagram_token',(select decrypted_secret from vault.decrypted_secrets where id=c.instagram_secret_id),
  'pepper',(select decrypted_secret from vault.decrypted_secrets where id=c.pepper_secret_id));
 elsif action='rate' then
  cutoff:=now_ms-900000;
  insert into privado_sorteos_instagram.limits as l(bucket,attempts,window_start) values(payload->>'bucket',1,now_ms)
  on conflict(bucket) do update set attempts=case when l.window_start<=cutoff then 1 else l.attempts+1 end,window_start=case when l.window_start<=cutoff then now_ms else l.window_start end returning attempts into count_ip;
  insert into privado_sorteos_instagram.limits as l(bucket,attempts,window_start) values('global',1,now_ms)
  on conflict(bucket) do update set attempts=case when l.window_start<=cutoff then 1 else l.attempts+1 end,window_start=case when l.window_start<=cutoff then now_ms else l.window_start end returning attempts into count_all;
  delete from privado_sorteos_instagram.limits where window_start<now_ms-3600000;
  delete from privado_sorteos_instagram.sessions where expires_at<=now_ms;
  return jsonb_build_object('allowed',count_ip<=10 and count_all<=300);
 elsif action='session_create' then
  insert into privado_sorteos_instagram.sessions(token_hash,revision,expires_at) select payload->>'token_hash',c.revision,now_ms+43200000 where c.revision=(payload->>'revision')::integer;
  return jsonb_build_object('ok',found);
 elsif action='session_check' then
  return jsonb_build_object('valid',exists(select 1 from privado_sorteos_instagram.sessions s where s.token_hash=payload->>'token_hash' and s.expires_at>now_ms and s.revision=c.revision));
 elsif action='logout' then
  delete from privado_sorteos_instagram.sessions where token_hash=payload->>'token_hash';return '{"ok":true}'::jsonb;
 elsif action='password' then
  if payload->>'owner_id'<>c.owner_id::text or (payload->>'password_hash') !~ '^[a-f0-9]{64}$' or length(payload->>'salt')<16 then raise exception 'Forbidden';end if;
  update privado_sorteos_instagram.config set password_hash=payload->>'password_hash',salt=payload->>'salt',revision=revision+1 where id=1;
  delete from privado_sorteos_instagram.sessions; return '{"ok":true}'::jsonb;
 end if;
 raise exception 'Unknown action';
end $$;
revoke all on function privado_sorteos_instagram.backend(text,jsonb) from public,anon,authenticated;
grant execute on function privado_sorteos_instagram.backend(text,jsonb) to service_role;

create function public.instagram_sorteos_backend(action text,payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $fn$ select privado_sorteos_instagram.backend(action,payload); $fn$;
revoke all on function public.instagram_sorteos_backend(text,jsonb) from public,anon,authenticated;
grant execute on function public.instagram_sorteos_backend(text,jsonb) to service_role;
