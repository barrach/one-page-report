-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

DROP POLICY IF EXISTS "Admins and gestors can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and gestors can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can read assigned projects" ON public.projects;

DROP POLICY IF EXISTS "Admins can manage assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON public.project_assignments;

-- Disable RLS on all tables for public access
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;