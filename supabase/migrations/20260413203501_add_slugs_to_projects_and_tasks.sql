-- Migration: Add Slugs to Projects and Tasks
-- Description: Adds slug columns and populates them based on title/name.

-- 1. Add slug columns safely
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'slug') THEN
        ALTER TABLE public.projects ADD COLUMN slug TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'slug') THEN
        ALTER TABLE public.tasks ADD COLUMN slug TEXT;
    END IF;
END $$;

-- 2. Create slugify function (already idempotent with OR REPLACE)
CREATE OR REPLACE FUNCTION public.slugify(v_text TEXT) RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
BEGIN
  v_slug := lower(v_text);
  v_slug := regexp_replace(v_slug, '[^a-z0-9\s-]', '', 'g');
  v_slug := regexp_replace(v_slug, '\s+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  RETURN v_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Populate existing projects (where slug is null)
UPDATE public.projects SET slug = slugify(name) WHERE slug IS NULL;

-- 4. Populate existing tasks (where slug is null)
UPDATE public.tasks SET slug = slugify(title) WHERE slug IS NULL;

-- 5. Handle potential collisions (append short ID)
UPDATE public.projects p
SET slug = slug || '-' || left(id::text, 4)
WHERE EXISTS (
  SELECT 1 FROM public.projects p2 
  WHERE p2.slug = p.slug 
  AND p2.organization_id = p.organization_id 
  AND p2.id <> p.id
) AND slug NOT LIKE '%-%' || left(id::text, 4);

UPDATE public.tasks t
SET slug = slug || '-' || left(id::text, 4)
WHERE EXISTS (
  SELECT 1 FROM public.tasks t2 
  WHERE t2.slug = t.slug 
  AND t2.project_id = t.project_id 
  AND t2.id <> t.id
) AND slug NOT LIKE '%-%' || left(id::text, 4);

-- 6. Add constraints safely
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_organization_slug_key') THEN
        ALTER TABLE public.projects ADD CONSTRAINT projects_organization_slug_key UNIQUE (organization_id, slug);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tasks_project_slug_key') THEN
        ALTER TABLE public.tasks ADD CONSTRAINT tasks_project_slug_key UNIQUE (project_id, slug);
    END IF;
END $$;

-- 7. Add NOT NULL constraint
ALTER TABLE public.projects ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN slug SET NOT NULL;
