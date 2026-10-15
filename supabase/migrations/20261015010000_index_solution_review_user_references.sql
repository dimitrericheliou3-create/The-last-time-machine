-- Cover the two review-user foreign keys to avoid full scans during joins/deletes.
CREATE INDEX IF NOT EXISTS solutions_review_submitted_by_idx
  ON public.solutions (review_submitted_by);

CREATE INDEX IF NOT EXISTS solutions_reviewed_by_idx
  ON public.solutions (reviewed_by);
