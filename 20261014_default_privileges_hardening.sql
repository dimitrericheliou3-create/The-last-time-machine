-- Harden default grants for the application migration role.
-- Applied to production project nbhdxyvypqtqaowekvdj on 2026-10-14.

-- Do not automatically expose future public tables/sequences/RPCs to API client roles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Keep the activity RPC available to signed-in users, with a hardened definer search path.
ALTER FUNCTION public.record_user_activity() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.record_user_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_user_activity() TO authenticated, service_role;
