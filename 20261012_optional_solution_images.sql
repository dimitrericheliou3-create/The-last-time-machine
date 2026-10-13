-- The Last Time Machine: optional private reference images for solutions
-- Run this in Supabase SQL Editor after the existing schema has been created.

alter table public.solutions
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'solution-images',
  'solution-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Workspace members can view solution images" on storage.objects;
create policy "Workspace members can view solution images"
on storage.objects for select to authenticated
using (
  bucket_id = 'solution-images'
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace members can upload solution images" on storage.objects;
create policy "Workspace members can upload solution images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'solution-images'
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace members can update solution images" on storage.objects;
create policy "Workspace members can update solution images"
on storage.objects for update to authenticated
using (
  bucket_id = 'solution-images'
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'solution-images'
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace members can delete solution images" on storage.objects;
create policy "Workspace members can delete solution images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'solution-images'
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
