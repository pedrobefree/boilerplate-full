create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_organization_id_idx on public.activity_logs (organization_id, created_at desc);
create index if not exists activity_logs_actor_id_idx on public.activity_logs (actor_id, created_at desc);
create index if not exists activity_logs_entity_type_idx on public.activity_logs (entity_type, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "Org members can view activity logs" on public.activity_logs;
create policy "Org members can view activity logs"
on public.activity_logs
for select
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = activity_logs.organization_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "Org members can insert own activity logs" on public.activity_logs;
create policy "Org members can insert own activity logs"
on public.activity_logs
for insert
with check (
  public.is_super_admin()
  or (
    actor_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = activity_logs.organization_id
        and om.user_id = auth.uid()
    )
  )
);
