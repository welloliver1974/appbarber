-- AppBarber — Create gallery storage bucket + RLS policies
-- Execute no Supabase Dashboard > SQL Editor se o migration runner não aplicar

-- ─── 1. Create gallery bucket ───────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  5242880,
  '{image/jpeg,image/png,image/webp}'
)
on conflict (id) do nothing;

-- ─── 2. Storage RLS policies ────────────────────────────────
-- Allow public read (anyone can view images)
drop policy if exists "Gallery Public Select" on storage.objects;
create policy "Gallery Public Select"
  on storage.objects for select
  using (bucket_id = 'gallery');

-- Allow authenticated users to upload
drop policy if exists "Gallery Auth Insert" on storage.objects;
create policy "Gallery Auth Insert"
  on storage.objects for insert
  with check (bucket_id = 'gallery' and auth.role() = 'authenticated');

-- Allow authenticated users to update
drop policy if exists "Gallery Auth Update" on storage.objects;
create policy "Gallery Auth Update"
  on storage.objects for update
  using (bucket_id = 'gallery' and auth.role() = 'authenticated');

-- Allow authenticated users to delete
drop policy if exists "Gallery Auth Delete" on storage.objects;
create policy "Gallery Auth Delete"
  on storage.objects for delete
  using (bucket_id = 'gallery' and auth.role() = 'authenticated');
