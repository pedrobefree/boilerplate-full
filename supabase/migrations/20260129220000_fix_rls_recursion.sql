-- Fix Infinite Recursion in RLS
-- Use security definer function to fetch user organizations to break recursion loop

-- 1. Create helper function to get my org IDs (Bypassing RLS)
CREATE OR REPLACE FUNCTION public.get_auth_user_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public -- Secure search path
STABLE
AS $$
  SELECT ARRAY(
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  );
$$;

-- 2. Update Organization Members Policy
DROP POLICY IF EXISTS "Users can view org memberships" ON public.organization_members;
CREATE POLICY "Users can view org memberships"
  ON public.organization_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    organization_id = ANY(get_auth_user_org_ids())
  );

-- 3. Update Projects Policy
DROP POLICY IF EXISTS "Users can view org projects" ON public.projects;
CREATE POLICY "Users can view org projects"
  ON public.projects FOR SELECT
  USING (
    organization_id = ANY(get_auth_user_org_ids())
  );
  
DROP POLICY IF EXISTS "Users can insert org projects" ON public.projects;
CREATE POLICY "Users can insert org projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    organization_id = ANY(get_auth_user_org_ids())
  );

DROP POLICY IF EXISTS "Users can update org projects" ON public.projects;
CREATE POLICY "Users can update org projects"
  ON public.projects FOR UPDATE
  USING (
    organization_id = ANY(get_auth_user_org_ids())
  );

-- 4. Update Tasks Policy (from projects_and_tasks.sql)
DROP POLICY IF EXISTS "Users can view tasks of visible projects" ON public.tasks;
CREATE POLICY "Users can view tasks of visible projects" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND p.organization_id = ANY(get_auth_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "Users can create tasks if they satisfy project access" ON public.tasks;
CREATE POLICY "Users can create tasks if they satisfy project access" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND p.organization_id = ANY(get_auth_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "Users can update tasks if they satisfy project access" ON public.tasks;
CREATE POLICY "Users can update tasks if they satisfy project access" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND p.organization_id = ANY(get_auth_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "Users can delete tasks if they satisfy project access" ON public.tasks;
CREATE POLICY "Users can delete tasks if they satisfy project access" ON public.tasks
  FOR DELETE USING (
     EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND p.organization_id = ANY(get_auth_user_org_ids())
    )
  );
  
-- 5. Update Task Notes Policy
DROP POLICY IF EXISTS "Users can view notes" ON public.task_notes;
CREATE POLICY "Users can view notes" ON public.task_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_notes.task_id
      AND p.organization_id = ANY(get_auth_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "Users can create notes" ON public.task_notes;
CREATE POLICY "Users can create notes" ON public.task_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_notes.task_id
      AND p.organization_id = ANY(get_auth_user_org_ids())
    )
  );
