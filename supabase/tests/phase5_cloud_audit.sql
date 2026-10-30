-- Phase 5: read-only catalog audit. No migration or application-data writes.
-- Run in the intended project's SQL Editor as the database owner.
-- Statement 2 assumes identity tables already exist; inspect statement 1 first.
-- No passwords, tokens, email addresses, or individual account IDs are selected.

select 'tables' as check_name,
    coalesce(string_agg(n.nspname || '.' || c.relname ||
        ' [rls=' || c.relrowsecurity || ', force=' || c.relforcerowsecurity || ']',
        '; ' order by c.relname), 'none') as evidence
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'awasin_private', 'supabase_migrations') and c.relkind = 'r'
union all
select 'profile_columns', string_agg(column_name, ', ' order by ordinal_position)
from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
union all
select 'functions', string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'awasin_private' or (n.nspname = 'public' and
    p.proname in ('save_scan_report', 'clear_scan_history', 'submit_feedback'))
union all
select 'policies', string_agg(tablename || ':' || policyname || ':' || cmd || ':' || qual, '; ')
from pg_policies where schemaname = 'public'
    and tablename in ('profiles', 'user_roles', 'scan_reports', 'feedback_submissions')
union all
select 'triggers', string_agg(event_object_schema || '.' || event_object_table || ':' || trigger_name, '; ')
from information_schema.triggers where trigger_name like 'awasin_%'
union all
select 'migration_tracking', coalesce(to_regclass('supabase_migrations.schema_migrations')::text, 'absent');

select 'active_session' as check_name, pg_get_functiondef(p.oid) as evidence
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'awasin_private' and p.proname = 'active_session'
union all
select 'table_grants', coalesce(string_agg(grantee || ':' || table_name || ':' || privilege_type,
    '; ' order by grantee, table_name, privilege_type), 'none')
from information_schema.table_privileges where table_schema = 'public'
    and table_name in ('profiles', 'user_roles') and grantee in ('anon', 'authenticated', 'PUBLIC')
union all
select 'column_updates', coalesce(string_agg(grantee || ':' || table_name || '.' || column_name, '; '), 'none')
from information_schema.column_privileges where table_schema = 'public'
    and table_name in ('profiles', 'user_roles') and grantee in ('anon', 'authenticated', 'PUBLIC')
    and privilege_type = 'UPDATE'
union all
select 'foreign_keys', string_agg(c.relname || ':' || pg_get_constraintdef(k.oid), '; ')
from pg_constraint k join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'user_roles') and k.contype = 'f'
union all
select 'active_session_acl', p.proacl::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'awasin_private' and p.proname = 'active_session'
union all
select 'identity_counts', 'users=' || (select count(*) from auth.users)
    || ',profiles=' || (select count(*) from public.profiles)
    || ',roles=' || (select count(*) from public.user_roles)
union all
select 'policy_with_check', coalesce(string_agg(policyname || ':' || with_check, '; '), 'none')
from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE';

-- Recovery metadata only: not a full backup and not executable restoration DDL.
-- No rows from Auth, profiles, roles, sessions or bootstrap are exported here.
select 'function_definitions' as check_name,
    string_agg(pg_get_functiondef(p.oid), E'\n' order by p.proname) as evidence
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'awasin_private' or (n.nspname = 'public' and
    p.proname in ('save_scan_report', 'clear_scan_history', 'submit_feedback'))
union all
select 'constraints', string_agg(n.nspname || '.' || c.relname || ':' || k.conname
    || ':' || pg_get_constraintdef(k.oid), E'\n' order by n.nspname, c.relname, k.conname)
from pg_constraint k join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in
    ('profiles', 'user_roles', 'scan_reports', 'feedback_submissions'))
    or n.nspname = 'awasin_private'
union all
select 'indexes', string_agg(indexdef, E'\n' order by schemaname, tablename, indexname)
from pg_indexes where (schemaname = 'public' and tablename in
    ('profiles', 'user_roles', 'scan_reports', 'feedback_submissions'))
    or schemaname = 'awasin_private'
union all
select 'function_acls', string_agg(n.nspname || '.' || p.proname || ':'
    || coalesce(p.proacl::text, 'DEFAULT'), E'\n' order by n.nspname, p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'awasin_private' or (n.nspname = 'public' and
    p.proname in ('save_scan_report', 'clear_scan_history', 'submit_feedback'))
union all
select 'trigger_definitions', string_agg(pg_get_triggerdef(t.oid), E'\n' order by t.tgname)
from pg_trigger t where not t.tgisinternal and t.tgname like 'awasin_%'
union all
select 'private_schema_acl', coalesce(n.nspacl::text, 'DEFAULT')
from pg_namespace n where n.nspname = 'awasin_private';
