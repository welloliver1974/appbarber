-- AppBarber — Create gallery storage bucket + RLS policy
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

-- ─── 2. Storage RLS policy ──────────────────────────────────
drop policy if exists "Gallery Public Select" on storage.objects;
drop policy if exists "Gallery Auth Insert" on storage.objects;
drop policy if exists "Gallery Auth Update" on storage.objects;
drop policy if exists "Gallery Auth Delete" on storage.objects;
drop policy if exists "Gallery All" on storage.objects;

create policy "Gallery All"
  on storage.objects
  for all
  using (bucket_id = 'gallery')
  with check (bucket_id = 'gallery');
