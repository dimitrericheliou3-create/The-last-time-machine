-- Enforce the Starter/free-preview solution cap in the database, not just the UI.
-- Workspaces with an active Team or Business subscription are not subject to this cap.
create or replace function public.enforce_free_preview_solution_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_paid_plan boolean := false;
  existing_count integer := 0;
begin
  -- Serialize inserts for this workspace so concurrent requests cannot race past the cap.
  perform 1 from public.workspaces where id = new.workspace_id for update;

  select exists (
    select 1
    from public.workspace_subscriptions s
    where s.workspace_id = new.workspace_id
      and s.status = 'active'
      and s.plan_key in ('team', 'business')
  ) into active_paid_plan;

  if active_paid_plan then
    return new;
  end if;

  select count(*)::integer
    into existing_count
    from public.solutions s
   where s.workspace_id = new.workspace_id;

  if existing_count >= 10 then
    raise exception 'Free preview limit reached: a workspace can save up to 10 solutions. Upgrade to add more.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_free_preview_solution_limit() from public, anon, authenticated;

drop trigger if exists enforce_free_preview_solution_limit on public.solutions;
create trigger enforce_free_preview_solution_limit
before insert on public.solutions
for each row execute function public.enforce_free_preview_solution_limit();
