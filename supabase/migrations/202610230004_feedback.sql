-- Review and deploy after migrations 001–003. No remote application is automatic.
begin;
create table public.feedback_submissions (
    id uuid primary key default gen_random_uuid(),
    submission_key uuid not null unique,
    owner_id uuid references auth.users(id) on delete set null,
    category text not null check (category in ('detection','bug','idea','other')),
    fields jsonb not null check (jsonb_typeof(fields) = 'object' and octet_length(fields::text) <= 20000),
    contact_email text check (char_length(contact_email) between 3 and 254),
    report_id uuid references public.scan_reports(id) on delete set null,
    consent boolean not null check (consent is true),
    created_at timestamptz not null default now(),
    check (report_id is null or category = 'detection')
);
comment on table public.feedback_submissions is 'Private consented feedback text only; no file evidence. Not scan history. Account deletion and retention operations require separate owner-reviewed implementation.';
create index feedback_owner_date on public.feedback_submissions(owner_id, created_at desc);
alter table public.feedback_submissions enable row level security;
alter table public.feedback_submissions force row level security;
revoke all on public.feedback_submissions from public, anon, authenticated;
grant select(id,owner_id,category,fields,contact_email,report_id,created_at) on public.feedback_submissions to authenticated;
create policy feedback_read_self on public.feedback_submissions for select to authenticated
    using (owner_id = (select auth.uid()) and (select awasin_private.active_session()));
-- No direct INSERT/UPDATE/DELETE grant, and no public receipt-lookup endpoint.

create function public.submit_feedback(p_submission_key uuid, p_category text, p_fields jsonb,
    p_contact_email text, p_report_id uuid, p_consent boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); existing public.feedback_submissions; receipt uuid;
begin
    if p_consent is distinct from true or (caller is not null and not awasin_private.active_session()) then
        raise insufficient_privilege;
    end if;
    if p_category not in ('detection','bug','idea','other') or p_submission_key is null
       or jsonb_typeof(p_fields) is distinct from 'object'
       or octet_length(p_fields::text) > 20000
       or char_length(btrim(coalesce(p_fields->>'description',''))) not between 10 and 5000
       or exists(select 1 from jsonb_each(p_fields) f where f.key not in ('errorType','feature','title','description','reproduction','benefit') or jsonb_typeof(f.value) <> 'string' or char_length(f.value #>> '{}') > 5000)
       or (p_contact_email is not null and char_length(p_contact_email) not between 3 and 254) then
        raise invalid_parameter_value;
    end if;
    -- The publishable-key RPC is also a public trust boundary. Enforce the same
    -- category allowlists/lengths here so direct callers cannot bypass FastAPI.
    if exists(select 1 from jsonb_each_text(p_fields) f where
        f.key <> all(case p_category
            when 'detection' then array['errorType','description']
            when 'bug' then array['feature','description','reproduction']
            when 'idea' then array['title','description','benefit']
            else array['title','description'] end)
        or char_length(f.value) > case f.key
            when 'description' then 5000 when 'reproduction' then 2000
            when 'benefit' then 1000 else 120 end)
       or (p_category='detection' and coalesce(p_fields->>'errorType','') not in
           ('Konten berisiko dinilai aman','Konten aman dinilai berisiko','Hasil analisis tidak sesuai / lainnya'))
       or (p_category='bug' and coalesce(p_fields->>'feature','') not in
           ('Link Inspector','Message Analyzer','Fake Website Detector','QR Code Scanner','AI Media Analyzer','Login/Register','Lainnya'))
       or (p_category='idea' and char_length(btrim(coalesce(p_fields->>'title',''))) < 5) then
        raise invalid_parameter_value;
    end if;
    if p_report_id is not null and (caller is null or p_category <> 'detection' or not exists(
        select 1 from public.scan_reports r where r.id=p_report_id and r.owner_id=caller and r.saved_at is not null and r.status='completed'
    )) then raise insufficient_privilege; end if;

    -- Serialize same-owner writes; direct anonymous RPC calls share a bounded budget.
    -- Deliberately global for guests: add a trusted gateway/CAPTCHA for larger deployments.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(caller::text,'awasin-guest-feedback'),0));
    select * into existing from public.feedback_submissions where submission_key=p_submission_key;
    if found then
        if existing.owner_id is distinct from caller or existing.category is distinct from p_category
           or existing.fields is distinct from p_fields or existing.report_id is distinct from p_report_id
           or existing.contact_email is distinct from p_contact_email then raise invalid_parameter_value; end if;
        return existing.id;
    end if;
    if (select count(*) from public.feedback_submissions where owner_id is not distinct from caller and created_at > now()-interval '10 minutes') >= (case when caller is null then 30 else 5 end) then
        raise sqlstate 'PT429' using message='Submission limit reached';
    end if;
    insert into public.feedback_submissions(submission_key,owner_id,category,fields,contact_email,report_id,consent)
    values(p_submission_key,caller,p_category,p_fields,p_contact_email,p_report_id,true) returning id into receipt;
    return receipt;
end;
$$;
revoke all on function public.submit_feedback(uuid,text,jsonb,text,uuid,boolean) from public;
grant execute on function public.submit_feedback(uuid,text,jsonb,text,uuid,boolean) to anon, authenticated;
commit;
