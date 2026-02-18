
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can read projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can update projects" ON public.projects;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Anyone can read projects"
  ON public.projects FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update projects"
  ON public.projects FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete projects"
  ON public.projects FOR DELETE
  USING (true);
