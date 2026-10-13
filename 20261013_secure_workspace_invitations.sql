-- Secure, expiring workspace invitations. Only Edge Functions using the service role may write.
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('member')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists workspace_invitations_workspace_idx on public.workspace_invitations(workspace_id);
create index if not exists workspace_invitations_email_idx on public.workspace_invitations(lower(email));
alter table public.workspace_invitations enable row level security;
revoke all on public.workspace_invitations from anon, authenticated;
drop policy if exists "No client access to workspace invitations" on public.workspace_invitations;
create policy "No client access to workspace invitations" on public.workspace_invitations
  for all to anon, authenticated using (false) with check (false);

-- Atomic acceptance prevents two concurrent requests from consuming the same invite.
create or replace function public.accept_workspace_invitation(p_token_hash text, p_email text, p_user_id uuid)
returns table(workspace_id uuid, workspace_name text)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare inv public.workspace_invitations%rowtype;
begin
  select * into inv
  from public.workspace_invitations
  where token_hash = p_token_hash
  for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if inv.accepted_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
  if inv.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;
  if lower(inv.email) <> lower(p_email) then raise exception 'INVITE_EMAIL_MISMATCH'; end if;
  insert into public.workspace_members(workspace_id, user_id, role)
  values (inv.workspace_id, p_user_id, 'member')
  on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invitations set accepted_at = now() where id = inv.id;
  return query select w.id, w.name from public.workspaces w where w.id = inv.workspace_id;
end;
$$;
revoke all on function public.accept_workspace_invitation(text, text, uuid) from public, anon, authenticated;
grant execute on function public.accept_workspace_invitation(text, text, uuid) to service_role;
