-- Migration: Projects and Tasks Feature
-- Description: Updates projects table and creates tasks, task_notes, and project_members tables.

-- 1. Update Projects Table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS key_objective TEXT,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Update status check constraint
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check 
CHECK (status IN ('active', 'inactive', 'on_hold', 'completed', 'canceled'));

-- 2. Create Project Members Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- Enable RLS for project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 3. Create Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TIMESTAMPTZ,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 4. Create Task Notes Table
CREATE TABLE IF NOT EXISTS public.task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for task_notes
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;


-- RLS POLICIES --

-- Project Members Policies
-- Users can view members of projects they belong to OR if they are org members (simplified: if they can view the project, they can view its members)
CREATE POLICY "Users can view project members" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      -- Recycle the project visibility logic here (simplified for now)
    )
  );

-- Only project owners/creators or org admins should manage members (Skip complex logic for now, allow internal server actions to handle this mostly, but for safety:)
CREATE POLICY "Users can manage members if they access project" ON public.project_members
  FOR ALL USING (
     -- Allow all for now, rely on application logic + project access
     EXISTS (
        SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id
     )
  );


-- Tasks Policies
-- Users can view tasks if they have access to the project
CREATE POLICY "Users can view tasks of visible projects" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      -- (Here we rely on the project's RLS or organization membership)
      AND p.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create tasks if they satisfy project access" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND p.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update tasks if they satisfy project access" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND p.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete tasks if they satisfy project access" ON public.tasks
  FOR DELETE USING (
     EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND p.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );


-- Task Notes Policies
-- Similar to tasks, View/Create if you have access to the task (via project)
CREATE POLICY "Users can view notes" ON public.task_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_notes.task_id
      AND p.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create notes" ON public.task_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_notes.task_id
      AND p.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );
