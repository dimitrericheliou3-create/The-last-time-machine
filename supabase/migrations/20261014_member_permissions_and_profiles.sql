-- Owner-managed member permissions and teammate profiles.
-- Applied to the live Supabase project on 2026-10-14.
-- Members have no create/edit/delete permission row by default (view-only).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Workspace member',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_member_permissions (
  workspace_id uuid not null,
  user_id uuid not null,
  can_create_solutions boolean not null default false,
  can_edit_solutions boolean not null default false,
  can_delete_solutions boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_member_permissions_membership_fkey
    foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete cascade
);
create index if not exists workspace_member_permissions_user_idx on public.workspace_member_permissions(user_id);

create or replace function public.sync_auth_user_profile()
returns trigger language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare preferred_name text;
begin
  preferred_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  )), '');
  if tg_op = 'INSERT' then
    insert into public.profiles(user_id, display_name, email)
    values (
      new.id,
      coalesce(preferred_name, nullif(initcap(replace(split_part(coalesce(new.email, ''), '@', 1), '.', ' ')), ''), 'Workspace member'),
      new.email
    )
    on conflict (user_id) do nothing;
  else
    update public.profiles set email = new.email, updated_at = now() where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_auth_user_profile() from public, anon, authenticated;
drop trigger if exists sync_auth_user_profile_insert on auth.users;
drop trigger if exists sync_auth_user_profile_email on auth.users;
create trigger sync_auth_user_profile_insert after insert on auth.users
for each row execute function public.sync_auth_user_profile();
create trigger sync_auth_user_profile_email after update of email on auth.users
for each row execute function public.sync_auth_user_profile();

insert into public.profiles(user_id, display_name, email)
select u.id,
  coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), ''),
  nullif(initcap(replace(split_part(coalesce(u.email, ''), '@', 1), '.', ' ')), ''),
  'Workspace member'),
  u.email
from auth.users u
on conflict (user_id) do update set email = excluded.email;

alter table public.profiles enable row level security;
alter table public.workspace_member_permissions enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.workspace_member_permissions from anon, authenticated;
grant select, insert, update, delete on public.workspace_member_permissions to authenticated;

create or replace function private.user_shares_workspace(p_other_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = p_other_user_id
  );
$$;

create or replace function private.has_workspace_permission(p_workspace_id uuid, p_permission text)
returns boolean language sql stable security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.workspace_members wm
    join public.workspace_member_permissions p on p.workspace_id = wm.workspace_id and p.user_id = wm.user_id
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
    and case p_permission
      when 'create' then p.can_create_solutions
      when 'edit' then p.can_edit_solutions
      when 'delete' then p.can_delete_solutions
      else false
    end
  );
$$;
revoke all on function private.user_shares_workspace(uuid) from public, anon;
revoke all on function private.has_workspace_permission(uuid, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.user_shares_workspace(uuid) to authenticated;
grant execute on function private.has_workspace_permission(uuid, text) to authenticated;

drop policy if exists "Users and teammates can view profiles" on public.profiles;
create policy "Users and teammates can view profiles" on public.profiles for select to authenticated
using (user_id = auth.uid() or private.user_shares_workspace(user_id));
drop policy if exists "Users can update their own display name" on public.profiles;
create policy "Users can update their own display name" on public.profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Owners can view all member permissions" on public.workspace_member_permissions;
create policy "Owners can view all member permissions" on public.workspace_member_permissions for select to authenticated
using (
  exists (select 1 from public.workspaces w where w.id = public.workspace_member_permissions.workspace_id and w.owner_id = auth.uid())
  or (user_id = auth.uid() and private.is_workspace_member(workspace_id))
);
drop policy if exists "Owners can grant member permissions" on public.workspace_member_permissions;
create policy "Owners can grant member permissions" on public.workspace_member_permissions for insert to authenticated
with check (
  user_id <> auth.uid()
  and exists (select 1 from public.workspaces w where w.id = public.workspace_member_permissions.workspace_id and w.owner_id = auth.uid())
  and exists (select 1 from public.workspace_members wm where wm.workspace_id = public.workspace_member_permissions.workspace_id and wm.user_id = public.workspace_member_permissions.user_id)
);
drop policy if exists "Owners can update member permissions" on public.workspace_member_permissions;
create policy "Owners can update member permissions" on public.workspace_member_permissions for update to authenticated
using (
  user_id <> auth.uid()
  and exists (select 1 from public.workspaces w where w.id = public.workspace_member_permissions.workspace_id and w.owner_id = auth.uid())
)
with check (
  user_id <> auth.uid()
  and exists (select 1 from public.workspaces w where w.id = public.workspace_member_permissions.workspace_id and w.owner_id = auth.uid())
  and exists (select 1 from public.workspace_members wm where wm.workspace_id = public.workspace_member_permissions.workspace_id and wm.user_id = public.workspace_member_permissions.user_id)
);
drop policy if exists "Owners can reset member permissions" on public.workspace_member_permissions;
create policy "Owners can reset member permissions" on public.workspace_member_permissions for delete to authenticated
using (
  user_id <> auth.uid()
  and exists (select 1 from public.workspaces w where w.id = public.workspace_member_permissions.workspace_id and w.owner_id = auth.uid())
);

drop policy if exists "Members can create solutions" on public.solutions;
create policy "Members can create solutions" on public.solutions for insert to authenticated
with check (created_by = auth.uid() and private.is_workspace_member(workspace_id) and private.has_workspace_permission(workspace_id, 'create'));
drop policy if exists "Members can update solutions" on public.solutions;
create policy "Members can update solutions" on public.solutions for update to authenticated
using (private.is_workspace_member(workspace_id) and private.has_workspace_permission(workspace_id, 'edit'))
with check (private.is_workspace_member(workspace_id) and private.has_workspace_permission(workspace_id, 'edit'));
drop policy if exists "Members can delete solutions" on public.solutions;
create policy "Members can delete solutions" on public.solutions for delete to authenticated
using (private.is_workspace_member(workspace_id) and private.has_workspace_permission(workspace_id, 'delete'));

drop policy if exists "Workspace members can upload solution images" on storage.objects;
create policy "Workspace members can upload solution images" on storage.objects for insert to authenticated
with check (
  bucket_id = 'solution-images'
  and (private.has_workspace_permission(((storage.foldername(name))[1])::uuid, 'create')
       or private.has_workspace_permission(((storage.foldername(name))[1])::uuid, 'edit'))
);
drop policy if exists "Workspace members can update solution images" on storage.objects;
create policy "Workspace members can update solution images" on storage.objects for update to authenticated
using (bucket_id = 'solution-images' and private.has_workspace_permission(((storage.foldername(name))[1])::uuid, 'edit'))
with check (bucket_id = 'solution-images' and private.has_workspace_permission(((storage.foldername(name))[1])::uuid, 'edit'));
drop policy if exists "Workspace members can delete solution images" on storage.objects;
create policy "Workspace members can delete solution images" on storage.objects for delete to authenticated
using (
  bucket_id = 'solution-images'
  and (private.has_workspace_permission(((storage.foldername(name))[1])::uuid, 'edit')
       or private.has_workspace_permission(((storage.foldername(name))[1])::uuid, 'delete'))
);
