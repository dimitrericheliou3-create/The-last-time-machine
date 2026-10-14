-- Records foreground app activity used by the 8-month inactivity policy.
-- Existing profiles receive a fresh baseline at rollout, giving every current
-- user a full retention window before they can become eligible.

alter table public.profiles
  add column if not exists last_active_at timestamptz not null default now();

create table if not exists public.account_inactivity_notices (
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_stage text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, notice_stage),
  constraint account_inactivity_notices_notice_stage_check
    check (notice_stage in ('warning_30d','warning_15d','warning_7d','workspace_owner_protected','active_subscription_protected'))
);
alter table public.account_inactivity_notices enable row level security;
revoke all on public.account_inactivity_notices from anon, authenticated;
revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;

create or replace function public.record_user_activity()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.profiles
    set last_active_at = now(), updated_at = now()
  where user_id = auth.uid()
    and last_active_at < now() - interval '1 hour';
end;
$$;
revoke all on function public.record_user_activity() from public, anon;
grant execute on function public.record_user_activity() to authenticated;
