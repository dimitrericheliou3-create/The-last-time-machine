-- Persist the user's interface color scheme on their account.
-- Valid presets: dark (default), midnight, forest, plum, and light.

alter table public.profiles
  add column if not exists theme_key text not null default 'dark';

alter table public.profiles
  drop constraint if exists profiles_theme_key_check;
alter table public.profiles
  add constraint profiles_theme_key_check
  check (theme_key in ('dark','midnight','forest','plum','light'));

revoke update on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name, username, bio, avatar_path, theme_key) on public.profiles to authenticated;
