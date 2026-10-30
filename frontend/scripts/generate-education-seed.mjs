// Deterministic source-to-SQL export; no database connection or cloud mutation.
import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { articles } = await server.ssrLoadModule('/src/features/education/articles.ts')
  if (articles.length !== 4 || new Set(articles.map(a => a.slug)).size !== 4) throw new Error('Expected four original unique articles')
  // ASCII transport avoids clipboard/SQL-editor encoding changes to source text.
  // JSON decodes these escapes back to the exact original Unicode content.
  const content = JSON.stringify(articles).replace(/[\u0080-\uffff]/g, character => String.raw`\u${character.codePointAt(0).toString(16).padStart(4,'0')}`).replaceAll("'", "''")
  const sql = `-- Exact original frontend article content. Import timestamps are NOT publication dates.
-- Reviewed forward data migration; requires 005. No original content source removed.
begin;
lock table public.education_articles in share row exclusive mode;
alter table public.education_articles disable trigger articles_audit;
insert into public.education_articles(content,status)
select value,'published' from jsonb_array_elements('${content}'::jsonb)
on conflict(slug) do nothing;
alter table public.education_articles enable trigger articles_audit;
do $$ begin
 if (select count(*) from jsonb_array_elements('${content}'::jsonb) s
  join public.education_articles a on a.slug=s.value->>'slug'
  where a.content=s.value and a.status='published')<>4 then
  raise exception 'Original article equivalence failed; activation must stop';
 end if;
end $$;
insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,metadata)
select null,'education.seed','education_articles',id,'{"source":"original frontend content","import_only":true}'::jsonb
from public.education_articles a where slug in ('phishing','pesan-dan-otp','keamanan-qr','keaslian-media')
and not exists(select 1 from public.admin_audit_events e where e.entity_id=a.id and e.action='education.seed');
commit;
`
  await writeFile(new URL('../../supabase/migrations/202610290006_education_seed.sql', import.meta.url), sql)
  console.log('Prepared deterministic seed for four original articles; no cloud execution.')
} finally { await server.close() }
