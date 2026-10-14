alter table public.account_inactivity_notices
  drop constraint if exists account_inactivity_notices_notice_stage_check;
alter table public.account_inactivity_notices
  add constraint account_inactivity_notices_notice_stage_check
  check (notice_stage in ('warning_30d','warning_15d','warning_7d','workspace_owner_protected','active_subscription_protected'));
