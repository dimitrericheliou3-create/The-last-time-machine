-- Add public profile handles and private profile-picture storage.
-- Applied to Supabase on 2026-10-13.

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists avatar_path text;

alter table public.profiles
  drop constraint if exists profiles_username_format_check;
alter table public.profiles
  add constraint profiles_username_format_check
  check (username is null or (username = lower(username) and username ~ '^[a-z0-9._-]{3,24}$'));

alter table public.profiles
  drop constraint if exists profiles_bio_length_check;
alter table public.profiles
  add constraint profiles_bio_length_check
  check (bio is null or char_length(bio) <= 160);

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

revoke update on public.profiles from anon, authenticated;
grant update(display_name, username, bio, avatar_path) on public.profiles to authenticated;
grant select on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view their own profile avatars" on storage.objects;
create policy "Users can view their own profile avatars"
on storage.objects for select to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload their own profile avatars" on storage.objects;
create policy "Users can upload their own profile avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own profile avatars" on storage.objects;
create policy "Users can update their own profile avatars"
on storage.objects for update to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own profile avatars" on storage.objects;
create policy "Users can delete their own profile avatars"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
