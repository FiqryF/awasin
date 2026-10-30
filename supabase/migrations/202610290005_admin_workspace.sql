-- Forward-only Phase 6. Apply only after reviewed cloud approval; requires 001–004.
begin;

create function awasin_private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select awasin_private.active_session() and exists(
   select 1 from public.user_roles where user_id=auth.uid() and role='admin');
$$;
revoke all on function awasin_private.is_admin() from public, anon;
grant execute on function awasin_private.is_admin() to authenticated;

create table public.feedback_handling (
 feedback_id uuid primary key references public.feedback_submissions(id),
 status text not null default 'new' check(status in ('new','in_review','resolved')),
 note text not null default '' check(char_length(note)<=4000),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now()
);
create table public.registry_organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(btrim(name)) between 2 and 160),
 category text not null check(char_length(btrim(category)) between 2 and 80),
 description text not null default '' check(char_length(description)<=2000),
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index registry_organization_name on public.registry_organizations(lower(btrim(name)));
create table public.registry_domains (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.registry_organizations(id),
 domain text not null unique check(char_length(domain)<=253 and domain=lower(domain)
  and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
 status text not null default 'pending_review' check(status in ('pending_review','verified','rejected','archived')),
 evidence_url text not null check(char_length(evidence_url) between 8 and 2000 and evidence_url ~ '^https://[^/@[:space:]]+([/][^[:space:]]*)?$'),
 evidence_description text not null check(char_length(btrim(evidence_description)) between 20 and 4000),
 review_note text not null default '' check(char_length(review_note)<=2000),
 reviewed_by uuid references auth.users(id) on delete set null,
 verified_at timestamptz,
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'verified' or (verified_at is not null and char_length(btrim(review_note))>=10))
);
comment on table public.registry_domains is 'Documented organizational association only. NOT a website/URL safety verdict. Manual evidence review; no discovery jobs.';
create index registry_domains_status_date on public.registry_domains(status,created_at desc,id);

