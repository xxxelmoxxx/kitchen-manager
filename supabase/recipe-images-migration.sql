-- おうちキッチン: 既存環境へレシピ写真保存を追加するSQL
-- Supabase Dashboard > SQL Editor で、このファイルだけを1回実行してください。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own recipe image uploads" on storage.objects;
create policy "own recipe image uploads" on storage.objects
for insert to authenticated
with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own recipe image updates" on storage.objects;
create policy "own recipe image updates" on storage.objects
for update to authenticated
using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own recipe image deletes" on storage.objects;
create policy "own recipe image deletes" on storage.objects
for delete to authenticated
using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);
