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
  create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz default now(),is_anonymous boolean default false,banned_until timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
  create table auth.mfa_factors(user_id uuid,status text,factor_type text);
  create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
  grant usage on schema auth to anon,authenticated;`)
  await runSequentially(['202610230001_identity.sql', '202610230002_scan_history.sql', '202610230003_account_preferences.sql', '202610230004_feedback.sql', '202610290005_admin_workspace.sql', '202610290006_education_seed.sql', '202611140009_feedback_replies.sql', '202611140010_admin_quality_announcements.sql'], async file => {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  })
  await db.query('insert into auth.users(id) values($1),($2)', [admin, user])
  await db.exec(await readFile(new URL('../../supabase/migrations/202611140011_admin_registered_users.sql', import.meta.url), 'utf8'))
  await db.query('update auth.users set email=$1 where id=$2', ['fixture@example.invalid', user])
  await db.query('insert into auth.users(id,is_anonymous) values(gen_random_uuid(),true)')
  await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)', [sa,admin,su,user])
  await db.query("update public.user_roles set role='admin' where user_id=$1", [admin])
  await as('anon', null, null)
  assert.equal((await db.query('select * from public.education_articles')).rows.length, 4)
  await assert.rejects(db.query('select public.admin_overview()'), /permission denied/)
  await assert.rejects(db.query('select public.admin_registered_users()'), /permission denied/)
  await assert.rejects(db.query('select * from public.admin_audit_events'), /permission denied/)
  await as('authenticated', user, su)
  await assert.rejects(db.query('select public.admin_overview()'), /insufficient_privilege|insufficient privilege/)
  await assert.rejects(db.query('select public.admin_registered_users()'), /insufficient/)
  await assert.rejects(() => mutate('organization', null, {name:'Spoofed',category:'Test'}), /insufficient/)
  assert.equal((await db.query('select * from public.registry_domains')).rows.length, 0)
  assert.equal((await db.query('select * from public.feedback_handling')).rows.length, 0)
  assert.equal((await db.query('select * from public.admin_audit_events')).rows.length, 0)
  await assert.rejects(db.query("insert into public.admin_audit_events(action,entity_type,entity_id) values('spoof','test',$1)",[admin]), /permission denied/)
  await as('authenticated', admin, sa)
  const {result: users} = (await db.query('select public.admin_registered_users() result')).rows[0]
  assert.equal(users.total, 2)
  assert.equal(users.items.find(account => account.id === user).email, 'fixture@example.invalid')
  assert.deepEqual(Object.keys(users.items[0]).sort(), ['created_at','display_name','email','id','role'])
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
  const reply = '44444444-4444-4444-8444-444444444444'
  const guestKey = '55555555-5555-4555-8555-555555555555'
  const send = (id, message, replyId = reply) => db.query('select public.send_feedback_reply($1,$2,$3)', [replyId, id, message])
  const submit = key => db.query("select public.submit_feedback($1,'other','{\"description\":\"Local database fixture only\"}',null,null,true) id", [key])
  const inbox = async () => (await db.query('select * from public.my_feedback_replies()')).rows
  await as('anon',null,null)
  const guestFeedback = (await submit(guestKey)).rows[0].id
  await assert.rejects(inbox, /permission denied/)
  await as('authenticated',user,su)
  const userFeedback = (await submit('66666666-6666-4666-8666-666666666666')).rows[0].id
  await assert.rejects(() => send(userFeedback, 'Spoofed reply'), /insufficient/)
  await as('authenticated',admin,sa)
  await assert.rejects(() => send(guestFeedback, 'Guest reply'), /invalid/)
  await assert.rejects(() => send(userFeedback, ' '), /invalid/)
  await send(userFeedback, 'Tindak lanjut untuk pengirim.')
  await send(userFeedback, 'Tindak lanjut untuk pengirim.')
  await assert.rejects(() => send(userFeedback, 'Changed after sending'), /unique/)
  assert.equal((await inbox()).length, 0)
  const replyAudit = (await db.query("select * from public.admin_audit_events where entity_type='feedback_replies'")).rows
  assert.equal(replyAudit.length, 1)
  assert.equal(replyAudit[0].actor_id, admin)
  assert.equal(replyAudit[0].entity_id, reply)
  assert.ok(!JSON.stringify(replyAudit[0]).includes('Tindak lanjut'))
  await send(feedback, 'Private reply to another account.', '77777777-7777-4777-8777-777777777777')
  await as('authenticated',user,su)
  const replies = await inbox()
  assert.equal(replies.length, 1)
  assert.equal(replies[0].feedback_id, userFeedback)
  assert.equal(replies[0].message, 'Tindak lanjut untuk pengirim.')
  assert.deepEqual((await db.query('select id from public.feedback_replies')).rows, [{id: reply}])
  assert.ok(replies[0].feedback_created_at)
  assert.equal((await db.query('select * from public.my_feedback_replies(20)')).rows.length, 0)
  await assert.rejects(db.query('select public.admin_detection_quality(now())'), /insufficient/)
  await assert.rejects(db.query("insert into public.service_announcements(message, starts_at, ends_at) values('User cannot publish', now(), now() + interval '1 hour')"), /row-level security/)
  await db.query(`select public.submit_feedback(gen_random_uuid(), 'detection',
    '{"errorType":"Konten berisiko dinilai aman","description":"Fixture laporan deteksi pengguna"}', null, null, true)`)
  await as('authenticated',admin,sa)
  const quality = (await db.query("select public.admin_detection_quality(now() - interval '30 days') result")).rows[0].result
  assert.deepEqual(quality, {too_safe:1, too_risky:0, unreviewed:1})
  const detection = (await db.query("select public.admin_feedback_page(0, 20, 'detection', '', 'Konten berisiko dinilai aman') result")).rows[0].result
  assert.equal(detection.total, quality.too_safe)
  const active = (await db.query(`insert into public.service_announcements(message, starts_at, ends_at)
    values('Active fixture', now() - interval '1 minute', now() + interval '1 hour') returning id`)).rows[0].id
  await db.query(`insert into public.service_announcements(message, starts_at, ends_at)
    values('Future fixture', now() + interval '1 hour', now() + interval '2 hours'),
          ('Expired fixture', now() - interval '2 hours', now() - interval '1 hour')`)
  await as('anon',null,null)
  assert.deepEqual((await db.query('select message from public.service_announcements')).rows, [{message:'Active fixture'}])
  await as('authenticated',admin,sa)
  await db.query('update public.service_announcements set enabled=false where id=$1', [active])
  await as('anon',null,null)
  assert.equal((await db.query('select id from public.service_announcements')).rows.length, 0)
  await as('authenticated',user,su)
  await assert.rejects(db.query("update public.feedback_replies set message='spoofed'"), /permission denied/)
  assert.equal((await db.query('select * from public.feedback_handling')).rows.length,0)
  assert.equal((await db.query('select * from public.admin_audit_events')).rows.length,0)
  await db.exec('reset role')
  await db.query('delete from auth.sessions where id=$1',[su])
  await as('authenticated',user,su)
  assert.equal((await inbox()).length, 0)
  await db.exec('reset role')
  await db.query('delete from auth.sessions where id=$1',[sa])
  await as('authenticated',admin,sa)
  await assert.rejects(db.query('select public.admin_overview()'),/insufficient/)
  console.log('PASS admin migrations, feedback replies, private notes, idempotent sending, and Guest/User/Admin isolation (local PGlite).')
} finally { await db.close() }
