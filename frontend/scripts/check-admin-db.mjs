// Local PostgreSQL semantics only. No network, credentials, or cloud writes.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { runSequentially } from './run-sequentially.mjs'
const db = new PGlite()
const admin = '11111111-1111-4111-8111-111111111111', user = '22222222-2222-4222-8222-222222222222'
const sa = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', su = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
async function as(role, id, session) {
  await db.exec(`reset role; set role ${role}`)
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, session_id: session })])
}
async function mutate(kind, id, data, version = null) {
  return (await db.query('select public.admin_mutate($1,$2,$3,$4) result', [kind, id, JSON.stringify(data), version])).rows[0].result
}
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz default now(),is_anonymous boolean default false,banned_until timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
  create table auth.mfa_factors(user_id uuid,status text,factor_type text);
  create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
  grant usage on schema auth to anon,authenticated;`)
  await runSequentially(['202610230001_identity.sql', '202610230002_scan_history.sql', '202610230003_account_preferences.sql', '202610230004_feedback.sql', '202610290005_admin_workspace.sql', '202610290006_education_seed.sql'], async file => {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  })
  await db.query('insert into auth.users(id) values($1),($2)', [admin, user])
  await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)', [sa,admin,su,user])
  await db.query("update public.user_roles set role='admin' where user_id=$1", [admin])
  await as('anon', null, null)
  assert.equal((await db.query('select * from public.education_articles')).rows.length, 4)
  await assert.rejects(db.query('select public.admin_overview()'), /permission denied/)
  await assert.rejects(db.query('select * from public.admin_audit_events'), /permission denied/)
  await as('authenticated', user, su)
  await assert.rejects(db.query('select public.admin_overview()'), /insufficient_privilege|insufficient privilege/)
  await assert.rejects(() => mutate('organization', null, {name:'Spoofed',category:'Test'}), /insufficient/)
  assert.equal((await db.query('select * from public.registry_domains')).rows.length, 0)
  assert.equal((await db.query('select * from public.feedback_handling')).rows.length, 0)
  assert.equal((await db.query('select * from public.admin_audit_events')).rows.length, 0)
  await assert.rejects(db.query("insert into public.admin_audit_events(action,entity_type,entity_id) values('spoof','test',$1)",[admin]), /permission denied/)
  await as('authenticated', admin, sa)
  const organization = await mutate('organization', null, {name:'Local fixture organization',category:'Fixture',description:''})
  const data = { organization_id:organization.id, domain:'example.com', evidence_url:'https://example.com/evidence', evidence_description:'Local fixture evidence only; never a live verification claim.',status:'verified',reviewed_by:user }
  const domain = await mutate('domain', null, data)
  assert.equal(domain.status, 'pending_review'); assert.equal(domain.reviewed_by, null)
  await assert.rejects(() => mutate('domain', null, data), /duplicate/)
  await assert.rejects(() => mutate('domain_review',domain.id,{status:'verified',review_note:''},1), /invalid/)
  const approved = await mutate('domain_review',domain.id,{status:'verified',review_note:'Fixture review only',reviewed_by:user},1)
  assert.equal(approved.reviewed_by,admin); assert.ok(approved.verified_at)
  await assert.rejects(() => mutate('domain_review',domain.id,{status:'rejected',review_note:'Stale write fixture'},1), /changed/)
  const revised = await mutate('domain',domain.id,{...data,evidence_description:'Changed fixture evidence requires a fresh review.'},approved.version)
  assert.equal(revised.status,'pending_review'); assert.equal(revised.verified_at,null)
  const original = (await db.query("select content from public.education_articles where slug='phishing'")).rows[0].content
  const draft = await mutate('article',null,{content:{...original,slug:'fixture-draft',title:'Fixture draft content'}})
  await as('anon',null,null)
  assert.equal((await db.query("select * from public.education_articles where slug='fixture-draft'")).rows.length,0)
  await as('authenticated',admin,sa)
  await assert.rejects(db.query("update public.education_articles set status='published' where id=$1",[draft.id]),/permission denied/)
  const published = await mutate('article_status',draft.id,{status:'published'},draft.version)
  await as('anon',null,null)
  assert.equal((await db.query("select * from public.education_articles where slug='fixture-draft'")).rows.length,1)
  await as('authenticated',admin,sa)
  await assert.rejects(() => mutate('article',draft.id,{content:{...original,slug:'break-public-url'}},published.version), /invalid/)
  const edit = await mutate('article',draft.id,{content:{...draft.content,title:'Updated fixture title'}},published.version)
  assert.equal(edit.status,'draft')
  await assert.rejects(db.query('delete from public.admin_audit_events'),/permission denied/)
  const audit = (await db.query('select * from public.admin_audit_events')).rows
  assert.ok(audit.some(e=>e.actor_id===admin && e.entity_id===domain.id))
  assert.ok(audit.every(e=>!JSON.stringify(e.metadata).includes('evidence') && !JSON.stringify(e.metadata).includes('Fixture review')))
  const feedback = (await db.query("select public.submit_feedback('33333333-3333-4333-8333-333333333333','other','{\"description\":\"Local database fixture only\"}',null,null,true) id")).rows[0].id
  await mutate('feedback',feedback,{status:'in_review',note:'Private internal fixture'},1)
  await as('authenticated',user,su)
  assert.equal((await db.query('select * from public.feedback_handling')).rows.length,0)
  assert.equal((await db.query('select * from public.admin_audit_events')).rows.length,0)
  await db.exec('reset role')
  await db.query('delete from auth.sessions where id=$1',[sa])
  await as('authenticated',admin,sa)
  await assert.rejects(db.query('select public.admin_overview()'),/insufficient/)
  console.log('PASS migrations 001–006 compatibility, exact four-article seed, Guest/User/Admin RLS, narrow RPC grants, atomic audit, optimistic conflicts, evidence review reset, safe publishing, immutable slugs, private notes and revoked admin sessions (local PGlite only).')
} finally { await db.close() }
