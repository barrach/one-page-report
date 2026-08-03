
-- Auto-grant admin role to the two corporate admin emails
CREATE OR REPLACE FUNCTION public.grant_admin_for_known_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) IN ('pedro.melecardi@megasteam.com.br','michel.zabalia@megasteam.com.br') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_megasteam_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_megasteam_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_known_emails();

-- Backfill for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role FROM auth.users u
WHERE lower(u.email) IN ('pedro.melecardi@megasteam.com.br','michel.zabalia@megasteam.com.br')
ON CONFLICT (user_id, role) DO NOTHING;

-- Lock down projects: no more anonymous access
DROP POLICY IF EXISTS "Public delete access" ON public.projects;
DROP POLICY IF EXISTS "Public insert access" ON public.projects;
DROP POLICY IF EXISTS "Public read access" ON public.projects;
DROP POLICY IF EXISTS "Public update access" ON public.projects;
REVOKE ALL ON public.projects FROM anon;

DROP POLICY IF EXISTS "Authenticated can read all projects" ON public.projects;
CREATE POLICY "Users read assigned projects"
ON public.projects FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_project_access(auth.uid(), id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
