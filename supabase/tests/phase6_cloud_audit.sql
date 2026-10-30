-- Read-only preflight and postflight. Does not expose credentials or private texts.
select 'admin_roles' as check_name,count(*)::text as evidence from public.user_roles where role='admin'
union all select 'bootstrap_records',count(*)::text from awasin_private.admin_bootstrap
union all select 'phase6_tables',coalesce(string_agg(tablename,', '),'absent') from pg_tables
 where schemaname='public' and tablename in ('feedback_handling','registry_organizations','registry_domains','education_articles','admin_audit_events')
union all select 'migration_ledger',coalesce(to_regclass('supabase_migrations.schema_migrations')::text,'absent');

-- Postflight only, after both reviewed migrations succeed:
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('feedback_handling','registry_organizations','registry_domains','education_articles','admin_audit_events');
select table_name,grantee,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in ('feedback_handling','registry_organizations','registry_domains','education_articles','admin_audit_events')
and grantee in ('anon','authenticated','PUBLIC') order by table_name,grantee,privilege_type;
select slug,status,version,md5(content::text) as content_hash from public.education_articles order by slug;
select action,count(*) from public.admin_audit_events group by action;
