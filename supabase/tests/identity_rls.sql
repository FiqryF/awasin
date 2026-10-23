-- Run ONLY on a disposable local Supabase database after the migration.
-- Requires owner/postgres. All fixtures and mutations are rolled back.
begin;
insert into auth.users(id, email, raw_user_meta_data, email_confirmed_at, is_anonymous)
values ('11111111-1111-4111-8111-111111111111', 'local-a@example.invalid', '{"role":"admin","display_name":"A"}', now(), false),
       ('22222222-2222-4222-8222-222222222222', 'local-b@example.invalid', '{"display_name":"B"}', now(), false);
insert into auth.sessions(id,user_id,created_at,updated_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',now(),now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","aal":"aal1"}',true);
do $$
declare rows_changed integer;
begin
    if (select count(*) from public.profiles) <> 1 then raise exception 'Own-only profile read failed'; end if;
    if (select role from public.user_roles) <> 'user' then raise exception 'Metadata privilege escalation'; end if;
    update public.profiles set display_name='Updated' where id='11111111-1111-4111-8111-111111111111';
    get diagnostics rows_changed = row_count;
    if rows_changed <> 1 then raise exception 'Own profile update denied'; end if;
    update public.profiles set display_name='Forbidden' where id='22222222-2222-4222-8222-222222222222';
    get diagnostics rows_changed = row_count;
    if rows_changed <> 0 then raise exception 'Cross-user write allowed'; end if;
    begin
        update public.user_roles set role='admin';
        raise exception 'Role update allowed';
    exception when insufficient_privilege then null; end;
    begin
        update public.profiles set id='33333333-3333-4333-8333-333333333333';
        raise exception 'Protected identifier update allowed';
    exception when insufficient_privilege then null; end;
    begin
        insert into public.profiles(id,display_name) values ('33333333-3333-4333-8333-333333333333','Forbidden');
        raise exception 'Profile insert allowed';
    exception when insufficient_privilege then null; end;
    begin
        insert into public.user_roles(user_id,role) values ('33333333-3333-4333-8333-333333333333','admin');
        raise exception 'Role insert allowed';
    exception when insufficient_privilege then null; end;
    begin
        perform awasin_private.bootstrap_first_admin('11111111-1111-4111-8111-111111111111');
        raise exception 'User bootstrap allowed';
    exception when insufficient_privilege then null; end;
end $$;

-- Stale/revoked session cannot read even its own profile.
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
do $$ begin
    if exists(select 1 from public.profiles) then raise exception 'Revoked session access'; end if;
end $$;
set local role anon;
do $$ begin
    begin
        perform * from public.profiles;
        raise exception 'Guest read allowed';
    exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Provisioning is atomic: a profile/role failure must abort user creation.
create function awasin_private.test_deny_role() returns trigger language plpgsql as $$
begin raise exception 'test provisioning failure'; end $$;
create trigger test_fail_role before insert on public.user_roles for each row execute function awasin_private.test_deny_role();
do $$ begin
    begin
        insert into auth.users(id,email) values ('33333333-3333-4333-8333-333333333333','local-c@example.invalid');
        raise exception 'Expected registration failure';
    exception when others then
        if sqlerrm <> 'test provisioning failure' then raise; end if;
    end;
    if exists(select 1 from auth.users where id='33333333-3333-4333-8333-333333333333')
       or exists(select 1 from public.profiles where id='33333333-3333-4333-8333-333333333333') then
        raise exception 'Partial identity survived provisioning failure';
    end if;
end $$;
rollback;
