-- Supabase security hardening for The Last Time Machine.
-- Applied to production project nbhdxyvypqtqaowekvdj on 2026-10-14.

-- Remove default/broad client table privileges. Re-grant only the operations the app uses.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Also clear any prior column-level ACLs so they cannot survive a table-level revoke.
DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT n.nspname, c.relname, a.attname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND a.attnum > 0
      AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES (%I) ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
      col.attname, col.nspname, col.relname
    );
  END LOOP;
END $$;

-- Profiles: read only the fields used in the app; edit only profile fields the user owns.
GRANT SELECT (user_id, display_name, email, username, bio, avatar_path, theme_key, updated_at)
  ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name, username, bio, avatar_path, theme_key)
  ON TABLE public.profiles TO authenticated;

-- Solutions: no anonymous access; authenticated members get normal CRUD, with RLS enforcing workspace permissions.
GRANT SELECT ON TABLE public.solutions TO authenticated;
GRANT INSERT (workspace_id, title, problem_description, category, steps, outcome, created_by, image_path)
  ON TABLE public.solutions TO authenticated;
GRANT UPDATE (title, problem_description, category, steps, outcome, image_path)
  ON TABLE public.solutions TO authenticated;
GRANT DELETE ON TABLE public.solutions TO authenticated;

-- Workspaces: members can read; users can create workspaces they own and owners can rename them.
GRANT SELECT (id, name, owner_id, created_at) ON TABLE public.workspaces TO authenticated;
GRANT INSERT (name, owner_id) ON TABLE public.workspaces TO authenticated;
GRANT UPDATE (name) ON TABLE public.workspaces TO authenticated;

-- Membership is created by the database trigger/invitation function, not direct client writes.
GRANT SELECT (workspace_id, user_id, role, joined_at)
  ON TABLE public.workspace_members TO authenticated;

-- Owners manage permissions for other members; RLS policies restrict rows to workspaces they own.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.workspace_member_permissions TO authenticated;

-- Clients can only read subscription status for their own workspaces.
GRANT SELECT (workspace_id, plan_key, status)
  ON TABLE public.workspace_subscriptions TO authenticated;

-- Legal acceptance records are read-only to clients and restricted to the current user's own row by RLS.
GRANT SELECT ON TABLE public.user_legal_acceptances TO authenticated;

-- All other tables (invitations, webhook events, inactivity notices) remain server-only.

-- Make the inactivity-notice denial explicit instead of relying only on the absence of policies.
DROP POLICY IF EXISTS "No client access to account inactivity notices" ON public.account_inactivity_notices;
CREATE POLICY "No client access to account inactivity notices"
  ON public.account_inactivity_notices
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Remove the duplicate SELECT policy on the user's legal acceptance record.
DROP POLICY IF EXISTS users_can_read_own_legal_acceptance ON public.user_legal_acceptances;

-- Optimize direct auth.uid() references in policies and keep their exact access boundaries.
DROP POLICY IF EXISTS "Users and teammates can view profiles" ON public.profiles;
CREATE POLICY "Users and teammates can view profiles"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.user_shares_workspace(user_id));

DROP POLICY IF EXISTS "Users can update their own display name" ON public.profiles;
CREATE POLICY "Users can update their own profile fields"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Members can create solutions" ON public.solutions;
CREATE POLICY "Members can create solutions"
  ON public.solutions
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.is_workspace_member(workspace_id)
    AND private.has_workspace_permission(workspace_id, 'create')
  );

DROP POLICY IF EXISTS "Owners can grant member permissions" ON public.workspace_member_permissions;
CREATE POLICY "Owners can grant member permissions"
  ON public.workspace_member_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_member_permissions.workspace_id
        AND w.owner_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_member_permissions.workspace_id
        AND wm.user_id = workspace_member_permissions.user_id
    )
  );

DROP POLICY IF EXISTS "Owners can reset member permissions" ON public.workspace_member_permissions;
CREATE POLICY "Owners can reset member permissions"
  ON public.workspace_member_permissions
  FOR DELETE TO authenticated
  USING (
    user_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_member_permissions.workspace_id
        AND w.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can update member permissions" ON public.workspace_member_permissions;
CREATE POLICY "Owners can update member permissions"
  ON public.workspace_member_permissions
  FOR UPDATE TO authenticated
  USING (
    user_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_member_permissions.workspace_id
        AND w.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_member_permissions.workspace_id
        AND w.owner_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_member_permissions.workspace_id
        AND wm.user_id = workspace_member_permissions.user_id
    )
  );

DROP POLICY IF EXISTS "Owners can view all member permissions" ON public.workspace_member_permissions;
CREATE POLICY "Owners can view all member permissions"
  ON public.workspace_member_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_member_permissions.workspace_id
        AND w.owner_id = (SELECT auth.uid())
    )
    OR (
      user_id = (SELECT auth.uid())
      AND private.is_workspace_member(workspace_id)
    )
  );

-- Support account-deletion cleanup without a foreign-key sequential scan.
CREATE INDEX IF NOT EXISTS workspace_invitations_invited_by_idx
  ON public.workspace_invitations (invited_by);
