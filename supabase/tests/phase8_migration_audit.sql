-- Read-only checkpoints for 001–007. Run on the intended project as its owner.
-- These checks locate missing effects. They do not establish full schema parity.
select
    coalesce(to_regclass('supabase_migrations.schema_migrations')::text, 'absent') as ledger,
    (
        to_regclass('public.profiles') is not null
        and to_regclass('public.user_roles') is not null
        and to_regprocedure('awasin_private.active_session()') is not null
        and exists (
            select from pg_trigger
            where tgrelid = to_regclass('auth.users') and tgname = 'awasin_identity_created'
              and tgenabled in ('O', 'A')
        )
    ) as m001_identity,
    (
        to_regclass('public.scan_reports') is not null
        and to_regprocedure('public.save_scan_report(uuid,boolean)') is not null
        and to_regprocedure('public.clear_scan_history(boolean)') is not null
    ) as m002_history,
    (
        (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name in ('history_retention', 'animation')) = 2
        and coalesce(pg_get_functiondef(to_regprocedure('public.save_scan_report(uuid,boolean)'))
                     like '%history_retention%', false)
    ) as m003_preferences,
    (
        to_regclass('public.feedback_submissions') is not null
        and to_regprocedure('public.submit_feedback(uuid,text,jsonb,text,uuid,boolean)') is not null
    ) as m004_feedback,
    (
        to_regclass('public.admin_audit_events') is not null
        and to_regclass('public.education_articles') is not null
        and to_regprocedure('public.admin_mutate(text,uuid,jsonb,integer)') is not null
        and to_regprocedure('awasin_private.is_admin()') is not null
    ) as m005_admin,
    (
        select count(distinct entity_id) = 4 from public.admin_audit_events
        where action = 'education.seed' and entity_type = 'education_articles'
    ) as m006_education_seed,
    (
        exists (
            select from storage.buckets where id = 'account-avatars' and not public
              and file_size_limit = 2097152 and allowed_mime_types = array['image/jpeg']
        )
        and (select count(*) from pg_policies
             where schemaname = 'storage' and tablename = 'objects'
               and policyname in ('Read own account avatar', 'Insert own account avatar',
                                  'Update own account avatar', 'Delete own account avatar')) = 4
    ) as m007_avatar;
