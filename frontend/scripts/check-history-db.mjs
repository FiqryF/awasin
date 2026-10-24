import { runSequentially } from './run-sequentially.mjs'
// PostgreSQL WASM only: no remote URL, credentials, or real user data.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'node:crypto'

const db = new PGlite()
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema awasin_private;
    grant usage on schema auth, awasin_private to authenticated;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users(id), display_name text not null default '');
    alter table public.profiles enable row level security;
    grant select on public.profiles to authenticated;
    grant update(display_name) on public.profiles to authenticated;
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id));
    create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
    create function awasin_private.active_session() returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from auth.sessions where user_id=(select auth.uid()) and id::text=(select auth.jwt()->>'session_id'))
    $$;
    revoke all on function awasin_private.active_session() from public, anon;
    grant execute on function awasin_private.active_session() to authenticated;
  `)
  await db.exec(`
    create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid() and awasin_private.active_session());
    create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() and awasin_private.active_session()) with check (id = auth.uid() and awasin_private.active_session());
  `)
  await db.exec(await readFile(new URL('../../supabase/migrations/202610230002_scan_history.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../../supabase/migrations/202610230003_account_preferences.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../../supabase/migrations/202610230004_feedback.sql', import.meta.url), 'utf8'))
  const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222'
  const sessionA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const reportA = 'aaaaaaaa-1111-4111-8111-111111111111', reportB = 'bbbbbbbb-2222-4222-8222-222222222222', pending = 'cccccccc-3333-4333-8333-333333333333'
  await db.query('insert into auth.users(id) values ($1),($2)', [a,b])
  await db.query('insert into public.profiles(id) values ($1),($2)', [a,b])
  await db.query('insert into auth.sessions(id,user_id) values ($1,$2),($3,$4)', [sessionA,a,sessionB,b])
  await runSequentially([[reportA,a],[reportB,b]], ([id, owner]) => db.query(`insert into public.scan_reports(id,owner_id,mode,status,safe_label,engine,engine_version,analyzed_at,result) values ($1,$2,'link','completed','Fixture only','test-engine','test-version',now(),'{}')`,[id,owner]))
  await db.query(`insert into public.scan_reports(id,owner_id,mode,status,safe_label) values ($1,$2,'video','unsupported','Fixture unsupported')`,[pending,a])
  await db.exec('set role authenticated')
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:a,session_id:sessionA})])
  assert.deepEqual((await db.query('select history_retention, animation from public.profiles')).rows,[{history_retention:'manual',animation:'system'}])
  assert.equal((await db.query("update public.profiles set animation='reduced' where id=$1 returning id",[b])).rows.length,0)
  await assert.rejects(db.query('update public.profiles set id=$1',[b]),/permission denied/)
  await assert.rejects(db.query("update public.profiles set history_retention='automatic'"),/check constraint/)
  await db.exec("update public.profiles set history_retention='disabled', animation='reduced'")
  assert.equal((await db.query('select * from public.save_scan_report($1,true)',[reportA])).rows.length,0)
  await db.exec("update public.profiles set history_retention='manual'")
  assert.equal((await db.query('select * from public.scan_reports')).rows.length,2)
  assert.equal((await db.query('select * from public.scan_reports where id=$1',[reportB])).rows.length,0)
  await assert.rejects(db.query(`insert into public.scan_reports(owner_id,mode,status,safe_label) values ($1,'link','pending','forbidden')`,[a]),/permission denied/)
  await assert.rejects(db.query(`update public.scan_reports set status='completed'`),/permission denied/)
  assert.equal((await db.query('select * from public.save_scan_report($1,false)',[reportA])).rows.length,0)
  assert.equal((await db.query('select * from public.save_scan_report($1,true)',[reportB])).rows.length,0)
  assert.equal((await db.query('select * from public.save_scan_report($1,true)',[pending])).rows.length,0)
  assert.equal((await db.query('select * from public.save_scan_report($1,true)',[reportA])).rows.length,1)
  const submissionKey=randomUUID()
  await runSequentially([
    ['other',{description:'          '}],
    ['detection',{description:'Fixture valid description',errorType:'invalid'}],
    ['bug',{description:'Fixture valid description',feature:'invalid'}],
    ['idea',{description:'Fixture valid description',title:'x'}],
    ['other',{description:'Fixture valid description',feature:'Login/Register'}],
    ['other',{description:'Fixture valid description',title:'x'.repeat(121)}],
  ], ([category,invalid]) => assert.rejects(db.query('select public.submit_feedback($1,$2,$3::jsonb,null,null,true)',[randomUUID(),category,JSON.stringify(invalid)]),/invalid_parameter_value|invalid parameter/i))
  const fields=JSON.stringify({errorType:'Hasil analisis tidak sesuai / lainnya',description:'Fixture only, please disregard.'})
  const submit=(key,report=null)=>db.query("select public.submit_feedback($1,'detection',$2::jsonb,null,$3,true) as id",[key,fields,report])
  const receipt=(await submit(submissionKey,reportA)).rows[0].id
  assert.notEqual(receipt,submissionKey)
  assert.equal((await submit(submissionKey,reportA)).rows[0].id,receipt)
  await assert.rejects(submit(randomUUID(),reportB),/insufficient_privilege|insufficient_privilege|42501|insufficient privilege/i)
  assert.equal((await db.query('select id,owner_id from public.feedback_submissions')).rows.length,1)
  await assert.rejects(db.query("insert into public.feedback_submissions(submission_key,category,fields,consent) values ($1,'other',$2,true)",[randomUUID(),fields]),/permission denied/)
  await runSequentially(Array.from({length:4}), () => submit(randomUUID()))
  await assert.rejects(submit(randomUUID()),/Submission limit reached/)
  assert.equal((await db.query('select * from public.scan_reports where saved_at is not null')).rows.length,1)
  const firstSave = (await db.query('select saved_at from public.scan_reports where id=$1',[reportA])).rows[0].saved_at
  await db.query('select * from public.save_scan_report($1,true)',[reportA])
  assert.deepEqual((await db.query('select saved_at from public.scan_reports where id=$1',[reportA])).rows[0].saved_at,firstSave)
  assert.equal((await db.query('delete from public.scan_reports where id=$1 returning id',[reportB])).rows.length,0)
  assert.equal((await db.query('select public.clear_scan_history(false) as count')).rows[0].count,0)
  assert.equal((await db.query('select public.clear_scan_history(true) as count')).rows[0].count,1)
  assert.equal((await db.query('select report_id from public.feedback_submissions where id=$1',[receipt])).rows[0].report_id,null)
  assert.equal((await db.query('select * from public.scan_reports where id=$1',[pending])).rows.length,1)
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:b,session_id:sessionB})])
  assert.equal((await db.query('select id from public.feedback_submissions')).rows.length,0)
  assert.equal((await db.query('select * from public.save_scan_report($1,true)',[reportB])).rows.length,1)
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:a,session_id:sessionB})])
  assert.equal((await db.query('select * from public.profiles')).rows.length,0)
  assert.equal((await db.query("update public.profiles set animation='system' returning id")).rows.length,0)
  assert.equal((await db.query('select * from public.scan_reports')).rows.length,0)
  await assert.rejects(submit(randomUUID()),/insufficient_privilege|42501|insufficient privilege/i)
  assert.equal((await db.query('select * from public.save_scan_report($1,true)',[pending])).rows.length,0)
  assert.equal((await db.query('select public.clear_scan_history(true) as count')).rows[0].count,0)
  await db.exec('reset role; set role anon')
  await db.query("select set_config('request.jwt.claims','{}',false)")
  await assert.rejects(db.query('select id from public.feedback_submissions'),/permission denied/)
  await assert.rejects(submit(randomUUID(),reportB),/insufficient_privilege|42501|insufficient privilege/i)
  const guestKey=randomUUID()
  const guestReceipt=(await submit(guestKey)).rows[0].id
  assert.equal((await submit(guestKey)).rows[0].id,guestReceipt)
  await runSequentially(Array.from({length:29}), () => submit(randomUUID()))
  await assert.rejects(submit(randomUUID()),/Submission limit reached/)
  await assert.rejects(db.query('select * from public.scan_reports'),/permission denied/)
  await assert.rejects(db.query('select public.clear_scan_history(true)'),/permission denied/)
  await db.exec('reset role')
  assert.equal((await db.query('select id from public.scan_reports where id=$1',[reportB])).rows.length,1)
  await assert.rejects(db.query(`insert into public.scan_reports(owner_id,mode,status,safe_label) values ($1,'link','completed','no provenance')`,[a]),/completed_provenance/)
  console.log('PASS PostgreSQL migrations 002–004: RLS, preferences, revoked sessions, consent, history deletion, feedback ownership, private guest ingestion, real receipts, idempotency, direct-RPC throttling and report-reference authorization')
} finally { await db.close() }
