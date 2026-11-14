begin;

create table public.service_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(btrim(message)) between 1 and 240),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index service_announcements_schedule on public.service_announcements (starts_at desc, ends_at) where enabled;
alter table public.service_announcements enable row level security;
alter table public.service_announcements force row level security;
revoke all on public.service_announcements from public, anon, authenticated;
grant select on public.service_announcements to anon, authenticated;
grant insert(message, starts_at, ends_at), update(enabled) on public.service_announcements to authenticated;
create policy service_announcements_active on public.service_announcements for select to anon, authenticated
  using (enabled and starts_at <= now() and ends_at > now());
create policy service_announcements_admin_read on public.service_announcements for select to authenticated
  using ((select awasin_private.is_admin()));
create policy service_announcements_admin_insert on public.service_announcements for insert to authenticated
  with check ((select awasin_private.is_admin()));
create policy service_announcements_admin_update on public.service_announcements for update to authenticated
  using ((select awasin_private.is_admin())) with check ((select awasin_private.is_admin()));
create trigger service_announcements_audit after insert or update on public.service_announcements
  for each row execute function awasin_private.audit_admin_change();

create function public.admin_detection_quality(p_since timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not awasin_private.is_admin() then raise insufficient_privilege; end if;
  return (
    select jsonb_build_object(
      'too_safe', count(*) filter (where f.fields->>'errorType' = 'Konten berisiko dinilai aman'),
      'too_risky', count(*) filter (where f.fields->>'errorType' = 'Konten aman dinilai berisiko'),
      'unreviewed', count(*) filter (where coalesce(h.status, 'new') = 'new')
    )
    from public.feedback_submissions f
    left join public.feedback_handling h on h.feedback_id = f.id
    where f.category = 'detection' and f.created_at >= p_since
  );
end;
$$;
revoke all on function public.admin_detection_quality(timestamptz) from public, anon;
grant execute on function public.admin_detection_quality(timestamptz) to authenticated;

create or replace function public.admin_feedback_page(p_offset integer default 0,p_limit integer default 20,p_category text default '',p_status text default '',p_search text default '',p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare records jsonb; total bigint;
begin
 if not awasin_private.is_admin() then raise insufficient_privilege; end if;
 if p_offset not between 0 and 100000 or p_limit not between 1 and 50 or char_length(p_search)>80 then raise invalid_parameter_value; end if;
 select count(*) into total from public.feedback_submissions f left join public.feedback_handling h on h.feedback_id=f.id
 where (p_category='' or f.category=p_category) and (p_status='' or coalesce(h.status,'new')=p_status)
 and (p_since is null or f.created_at>=p_since) and (p_search='' or case
   when p_category='detection' and p_search in ('Konten berisiko dinilai aman', 'Konten aman dinilai berisiko')
   then f.fields->>'errorType'=p_search
   else f.fields->>'description' ilike '%'||p_search||'%' or f.fields->>'title' ilike '%'||p_search||'%'
 end);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into records from (
  select f.id,f.category,f.created_at,f.report_id,coalesce(h.status,'new') status,coalesce(h.version,1) version,left(coalesce(f.fields->>'description',''),180) preview
  from public.feedback_submissions f left join public.feedback_handling h on h.feedback_id=f.id
  where (p_category='' or f.category=p_category) and (p_status='' or coalesce(h.status,'new')=p_status)
   and (p_since is null or f.created_at>=p_since) and (p_search='' or case
   when p_category='detection' and p_search in ('Konten berisiko dinilai aman', 'Konten aman dinilai berisiko')
   then f.fields->>'errorType'=p_search
   else f.fields->>'description' ilike '%'||p_search||'%' or f.fields->>'title' ilike '%'||p_search||'%'
 end)
  order by f.created_at desc,f.id desc limit p_limit offset p_offset
 ) x;
 return jsonb_build_object('items',records,'total',total);
end;
$$;

commit;
