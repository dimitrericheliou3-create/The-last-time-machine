create table if not exists public.user_legal_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.user_legal_acceptances enable row level security;
revoke all on public.user_legal_acceptances from anon, authenticated;
drop policy if exists "users can read own legal acceptance" on public.user_legal_acceptances;
create policy "users can read own legal acceptance"
  on public.user_legal_acceptances for select to authenticated
  using (user_id = (select auth.uid()));
create or replace function public.record_user_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  terms_v text;
  privacy_v text;
  accepted_v timestamptz;
begin
  terms_v := new.raw_user_meta_data ->> 'legal_terms_version';
  privacy_v := new.raw_user_meta_data ->> 'legal_privacy_version';
  if terms_v is not null and privacy_v is not null then
    begin
      accepted_v := (new.raw_user_meta_data ->> 'legal_accepted_at')::timestamptz;
    exception when others then
      accepted_v := now();
    end;
    insert into public.user_legal_acceptances(user_id, terms_version, privacy_version, accepted_at)
    values (new.id, terms_v, privacy_v, coalesce(accepted_v, now()))
    on conflict (user_id) do update set
      terms_version = excluded.terms_version,
      privacy_version = excluded.privacy_version,
      accepted_at = excluded.accepted_at;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_legal_acceptance on auth.users;
create trigger on_auth_user_legal_acceptance
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.record_user_legal_acceptance();
revoke all on function public.record_user_legal_acceptance() from public, anon, authenticated;
grant select on public.user_legal_acceptances to authenticated;
create or replace function public.require_legal_acceptance_on_signup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'legal_terms_version','') <> '2026-10-13'
     or coalesce(new.raw_user_meta_data ->> 'legal_privacy_version','') <> '2026-10-13'
     or coalesce(new.raw_user_meta_data ->> 'legal_accepted_at','') = '' then
    raise exception 'Terms of Service and Privacy Policy acceptance is required to create an account';
  end if;
  return new;
end;
$$;
drop trigger if exists require_legal_acceptance_before_signup on auth.users;
create trigger require_legal_acceptance_before_signup
  before insert on auth.users
  for each row execute function public.require_legal_acceptance_on_signup();
revoke all on function public.require_legal_acceptance_on_signup() from public, anon, authenticated;
