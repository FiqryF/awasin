-- REVIEW ONLY: do not apply to a remote project without owner approval.
-- A clean auth-only schema is expected. Name collisions intentionally fail.
begin;

create schema if not exists awasin_private;
revoke all on schema awasin_private from public, anon, authenticated;
grant usage on schema awasin_private to authenticated;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null default '' check (char_length(display_name) <= 100),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table public.user_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'user' check (role in ('user', 'admin'))
);
create table awasin_private.admin_bootstrap (
    singleton boolean primary key default true check (singleton),
    user_id uuid not null,
    provisioned_at timestamptz not null default now()
);
alter table awasin_private.admin_bootstrap enable row level security;
revoke all on awasin_private.admin_bootstrap from public, anon, authenticated;

-- Reject logged-out/deleted sessions even while a signed access token is unexpired.
create function awasin_private.active_session() returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from auth.sessions s join auth.users u on u.id = s.user_id
        where s.user_id = (select auth.uid())
          and s.id::text = (select auth.jwt()->>'session_id')
          and u.email_confirmed_at is not null and not u.is_anonymous
          and (u.banned_until is null or u.banned_until <= now())
          and (s.not_after is null or s.not_after > now())
    );
$$;
revoke all on function awasin_private.active_session() from public, anon;
grant execute on function awasin_private.active_session() to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;
revoke all on public.profiles, public.user_roles from public, anon, authenticated;
grant select on public.profiles, public.user_roles to authenticated;
grant update(display_name) on public.profiles to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated
    using (id = (select auth.uid()) and (select awasin_private.active_session()));
create policy profiles_update_self on public.profiles for update to authenticated
    using (id = (select auth.uid()) and (select awasin_private.active_session()))
    with check (id = (select auth.uid()) and (select awasin_private.active_session()));
create policy roles_read_self on public.user_roles for select to authenticated
    using (user_id = (select auth.uid()) and (select awasin_private.active_session()));
-- No admin-wide profile policy: admin identity does not grant access to private users.

create function awasin_private.provision_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.profiles(id, display_name)
    values (new.id, left(btrim(coalesce(new.raw_user_meta_data->>'display_name', '')), 100));
    insert into public.user_roles(user_id, role) values (new.id, 'user');
    return new;
end;
$$;
revoke all on function awasin_private.provision_identity() from public, anon, authenticated;
create trigger awasin_identity_created after insert on auth.users
    for each row execute function awasin_private.provision_identity();

create function awasin_private.touch_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
revoke all on function awasin_private.touch_profile() from public, anon, authenticated;
create trigger awasin_profile_updated before update on public.profiles
    for each row execute function awasin_private.touch_profile();

-- Backfill existing accounts without overwriting existing application data.
insert into public.profiles(id, display_name)
select id, left(btrim(coalesce(raw_user_meta_data->>'display_name', '')), 100) from auth.users;
insert into public.user_roles(user_id, role) select id, 'user' from auth.users;

-- Owner-only one-time bootstrap after invite acceptance AND TOTP enrollment.
create function awasin_private.bootstrap_first_admin(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
    perform pg_catalog.pg_advisory_xact_lock(971436);
    if exists (select 1 from awasin_private.admin_bootstrap)
       or exists (select 1 from public.user_roles where role = 'admin') then
        raise exception 'Initial administrator already provisioned';
    end if;
    if not exists (select 1 from auth.users where id = target and email_confirmed_at is not null)
       or not exists (select 1 from auth.mfa_factors where user_id = target and status = 'verified' and factor_type = 'totp') then
        raise exception 'Verified account and TOTP factor required';
    end if;
    update public.user_roles set role = 'admin' where user_id = target;
    if not found then raise exception 'Application identity missing'; end if;
    insert into awasin_private.admin_bootstrap(user_id) values (target);
end;
$$;
revoke all on function awasin_private.bootstrap_first_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function awasin_private.bootstrap_first_admin(uuid) to postgres;

commit;
