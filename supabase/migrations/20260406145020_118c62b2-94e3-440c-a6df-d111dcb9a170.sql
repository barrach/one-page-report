
-- Allow anonymous read access to projects
CREATE POLICY "Public read access" ON public.projects FOR SELECT TO anon USING (true);

-- Allow anonymous insert access to projects
CREATE POLICY "Public insert access" ON public.projects FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous update access to projects
CREATE POLICY "Public update access" ON public.projects FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Allow anonymous delete access to projects
CREATE POLICY "Public delete access" ON public.projects FOR DELETE TO anon USING (true);
