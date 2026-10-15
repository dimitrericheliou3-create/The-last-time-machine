-- Business-only solution review workflow.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS solution_review_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.solutions
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solutions_review_status_check' AND conrelid = 'public.solutions'::regclass) THEN
    ALTER TABLE public.solutions ADD CONSTRAINT solutions_review_status_check CHECK (review_status IN ('pending', 'approved', 'changes_requested'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solutions_review_note_length_check' AND conrelid = 'public.solutions'::regclass) THEN
    ALTER TABLE public.solutions ADD CONSTRAINT solutions_review_note_length_check CHECK (review_note IS NULL OR char_length(review_note) <= 1000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS solutions_workspace_review_status_idx ON public.solutions (workspace_id, review_status);

CREATE OR REPLACE FUNCTION private.can_review_solutions(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND (
        w.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = w.id AND wm.user_id = (SELECT auth.uid())
            AND wm.role IN ('owner', 'admin')
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION private.can_review_solutions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_review_solutions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.guard_solution_review_setting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NEW.solution_review_enabled IS DISTINCT FROM OLD.solution_review_enabled AND NEW.solution_review_enabled THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_subscriptions s
      WHERE s.workspace_id = NEW.id AND s.plan_key = 'business' AND s.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Solution review requires an active Business plan.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_solution_review_setting() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS guard_solution_review_setting ON public.workspaces;
CREATE TRIGGER guard_solution_review_setting BEFORE UPDATE OF solution_review_enabled ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION private.guard_solution_review_setting();

CREATE OR REPLACE FUNCTION private.enforce_solution_review_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  review_enabled boolean := false;
  business_active boolean := false;
  content_changed boolean := false;
  decision_changed boolean := false;
  review_metadata_changed boolean := false;
BEGIN
  SELECT COALESCE(w.solution_review_enabled, false),
         EXISTS (SELECT 1 FROM public.workspace_subscriptions s
                 WHERE s.workspace_id = w.id AND s.plan_key = 'business' AND s.status = 'active')
    INTO review_enabled, business_active
  FROM public.workspaces w WHERE w.id = NEW.workspace_id;

  review_enabled := COALESCE(review_enabled, false) AND COALESCE(business_active, false);

  IF NOT review_enabled THEN
    NEW.review_status := 'approved';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_note := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.review_status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_note := NULL;
    RETURN NEW;
  END IF;

  content_changed :=
    NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.problem_description IS DISTINCT FROM OLD.problem_description OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.steps IS DISTINCT FROM OLD.steps OR
    NEW.outcome IS DISTINCT FROM OLD.outcome OR
    NEW.image_path IS DISTINCT FROM OLD.image_path;

  IF content_changed THEN
    NEW.review_status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_note := NULL;
    RETURN NEW;
  END IF;

  decision_changed := NEW.review_status IS DISTINCT FROM OLD.review_status;
  review_metadata_changed :=
    NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
    NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR
    NEW.review_note IS DISTINCT FROM OLD.review_note;

  IF decision_changed OR review_metadata_changed THEN
    IF NOT private.can_review_solutions(NEW.workspace_id) THEN
      RAISE EXCEPTION 'Only workspace owners and admins can review solutions.' USING ERRCODE = '42501';
    END IF;

    IF OLD.review_status NOT IN ('pending', 'changes_requested')
       OR NEW.review_status NOT IN ('approved', 'changes_requested') THEN
      RAISE EXCEPTION 'This solution is not awaiting review.' USING ERRCODE = '42501';
    END IF;

    NEW.reviewed_by := (SELECT auth.uid());
    NEW.reviewed_at := pg_catalog.now();
    IF NEW.review_status = 'approved' THEN
      NEW.review_note := NULL;
    ELSE
      NEW.review_note := NULLIF(pg_catalog.left(COALESCE(NEW.review_note, ''), 1000), '');
    END IF;
  ELSE
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.review_note := OLD.review_note;
    NEW.review_status := OLD.review_status;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_solution_review_workflow() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS enforce_solution_review_workflow ON public.solutions;
CREATE TRIGGER enforce_solution_review_workflow BEFORE INSERT OR UPDATE ON public.solutions
FOR EACH ROW EXECUTE FUNCTION private.enforce_solution_review_workflow();

CREATE OR REPLACE FUNCTION private.approve_pending_solutions_when_review_disabled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF OLD.solution_review_enabled AND NOT NEW.solution_review_enabled THEN
    UPDATE public.solutions
       SET review_status = 'approved', reviewed_by = NULL, reviewed_at = NULL, review_note = NULL
     WHERE workspace_id = NEW.id AND review_status <> 'approved';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.approve_pending_solutions_when_review_disabled() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS approve_pending_solutions_when_review_disabled ON public.workspaces;
CREATE TRIGGER approve_pending_solutions_when_review_disabled AFTER UPDATE OF solution_review_enabled ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION private.approve_pending_solutions_when_review_disabled();

CREATE OR REPLACE FUNCTION private.sync_solution_review_entitlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE target_workspace uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN target_workspace := OLD.workspace_id;
  ELSE target_workspace := NEW.workspace_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_subscriptions s
    WHERE s.workspace_id = target_workspace AND s.plan_key = 'business' AND s.status = 'active'
  ) THEN
    UPDATE public.workspaces SET solution_review_enabled = false
    WHERE id = target_workspace AND solution_review_enabled;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_solution_review_entitlement() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS sync_solution_review_entitlement ON public.workspace_subscriptions;
CREATE TRIGGER sync_solution_review_entitlement AFTER INSERT OR UPDATE OR DELETE ON public.workspace_subscriptions
FOR EACH ROW EXECUTE FUNCTION private.sync_solution_review_entitlement();

DROP POLICY IF EXISTS "Members can view solutions" ON public.solutions;
CREATE POLICY "Members can view solutions" ON public.solutions FOR SELECT TO authenticated
USING (
  private.is_workspace_member(workspace_id)
  AND (review_status = 'approved' OR created_by = (SELECT auth.uid()) OR private.can_review_solutions(workspace_id))
);

DROP POLICY IF EXISTS "Members can update solutions" ON public.solutions;
CREATE POLICY "Members can update solutions" ON public.solutions FOR UPDATE TO authenticated
USING (private.is_workspace_member(workspace_id) AND (
  private.has_workspace_permission(workspace_id, 'edit') OR private.can_review_solutions(workspace_id)
))
WITH CHECK (private.is_workspace_member(workspace_id) AND (
  private.has_workspace_permission(workspace_id, 'edit') OR private.can_review_solutions(workspace_id)
));

GRANT SELECT (solution_review_enabled) ON public.workspaces TO authenticated;
GRANT UPDATE (solution_review_enabled) ON public.workspaces TO authenticated;
GRANT SELECT (review_status, reviewed_by, reviewed_at, review_note) ON public.solutions TO authenticated;
GRANT UPDATE (review_status) ON public.solutions TO authenticated;
