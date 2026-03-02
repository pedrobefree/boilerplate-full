-- Categories (Nested)
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  image_url text,
  parent_id uuid references categories(id),
  created_at timestamptz default now()
);

-- Tags
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text default '#000000',
  created_at timestamptz default now()
);

-- Update Products (add columns only if they don't exist)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'category_id') then
        alter table products add column category_id uuid references categories(id);
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'featured_image_index') then
        alter table products add column featured_image_index int default 0;
    end if;
end $$;

-- Product Images (Gallery)
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text references products(id) on delete cascade,
  url text not null,
  display_order int default 0
);

-- Product Tags (Many-to-Many)
create table if not exists product_tags (
  product_id text references products(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (product_id, tag_id)
);

-- Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  organization_id uuid references organizations(id),
  status text check (status in ('pending', 'processing', 'completed', 'cancelled')),
  total_amount bigint,
  currency text,
  stripe_payment_intent_id text,
  billing_details jsonb,
  created_at timestamptz default now()
);

-- Order Items
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id text references products(id),
  price_id text,
  quantity int default 1,
  unit_amount bigint
);

-- RLS Policies

-- Categories: Public read, Admin write
alter table categories enable row level security;
drop policy if exists "Public read categories" on categories;
create policy "Public read categories" on categories for select using (true);
drop policy if exists "Admins write categories" on categories;
create policy "Admins write categories" on categories for all using (public.is_super_admin());

-- Tags: Public read, Admin write
alter table tags enable row level security;
drop policy if exists "Public read tags" on tags;
create policy "Public read tags" on tags for select using (true);
drop policy if exists "Admins write tags" on tags;
create policy "Admins write tags" on tags for all using (public.is_super_admin());

-- Product Images: Public read, Admin write
alter table product_images enable row level security;
drop policy if exists "Public read product_images" on product_images;
create policy "Public read product_images" on product_images for select using (true);
drop policy if exists "Admins write product_images" on product_images;
create policy "Admins write product_images" on product_images for all using (public.is_super_admin());

-- Product Tags: Public read, Admin write
alter table product_tags enable row level security;
drop policy if exists "Public read product_tags" on product_tags;
create policy "Public read product_tags" on product_tags for select using (true);
drop policy if exists "Admins write product_tags" on product_tags;
create policy "Admins write product_tags" on product_tags for all using (public.is_super_admin());

-- Orders: Users read own, Admins read org's
alter table orders enable row level security;
drop policy if exists "Users manage own orders" on orders;
create policy "Users manage own orders" on orders for all using (auth.uid() = user_id);
drop policy if exists "Admins view org orders" on orders;
create policy "Admins view org orders" on orders for select using (
  exists (
    select 1 from organization_members
    where organization_id = orders.organization_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  )
);

-- Order Items: Inherit from Order
alter table order_items enable row level security;
create policy "Users manage own order items" on order_items for all using (
  exists (
    select 1 from orders
    where orders.id = order_items.order_id
    and orders.user_id = auth.uid()
  )
);
create policy "Admins view org order items" on order_items for select using (
  exists (
    select 1 from orders
    join organization_members on orders.organization_id = organization_members.organization_id
    where orders.id = order_items.order_id
    and organization_members.user_id = auth.uid()
    and organization_members.role in ('owner', 'admin')
  )
);
