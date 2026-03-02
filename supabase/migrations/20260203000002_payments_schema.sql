-- US-02: Payment Infrastructure (Stripe + Supabase)

-- 1. Create Products Table (Mirrors Stripe Products)
create table public.products (
  id text primary key,
  active boolean,
  name text,
  description text,
  image text,
  metadata jsonb
);

-- 2. Create Prices Table (Mirrors Stripe Prices)
create table public.prices (
  id text primary key,
  product_id text references public.products,
  active boolean,
  description text,
  unit_amount bigint,
  currency text not null check (char_length(currency) = 3),
  type text, -- 'one_time' or 'recurring'
  interval text, -- 'day', 'week', 'month', 'year'
  interval_count integer,
  trial_period_days integer,
  metadata jsonb
);

-- 3. Update Organizations Table (Add Customer ID & Subscription Status)
alter table public.organizations 
add column if not exists stripe_customer_id text,
add column if not exists billing_address jsonb,
add column if not exists payment_method jsonb;

-- 4. Create Subscriptions Table (Links Organizations to Stripe Subscriptions)
create table public.subscriptions (
  id text primary key,
  -- Link to Organization (B2B) instead of User
  organization_id uuid references public.organizations(id) not null,
  
  status text check (status in ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused')),
  metadata jsonb,
  price_id text references public.prices,
  quantity integer,
  cancel_at_period_end boolean,
  
  created timestamptz default timezone('utc', now()) not null,
  current_period_start timestamptz default timezone('utc', now()) not null,
  current_period_end timestamptz default timezone('utc', now()) not null,
  ended_at timestamptz default timezone('utc', now()),
  cancel_at timestamptz default timezone('utc', now()),
  canceled_at timestamptz default timezone('utc', now()),
  trial_start timestamptz default timezone('utc', now()),
  trial_end timestamptz default timezone('utc', now())
);

-- 5. RLS Policies

-- Products & Prices: Everyone can view active products/prices (for pricing page)
alter table public.products enable row level security;
create policy "Allow public read-only access to products" on public.products for select using (true);

alter table public.prices enable row level security;
create policy "Allow public read-only access to prices" on public.prices for select using (true);

-- Subscriptions: Users can only view their organization's subscription
alter table public.subscriptions enable row level security;

create policy "Users can view their organization's subscription" 
on public.subscriptions for select 
using (
  organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid()
  )
);

-- Only service role (server-side) can insert/update subscriptions via Webhooks
-- No insert/update policies for authenticated users on subscriptions.

-- Add Super Admin policy for subscriptions?
create policy "Super Admins can view all subscriptions" 
on public.subscriptions for select 
using (public.is_super_admin());
