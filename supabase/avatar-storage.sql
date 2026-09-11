-- 既存のダイエットクエスト環境に、本人キャラクター用の非公開保存領域を追加する。
-- Supabase Dashboard の SQL Editor で一度だけ実行する。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatar-level-images',
  'avatar-level-images',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatar_level_images_owner_read on storage.objects;
create policy avatar_level_images_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatar-level-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists avatar_level_images_owner_insert on storage.objects;
create policy avatar_level_images_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatar-level-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists avatar_level_images_owner_update on storage.objects;
create policy avatar_level_images_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatar-level-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatar-level-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists avatar_level_images_owner_delete on storage.objects;
create policy avatar_level_images_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatar-level-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
