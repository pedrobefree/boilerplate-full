-- Seed file for test data
-- This creates a test user and organization

-- Note: Supabase Auth users are created via the dashboard or API
-- This seed file focuses on application data

-- Insert test organization (Befree Academy should already exist from migration)
-- We'll add a test user profile that can be linked after signup

-- You can add sample categories, tags, or products here for testing
INSERT INTO public.categories (name, slug, description) VALUES
('Digital Products', 'digital-products', 'Digital downloads and subscriptions'),
('Physical Products', 'physical-products', 'Tangible goods and merchandise'),
('Services', 'services', 'Professional services and consulting')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tags (name, color) VALUES
('New', '#10B981'),
('Featured', '#F59E0B'),
('Sale', '#EF4444')
ON CONFLICT (name) DO NOTHING;
