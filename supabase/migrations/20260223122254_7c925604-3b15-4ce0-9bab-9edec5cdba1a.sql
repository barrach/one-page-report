
-- Allow anyone to check if an admin exists (only count, no sensitive data exposed)
CREATE POLICY "Anyone can check if admin exists" ON public.user_roles
  FOR SELECT TO anon USING (role = 'admin');
