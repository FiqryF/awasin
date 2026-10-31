-- Private account avatars. Apply through the Supabase SQL editor or migrations.
-- Only one canonical image per account; no public read access.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('account-avatars', 'account-avatars', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Read own account avatar" on storage.objects for select to authenticated
using (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.jpg');
create policy "Insert own account avatar" on storage.objects for insert to authenticated
with check (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.jpg');
create policy "Update own account avatar" on storage.objects for update to authenticated
using (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.jpg')
with check (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.jpg');
create policy "Delete own account avatar" on storage.objects for delete to authenticated
using (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.jpg');

commit;
