begin;

create table public.feedback_replies (
  id uuid primary key,
  feedback_id uuid not null references public.feedback_submissions(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000 and message ~ '[^[:space:]]'),
  created_at timestamptz not null default now()
);
create index feedback_replies_by_feedback on public.feedback_replies(feedback_id, created_at desc, id desc);
alter table public.feedback_replies enable row level security;
alter table public.feedback_replies force row level security;
revoke all on public.feedback_replies from public, anon, authenticated;
grant select on public.feedback_replies to authenticated;
create policy feedback_reply_read on public.feedback_replies for select to authenticated using (
  (select awasin_private.is_admin()) or (
    (select awasin_private.active_session()) and exists (
      select 1 from public.feedback_submissions f
      where f.id = feedback_id and f.owner_id = (select auth.uid())
    )
  )
);
create trigger feedback_reply_audit after insert on public.feedback_replies
  for each row execute function awasin_private.audit_admin_change();

create function public.send_feedback_reply(p_id uuid, p_feedback_id uuid, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare prior public.feedback_replies;
begin
  if not awasin_private.is_admin() then raise insufficient_privilege; end if;
  if p_id is null or p_message is null or char_length(p_message) not between 1 and 2000
    or p_message !~ '[^[:space:]]'
    or not exists (select 1 from public.feedback_submissions where id = p_feedback_id and owner_id is not null)
  then raise invalid_parameter_value; end if;
  insert into public.feedback_replies(id, feedback_id, message)
    values(p_id, p_feedback_id, btrim(p_message)) on conflict (id) do nothing;
  select * into prior from public.feedback_replies where id = p_id;
  if prior.feedback_id is distinct from p_feedback_id or prior.message is distinct from btrim(p_message)
  then raise unique_violation; end if;
  return p_id;
end;
$$;
revoke all on function public.send_feedback_reply(uuid,uuid,text) from public, anon;
grant execute on function public.send_feedback_reply(uuid,uuid,text) to authenticated;

create function public.my_feedback_replies(p_offset integer default 0) returns table (
  id uuid, feedback_id uuid, category text, feedback_title text,
  feedback_created_at timestamptz, message text, created_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select r.id, f.id, f.category, coalesce(nullif(f.fields->>'title',''), left(f.fields->>'description', 90)),
    f.created_at, r.message, r.created_at
  from public.feedback_submissions f join public.feedback_replies r on r.feedback_id = f.id
  where f.owner_id = (select auth.uid()) and (select awasin_private.active_session())
  order by r.created_at desc, r.id desc offset greatest(p_offset, 0) limit 21;
$$;
revoke all on function public.my_feedback_replies(integer) from public, anon;
grant execute on function public.my_feedback_replies(integer) to authenticated;

commit;
