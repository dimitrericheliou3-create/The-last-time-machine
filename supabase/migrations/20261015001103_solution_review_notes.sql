-- Allow reviewer feedback notes. The solution review trigger restricts writes to reviewers.
GRANT UPDATE (review_note) ON public.solutions TO authenticated;
