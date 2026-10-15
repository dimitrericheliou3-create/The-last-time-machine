-- Keep review-pending solution images private from members who cannot view the solution.
DROP POLICY IF EXISTS "Workspace members can view solution images" ON storage.objects;
CREATE POLICY "Workspace members can view solution images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'solution-images'
  AND private.is_workspace_member(((storage.foldername(name))[1])::uuid)
  AND EXISTS (
    SELECT 1
    FROM public.solutions s
    WHERE s.workspace_id = (((storage.foldername(name))[1])::uuid)
      AND s.image_path = storage.objects.name
  )
);
