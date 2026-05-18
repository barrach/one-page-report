DROP POLICY IF EXISTS "Users can read assigned projects" ON public.projects;

CREATE POLICY "Authenticated can read all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (true);