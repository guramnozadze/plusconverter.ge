-- PLUS Converter — initial schema, RLS, triggers, realtime and seed data.
-- Apply via the Supabase SQL editor or `supabase db push`.

-- =========================================================================
-- Tables
-- =========================================================================

-- One row per authenticated user, auto-created by a trigger on auth.users.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  username   text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Single-row global configuration the owner edits live (id is pinned to 1).
create table if not exists public.settings (
  id            integer primary key default 1,
  buy_rate      numeric(12, 4) not null default 400,   -- PLUS points per GEL when buying
  sell_rate     numeric(12, 4) not null default 400,   -- PLUS points per GEL when selling
  buy_enabled   boolean not null default true,
  sell_enabled  boolean not null default true,
  timer_minutes integer not null default 30,
  updated_at    timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

-- Owner's bank accounts; `status` drives the scarcity UI.
create table if not exists public.bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  bank_name      text not null,
  account_name   text not null,
  account_number text not null,
  status         text not null default 'available'
                 check (status in ('available', 'unavailable', 'sold_out')),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  direction       text not null check (direction in ('buy', 'sell')),
  gel_amount      numeric(12, 2) not null check (gel_amount > 0),
  points_amount   numeric(14, 2) not null check (points_amount > 0),
  rate_used       numeric(12, 4) not null,
  bank_account_id uuid references public.bank_accounts (id) on delete set null,
  status          text not null default 'pending'
                  check (status in ('pending', 'completed', 'cancelled')),
  user_confirmed  boolean not null default false,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);

-- =========================================================================
-- Helper functions & triggers
-- =========================================================================

-- SECURITY DEFINER so it bypasses RLS (prevents recursion in profiles policies).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Let a user mark their own pending order as paid without granting a broad
-- UPDATE policy (which would let them self-complete an order).
create or replace function public.mark_order_paid(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
  set user_confirmed = true
  where id = p_order_id
    and user_id = auth.uid()
    and status = 'pending';
$$;

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.profiles      enable row level security;
alter table public.settings      enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.orders        enable row level security;

-- profiles: read own (or any as admin), update own.
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- settings: world-readable (converter works logged-out), admin-only writes.
create policy "settings_select_all" on public.settings
  for select using (true);
create policy "settings_write_admin" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- bank_accounts: world-readable (scarcity states are public), admin-only writes.
create policy "bank_accounts_select_all" on public.bank_accounts
  for select using (true);
create policy "bank_accounts_write_admin" on public.bank_accounts
  for all using (public.is_admin()) with check (public.is_admin());

-- orders: a user inserts/reads their own; admin reads & updates all.
create policy "orders_insert_own" on public.orders
  for insert with check (user_id = auth.uid());
create policy "orders_select_own_or_admin" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());
create policy "orders_update_admin" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- Realtime (live price + scarcity + order updates)
-- =========================================================================

alter table public.settings      replica identity full;
alter table public.bank_accounts replica identity full;
alter table public.orders        replica identity full;

alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.bank_accounts;
alter publication supabase_realtime add table public.orders;

-- =========================================================================
-- Seed data
-- =========================================================================

insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.bank_accounts (bank_name, account_name, account_number, status, sort_order)
values
  ('Bank of Georgia', 'G. Nozadze', 'GE00BG0000000000000000', 'available', 1),
  ('TBC Bank',        'G. Nozadze', 'GE00TB0000000000000000', 'available', 2),
  ('Bank of Georgia', 'G. Nozadze', 'GE00BG1111111111111111', 'sold_out', 3),
  ('TBC Bank',        'G. Nozadze', 'GE00TB2222222222222222', 'unavailable', 4)
on conflict do nothing;

-- After your first Google login, promote yourself to admin:
--   update public.profiles set is_admin = true where email = 'you@example.com';
