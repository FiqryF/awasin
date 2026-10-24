-- Additive migration; review and apply separately to the intended Supabase project.
-- No engine is introduced here. Browsers cannot insert or edit analysis results.
begin;

create table public.scan_reports (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    mode text not null check (mode in ('link','message','website','qr','image','video')),
    created_at timestamptz not null default now(),
    saved_at timestamptz,
    status text not null check (status in ('pending','processing','completed','failed','unsupported')),
    safe_label text not null check (char_length(safe_label) between 1 and 160),
    engine text check (char_length(engine) between 1 and 120),
    engine_version text check (char_length(engine_version) between 1 and 80),
    analyzed_at timestamptz,
    result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 65536),
    constraint completed_provenance check (status <> 'completed' or (engine is not null and engine_version is not null and analyzed_at is not null)),
    constraint saved_only_completed check (saved_at is null or status = 'completed'),
    constraint assessment_only_completed check ((result->>'risk') is null or (status = 'completed' and result->>'risk' in ('low','medium','high','inconclusive')))
);
comment on table public.scan_reports is 'Safe structured engine results only. No raw URLs, query tokens, messages, filenames or media binaries. Trusted engine ingestion is not implemented in Phase 2; never seed production reports.';
create index scan_reports_owner_saved_date on public.scan_reports(owner_id, created_at desc, id desc) where saved_at is not null;
create index scan_reports_owner_mode_date on public.scan_reports(owner_id, mode, created_at desc, id desc) where saved_at is not null;

alter table public.scan_reports enable row level security;
alter table public.scan_reports force row level security;
revoke all on public.scan_reports from public, anon, authenticated;
grant select, delete on public.scan_reports to authenticated;
create policy scan_reports_read_self on public.scan_reports for select to authenticated
    using (owner_id = (select auth.uid()) and (select awasin_private.active_session()));
create policy scan_reports_delete_saved_self on public.scan_reports for delete to authenticated
    using (owner_id = (select auth.uid()) and saved_at is not null and (select awasin_private.active_session()));
-- No authenticated INSERT/UPDATE grants or policies. A verified role never
-- allows a browser to manufacture a completed report or alter its evidence.

create function public.save_scan_report(p_report_id uuid, p_consent boolean)
returns setof public.scan_reports language plpgsql security definer set search_path = '' as $$
begin
    if p_consent is distinct from true or not awasin_private.active_session() then
        return;
    end if;
    return query update public.scan_reports
        set saved_at = coalesce(saved_at, now())
        where id = p_report_id and owner_id = (select auth.uid())
          and status = 'completed' and engine is not null
          and engine_version is not null and analyzed_at is not null
        returning *;
end;
$$;
revoke all on function public.save_scan_report(uuid, boolean) from public, anon;
grant execute on function public.save_scan_report(uuid, boolean) to authenticated;

create function public.clear_scan_history(p_confirm boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare deleted_count bigint;
begin
    if p_confirm is distinct from true or not awasin_private.active_session() then
        return 0;
    end if;
    delete from public.scan_reports where owner_id = (select auth.uid()) and saved_at is not null;
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;
revoke all on function public.clear_scan_history(boolean) from public, anon;
grant execute on function public.clear_scan_history(boolean) to authenticated;

commit;
