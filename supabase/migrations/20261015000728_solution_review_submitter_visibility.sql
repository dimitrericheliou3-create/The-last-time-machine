-- Track the latest submitter so editors can see their own pending revision.
ALTER TABLE public.solutions
  ADD COLUMN IF NOT EXISTS review_submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

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
    NEW.review_status := 'approved'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    NEW.review_note := NULL; NEW.review_submitted_by := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.review_status := 'pending'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    NEW.review_note := NULL; NEW.review_submitted_by := (SELECT auth.uid());
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
    NEW.review_status := 'pending'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    NEW.review_note := NULL; NEW.review_submitted_by := (SELECT auth.uid());
    RETURN NEW;
  END IF;

  decision_changed := NEW.review_status IS DISTINCT FROM OLD.review_status;
  review_metadata_changed :=
    NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
    NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR
    NEW.review_note IS DISTINCT FROM OLD.review_note OR
    NEW.review_submitted_by IS DISTINCT FROM OLD.review_submitted_by;

  IF decision_changed OR review_metadata_changed THEN
    IF NOT private.can_review_solutions(NEW.workspace_id) THEN
      RAISE EXCEPTION 'Only workspace owners and admins can review solutions.' USING ERRCODE = '42501';
    END IF;
    IF OLD.review_status NOT IN ('pending', 'changes_requested')
       OR NEW.review_status NOT IN ('approved', 'changes_requested') THEN
      RAISE EXCEPTION 'This solution is not awaiting review.' USING ERRCODE = '42501';
    END IF;
    NEW.reviewed_by := (SELECT auth.uid()); NEW.reviewed_at := pg_catalog.now();
    NEW.review_submitted_by := OLD.review_submitted_by;
    IF NEW.review_status = 'approved' THEN NEW.review_note := NULL;
    ELSE NEW.review_note := NULLIF(pg_catalog.left(COALESCE(NEW.review_note, ''), 1000), '');
    END IF;
  ELSE
    NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
    NEW.review_note := OLD.review_note; NEW.review_submitted_by := OLD.review_submitted_by;
    NEW.review_status := OLD.review_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Members can view solutions" ON public.solutions;
CREATE POLICY "Members can view solutions" ON public.solutions FOR SELECT TO authenticated
USING (
  private.is_workspace_member(workspace_id)
  AND (
    review_status = 'approved'
    OR created_by = (SELECT auth.uid())
    OR review_submitted_by = (SELECT auth.uid())
    OR private.can_review_solutions(workspace_id)
  )
);
GRANT SELECT (review_submitted_by) ON public.solutions TO authenticated;
