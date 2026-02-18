
-- Create projects table storing all project data as JSONB
CREATE TABLE public.projects (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Public read/write (no auth required - shared report tool)
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

-- Auto update timestamp
CREATE OR REPLACE FUNCTION public.update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_projects_updated_at();
