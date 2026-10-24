-- Review and apply after identity and scan-history migrations. No remote application is automatic.
begin;
alter table public.profiles
    add column history_retention text not null default 'manual' check (history_retention in ('manual','disabled')),
    add column animation text not null default 'system' check (animation in ('system','reduced'));
grant update(history_retention, animation) on public.profiles to authenticated;

-- A privacy setting never grants permission to save automatically. Every save
-- still requires explicit per-report consent and real completed provenance.
create or replace function public.save_scan_report(p_report_id uuid, p_consent boolean)
returns setof public.scan_reports language plpgsql security definer set search_path = '' as $$
begin
    if p_consent is distinct from true or not awasin_private.active_session() then return; end if;
    return query update public.scan_reports
        set saved_at = coalesce(saved_at, now())
        where id = p_report_id and owner_id = (select auth.uid())
          and status = 'completed' and engine is not null
          and engine_version is not null and analyzed_at is not null
          and exists(select 1 from public.profiles p where p.id = auth.uid() and p.history_retention = 'manual')
        returning *;
end;
$$;
revoke all on function public.save_scan_report(uuid, boolean) from public, anon;
grant execute on function public.save_scan_report(uuid, boolean) to authenticated;
commit;
