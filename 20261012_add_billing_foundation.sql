-- Billing foundation for HandyPay. Subscription state is written by the trusted webhook only.
create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  provider text not null default 'handypay' check (provider in ('handypay')),
  provider_customer_id text,
  provider_subscription_id text,
  plan_key text not null default 'trial' check (plan_key in ('trial','team','business')),
  billing_interval text check (billing_interval in ('monthly','annual')),
  status text not null default 'trial' check (status in ('trial','pending','active','past_due','canceled','expired','incomplete')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workspace_subscriptions enable row level security;
drop policy if exists "Workspace members can view subscription status" on public.workspace_subscriptions;
create policy "Workspace members can view subscription status"
on public.workspace_subscriptions for select to authenticated
using (private.is_workspace_member(workspace_id));
revoke insert, update, delete on public.workspace_subscriptions from anon, authenticated;
grant select on public.workspace_subscriptions to authenticated;

create table if not exists public.handypay_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);
alter table public.handypay_webhook_events enable row level security;
revoke all on public.handypay_webhook_events from anon, authenticated;
drop policy if exists "No client access to HandyPay webhook events" on public.handypay_webhook_events;
create policy "No client access to HandyPay webhook events"
on public.handypay_webhook_events for all to anon, authenticated
using (false) with check (false);
revoke all on public.handypay_webhook_events from anon, authenticated;