create function awasin_private.valid_article(c jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare s jsonb; p jsonb; r jsonb;
begin
 if jsonb_typeof(c)<>'object' or octet_length(c::text)>150000
  or coalesce(c->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  or char_length(c->>'slug') not between 2 and 100
  or char_length(btrim(coalesce(c->>'title',''))) not between 5 and 200
  or char_length(btrim(coalesce(c->>'description',''))) not between 10 and 1000
  or char_length(btrim(coalesce(c->>'category',''))) not between 2 and 80
  or coalesce(c->>'image','') !~ '^/assets/education/[a-z0-9-]+\.(jpg|png|webp)$'
  or jsonb_typeof(c->'sections') is distinct from 'array' then return false; end if;
 if jsonb_array_length(c->'sections') not between 1 and 30 then return false; end if;
 for s in select value from jsonb_array_elements(c->'sections') loop
  if jsonb_typeof(s)<>'object' or char_length(btrim(coalesce(s->>'title',''))) not between 2 and 200
   or jsonb_typeof(s->'paragraphs') is distinct from 'array' then return false; end if;
  if jsonb_array_length(s->'paragraphs') not between 1 and 20 then return false; end if;
  for p in select value from jsonb_array_elements(s->'paragraphs') loop
   if jsonb_typeof(p)<>'string' or char_length(btrim(p#>>'{}')) not between 1 and 5000 then return false; end if;
  end loop;
 end loop;
 if jsonb_typeof(c->'source') is distinct from 'object' then return false; end if;
 if c ? 'sources' and jsonb_typeof(c->'sources')<>'array' then return false; end if;
 if jsonb_array_length(coalesce(c->'sources','[]'))>20 then return false; end if;
 for r in select c->'source' union all select value from jsonb_array_elements(coalesce(c->'sources','[]')) loop
  if char_length(btrim(coalesce(r->>'name',''))) not between 2 and 200
   or char_length(coalesce(r->>'url',''))>2000
   or coalesce(r->>'url','') !~ '^https://[^/@[:space:]]+([/][^[:space:]]*)?$' then return false; end if;
 end loop;
 return true;
end;
$$;
revoke all on function awasin_private.valid_article(jsonb) from public,anon;
grant execute on function awasin_private.valid_article(jsonb) to authenticated;
create table public.education_articles (
 id uuid primary key default gen_random_uuid(),
 content jsonb not null check(awasin_private.valid_article(content)),
 slug text generated always as (content->>'slug') stored unique,
 title text generated always as (content->>'title') stored,
 category text generated always as (content->>'category') stored,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index education_articles_status_date on public.education_articles(status,created_at desc,id);
create table public.admin_audit_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 action text not null, entity_type text not null, entity_id uuid not null,
 metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index admin_audit_events_date on public.admin_audit_events(created_at desc,id);
create index admin_audit_events_target on public.admin_audit_events(entity_type,entity_id);

-- Management data is private. No client receives INSERT/UPDATE/DELETE privileges.
do $$ declare t text; begin
 foreach t in array array['feedback_handling','registry_organizations','registry_domains','education_articles','admin_audit_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy admin_read on public.%I for select to authenticated using ((select awasin_private.is_admin()))',t);
 end loop;
end $$;
grant select(id,content,slug,title,category,status,version,created_at,updated_at) on public.education_articles to anon;
create policy education_public_read on public.education_articles for select to anon,authenticated using(status='published');
create policy feedback_admin_read on public.feedback_submissions for select to authenticated using((select awasin_private.is_admin()));

create function awasin_private.audit_admin_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare rowdata jsonb:=to_jsonb(new); previous jsonb:='{}'; target uuid;
begin
 if not awasin_private.is_admin() then raise insufficient_privilege; end if;
 if tg_op='UPDATE' then previous:=to_jsonb(old); end if;
 target:=coalesce(rowdata->>'id',rowdata->>'feedback_id')::uuid;
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),tg_table_name||'.'||lower(tg_op),tg_table_name,target,
  jsonb_strip_nulls(jsonb_build_object('previous_status',previous->>'status','status',rowdata->>'status',
   'previous_version',previous->'version','version',rowdata->'version')));
 return new;
end;
$$;
revoke all on function awasin_private.audit_admin_change() from public,anon,authenticated;
create trigger feedback_handling_audit after update on public.feedback_handling for each row execute function awasin_private.audit_admin_change();
create trigger organizations_audit after insert or update on public.registry_organizations for each row execute function awasin_private.audit_admin_change();
create trigger domains_audit after insert or update on public.registry_domains for each row execute function awasin_private.audit_admin_change();
create trigger articles_audit after insert or update on public.education_articles for each row execute function awasin_private.audit_admin_change();

create function public.admin_mutate(p_kind text,p_id uuid,p_data jsonb,p_version integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; current_row jsonb;
begin
 if not awasin_private.is_admin() then raise insufficient_privilege; end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>160000 then raise invalid_parameter_value; end if;
 if p_kind='organization' then
  if p_id is null then
   insert into public.registry_organizations(name,category,description) values(p_data->>'name',p_data->>'category',coalesce(p_data->>'description','')) returning to_jsonb(registry_organizations.*) into result;
  else
   update public.registry_organizations set name=p_data->>'name',category=p_data->>'category',description=coalesce(p_data->>'description',''),version=version+1,updated_at=now() where id=p_id and version=p_version returning to_jsonb(registry_organizations.*) into result;
  end if;
 elsif p_kind='domain' then
  if p_id is null then
   insert into public.registry_domains(organization_id,domain,evidence_url,evidence_description) values((p_data->>'organization_id')::uuid,p_data->>'domain',p_data->>'evidence_url',p_data->>'evidence_description') returning to_jsonb(registry_domains.*) into result;
  else
   update public.registry_domains set organization_id=(p_data->>'organization_id')::uuid,domain=p_data->>'domain',evidence_url=p_data->>'evidence_url',evidence_description=p_data->>'evidence_description',status='pending_review',reviewed_by=null,verified_at=null,review_note='',version=version+1,updated_at=now() where id=p_id and version=p_version returning to_jsonb(registry_domains.*) into result;
  end if;
 elsif p_kind='domain_review' then
  if p_data->>'status' not in ('verified','rejected','archived') or char_length(btrim(coalesce(p_data->>'review_note',''))) not between 10 and 2000 then raise invalid_parameter_value; end if;
  update public.registry_domains set status=p_data->>'status',review_note=p_data->>'review_note',reviewed_by=auth.uid(),verified_at=case when p_data->>'status'='verified' then now() else null end,version=version+1,updated_at=now()
   where id=p_id and version=p_version and (p_data->>'status'='archived' or status='pending_review') returning to_jsonb(registry_domains.*) into result;
 elsif p_kind='article' then
  if not coalesce(awasin_private.valid_article(p_data->'content'),false) then raise invalid_parameter_value; end if;
  if p_id is null then
   insert into public.education_articles(content) values(p_data->'content') returning to_jsonb(education_articles.*) into result;
  else
   select to_jsonb(a) into current_row from public.education_articles a where id=p_id for update;
   -- Existing public URLs are immutable. Editing a published article creates a draft.
   if current_row->>'slug' is distinct from p_data->'content'->>'slug' then raise invalid_parameter_value; end if;
   update public.education_articles set content=p_data->'content',status='draft',version=version+1,updated_at=now() where id=p_id and version=p_version returning to_jsonb(education_articles.*) into result;
  end if;
 elsif p_kind='article_status' then
  if p_data->>'status' not in ('draft','published','archived') then raise invalid_parameter_value; end if;
  update public.education_articles set status=p_data->>'status',version=version+1,updated_at=now() where id=p_id and version=p_version returning to_jsonb(education_articles.*) into result;
 elsif p_kind='feedback' then
  if p_data->>'status' not in ('new','in_review','resolved') then raise invalid_parameter_value; end if;
  insert into public.feedback_handling(feedback_id) values(p_id) on conflict do nothing;
  update public.feedback_handling set status=p_data->>'status',note=coalesce(p_data->>'note',''),version=version+1,updated_at=now() where feedback_id=p_id and version=p_version returning to_jsonb(feedback_handling.*) into result;
 else raise invalid_parameter_value;
 end if;
 if result is null then raise exception 'Record changed or unavailable' using errcode='40001'; end if;
 return result;
end;
$$;
revoke all on function public.admin_mutate(text,uuid,jsonb,integer) from public,anon;
grant execute on function public.admin_mutate(text,uuid,jsonb,integer) to authenticated;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not awasin_private.is_admin() then raise insufficient_privilege; end if;
 return jsonb_build_object(
  'feedback_total',(select count(*) from public.feedback_submissions),
  'feedback_new',(select count(*) from public.feedback_submissions f left join public.feedback_handling h on h.feedback_id=f.id where coalesce(h.status,'new')='new'),
  'feedback_in_review',(select count(*) from public.feedback_handling where status='in_review'),
  'feedback_resolved',(select count(*) from public.feedback_handling where status='resolved'),
  'domains_verified',(select count(*) from public.registry_domains where status='verified'),
  'domains_pending',(select count(*) from public.registry_domains where status='pending_review'),
  'articles_published',(select count(*) from public.education_articles where status='published'));
end;
$$;
revoke all on function public.admin_overview() from public,anon;
grant execute on function public.admin_overview() to authenticated;

create function public.admin_feedback_page(p_offset integer default 0,p_limit integer default 20,p_category text default '',p_status text default '',p_search text default '',p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare records jsonb; total bigint;
begin
 if not awasin_private.is_admin() then raise insufficient_privilege; end if;
 if p_offset not between 0 and 100000 or p_limit not between 1 and 50 or char_length(p_search)>80 then raise invalid_parameter_value; end if;
 select count(*) into total from public.feedback_submissions f left join public.feedback_handling h on h.feedback_id=f.id
 where (p_category='' or f.category=p_category) and (p_status='' or coalesce(h.status,'new')=p_status)
 and (p_since is null or f.created_at>=p_since) and (p_search='' or f.fields->>'description' ilike '%'||p_search||'%' or f.fields->>'title' ilike '%'||p_search||'%');
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into records from (
  select f.id,f.category,f.created_at,f.report_id,coalesce(h.status,'new') status,coalesce(h.version,1) version,left(coalesce(f.fields->>'description',''),180) preview
  from public.feedback_submissions f left join public.feedback_handling h on h.feedback_id=f.id
  where (p_category='' or f.category=p_category) and (p_status='' or coalesce(h.status,'new')=p_status)
   and (p_since is null or f.created_at>=p_since) and (p_search='' or f.fields->>'description' ilike '%'||p_search||'%' or f.fields->>'title' ilike '%'||p_search||'%')
  order by f.created_at desc,f.id desc limit p_limit offset p_offset
 ) x;
 return jsonb_build_object('items',records,'total',total);
end;
$$;
revoke all on function public.admin_feedback_page(integer,integer,text,text,text,timestamptz) from public,anon;
grant execute on function public.admin_feedback_page(integer,integer,text,text,text,timestamptz) to authenticated;
commit;
