-- Let people see profile pictures for teammates in their own shared workspaces.
-- All profile images remain in a private bucket and are delivered with signed URLs.

drop policy if exists "Users can view their own profile avatars" on storage.objects;
create policy "Workspace teammates can view profile avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.user_shares_workspace(((storage.foldername(name))[1])::uuid)
    )
  )
);
