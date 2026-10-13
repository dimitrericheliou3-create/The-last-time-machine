-- Plan-based solution limits for The Last Time Machine.
-- Starter/free preview: 10 total saved solutions per workspace.
-- Team: 500 total saved solutions per workspace.
-- Business: 2,500 included; additional saved solutions are allowed and priced at
-- $0.05 per extra stored solution per month. This migration does not collect fees;
-- metered billing must be implemented and tested before charging customers.
create or replace function public.enforce_plan_solution_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_plan text := 'starter';
  existing_count integer := 0;
  max_allowed integer;
begin
  -- Serialize inserts within a workspace to avoid concurrent requests bypassing caps.
  perform 1 from public.workspaces where id = new.workspace_id for update;

  select s.plan_key into active_plan
  from public.workspace_subscriptions s
  where s.workspace_id = new.workspace_id
    and s.status = 'active'
    and s.plan_key in ('team', 'business')
  limit 1;

  if active_plan is null then active_plan := 'starter'; end if;

  if active_plan = 'team' then
    max_allowed := 500;
  elsif active_plan = 'business' then
    -- Business can exceed the included allowance; metered overage billing is separate.
    return new;
  else
    max_allowed := 10;
  end if;

  select count(*)::integer into existing_count
  from public.solutions s
  where s.workspace_id = new.workspace_id;

  if existing_count >= max_allowed then
    if active_plan = 'team' then
      raise exception 'Team plan limit reached: a workspace can save up to 500 solutions. Upgrade to Business to add more.'
        using errcode = 'P0001';
    else
      raise exception 'Free preview limit reached: a workspace can save up to 10 solutions. Upgrade to add more.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_plan_solution_limits() from public, anon, authenticated;
drop trigger if exists enforce_free_preview_solution_limit on public.solutions;
drop trigger if exists enforce_plan_solution_limits on public.solutions;
create trigger enforce_plan_solution_limits
before insert on public.solutions
for each row execute function public.enforce_plan_solution_limits();
