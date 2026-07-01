-- ==== 0001_init.sql ====
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

-- ==== 0002_pricing_multipliers.sql ====
-- Switch pricing from points-per-GEL rates to multipliers on the fixed
-- 400-points-per-GEL base value. Apply after 0001.

alter table public.settings rename column buy_rate to buy_multiplier;
alter table public.settings rename column sell_rate to sell_multiplier;

alter table public.settings alter column buy_multiplier set default 1.5;
alter table public.settings alter column sell_multiplier set default 1.5;

-- Old values were points-per-GEL rates (e.g. 300, 400) which are meaningless as
-- multipliers, so reset the seeded row to a sane default. Adjust later in admin.
update public.settings
set buy_multiplier = 1.5, sell_multiplier = 1.5
where id = 1;

-- ==== 0003_user_bank_info.sql ====
-- PLUS Converter — user bank details.
-- Lets a user store default bank details (for receiving GEL when selling) and
-- snapshots the details used onto each order so historical orders never change.
-- Apply via the Supabase SQL editor or `supabase db push`.

-- User-editable defaults. Kept private by the existing profiles RLS
-- (select own-or-admin, update own) — deliberately NOT world-readable, so only
-- `username` is ever surfaced to others.
alter table public.profiles
  add column if not exists full_name      text,
  add column if not exists account_number text;

-- Per-order snapshot of the bank details the user used at creation time.
-- Covered by existing orders RLS (insert own / select own-or-admin).
alter table public.orders
  add column if not exists user_full_name      text,
  add column if not exists user_account_number text;

-- ==== 0004_reviews.sql ====
-- PLUS Converter — community reviews / activity feed.
-- One row per completed order, auto-created by a trigger. World-readable (social
-- proof) but deliberately DENORMALIZED: it stores a snapshot display name and
-- amount and NEVER stores user_id, so the public read cannot deanonymize users.
-- The optional star rating + comment are filled in later via a SECURITY DEFINER
-- RPC that verifies order ownership.
-- Apply via the Supabase SQL editor or `supabase db push`.

-- =========================================================================
-- Table
-- =========================================================================

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references public.orders (id) on delete cascade,
  display_name  text not null,                       -- snapshot: username or 'Anonymous'
  direction     text not null check (direction in ('buy', 'sell')),
  points_amount numeric(14, 2) not null,             -- snapshot (GEL is kept private)
  rating        integer check (rating between 1 and 5),
  comment       text,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists reviews_created_at_idx on public.reviews (created_at desc);

-- =========================================================================
-- Auto-post: create a feed row when an order transitions to completed.
-- =========================================================================

create or replace function public.handle_order_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reviews (order_id, display_name, direction, points_amount)
  values (
    new.id,
    coalesce(
      (select nullif(trim(username), '') from public.profiles where id = new.user_id),
      'Anonymous'
    ),
    new.direction,
    new.points_amount
  )
  on conflict (order_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_order_completed on public.orders;
create trigger on_order_completed
  after update of status on public.orders
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.handle_order_completed();

-- =========================================================================
-- Review submission: fill in rating + comment once, for your own completed order.
-- =========================================================================

create or replace function public.submit_review(
  p_order_id uuid,
  p_rating   integer,
  p_comment  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  -- Must own the order and it must be completed.
  if not exists (
    select 1 from public.orders
    where id = p_order_id
      and user_id = auth.uid()
      and status = 'completed'
  ) then
    raise exception 'order_not_reviewable';
  end if;

  -- A username is required to leave a review (nudge the user to set one).
  select nullif(trim(username), '') into v_username
  from public.profiles where id = auth.uid();
  if v_username is null then
    raise exception 'no_username';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating';
  end if;

  -- One-time / immutable: only fill a row that hasn't been rated yet.
  update public.reviews
  set rating       = p_rating,
      comment      = nullif(trim(p_comment), ''),
      display_name = v_username
  where order_id = p_order_id
    and rating is null;

  if not found then
    raise exception 'already_reviewed';
  end if;
end;
$$;

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.reviews enable row level security;

-- Public feed: anyone reads non-hidden rows; admin reads all. No public
-- insert/update — writes go only through the trigger + submit_review RPC.
create policy "reviews_select_public" on public.reviews
  for select using (hidden = false or public.is_admin());
create policy "reviews_update_admin" on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- Realtime (live community feed)
-- =========================================================================

alter table public.reviews replica identity full;
alter publication supabase_realtime add table public.reviews;

-- ==== 0005_thresholds.sql ====
-- Per-direction min/max thresholds, admin-managed. 0 means "no limit" for a
-- given field (no minimum required / no cap applied) so existing behavior is
-- unchanged until the admin sets a real value.
--
-- Mins are on the "give" leg (what the user hands over): GEL for buy, points
-- for sell. Buy max is the points leg directly (available inventory to buy).
-- Sell max is expressed in GEL — the admin's actual constraint is cash on
-- hand to pay sellers, not a points count — and the equivalent points cap
-- shown to users is derived from this at the current sell rate.
alter table public.settings
  add column if not exists buy_min_gel      numeric(12, 2) not null default 0 check (buy_min_gel >= 0),
  add column if not exists buy_max_points   numeric(14, 2) not null default 0 check (buy_max_points >= 0),
  add column if not exists sell_min_points  numeric(14, 2) not null default 0 check (sell_min_points >= 0),
  add column if not exists sell_max_gel     numeric(12, 2) not null default 0 check (sell_max_gel >= 0);

-- ==== 0006_order_comment.sql ====
-- PLUS Converter — optional order comment.
-- Lets a user attach a free-text note to their order (e.g. a phone number for
-- support to reach them). Snapshotted onto the order row like the other
-- user-supplied details; covered by existing orders RLS (insert own /
-- select own-or-admin), so only the order's owner and admins can read it.
-- Apply via the Supabase SQL editor or `supabase db push`.

alter table public.orders
  add column if not exists comment text;

-- ==== 0007_username_unique.sql ====
-- PLUS Converter — enforce unique usernames.
-- Case-insensitive so "Kvara7" and "kvara7" can't collide; the partial index
-- skips NULLs, so having no username set is unrestricted.
-- Apply via the Supabase SQL editor or `supabase db push`.

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

-- ==== 0008_order_insert_guard.sql ====
-- The `orders_insert_own` RLS policy only checks `user_id = auth.uid()`; it
-- does not constrain status/gel_amount/points_amount/rate_used. That means a
-- user could bypass `createOrder` entirely via a direct PostgREST insert
-- (forging a favorable rate, or inserting with status = 'completed' outright,
-- which — via the reviews trigger in 0004 — would let them mint a fake public
-- review with no real transaction). This trigger makes the database itself
-- the source of truth for the fields that matter, so no insert path (present
-- or future) can bypass them.

create or replace function public.guard_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.settings%rowtype;
  multiplier numeric(12, 4);
  give_amount numeric(14, 2);
  min_give numeric(14, 2);
  max_points numeric(14, 2);
  pending_count integer;
  picked_status text;
begin
  select * into s from public.settings where id = 1;
  if not found then
    raise exception 'no_settings';
  end if;

  if new.direction = 'buy' and not s.buy_enabled then
    raise exception 'direction_disabled';
  end if;
  if new.direction = 'sell' and not s.sell_enabled then
    raise exception 'direction_disabled';
  end if;

  -- Recompute the money leg server-side; never trust a client-supplied value.
  multiplier := case when new.direction = 'buy' then s.buy_multiplier else s.sell_multiplier end;
  new.rate_used := multiplier;
  new.gel_amount := round((new.points_amount / 400) * multiplier, 2);

  -- Re-validate thresholds (0 = no limit), mirroring lib/pricing.ts.
  if new.direction = 'buy' then
    give_amount := new.gel_amount;
    min_give := s.buy_min_gel;
    max_points := s.buy_max_points;
  else
    give_amount := new.points_amount;
    min_give := s.sell_min_points;
    max_points := case
      when s.sell_max_gel <= 0 then 0
      else round((s.sell_max_gel / s.sell_multiplier) * 400, 2)
    end;
  end if;
  if min_give > 0 and give_amount < min_give then
    raise exception 'below_minimum';
  end if;
  if max_points > 0 and new.points_amount > max_points then
    raise exception 'above_maximum';
  end if;

  -- New orders always start pending and unconfirmed, regardless of input.
  new.status := 'pending';
  new.user_confirmed := false;
  new.completed_at := null;

  -- Cap concurrent unfinished orders per user.
  select count(*) into pending_count
  from public.orders
  where user_id = new.user_id and status = 'pending';
  if pending_count >= 4 then
    raise exception 'order_limit_reached';
  end if;

  -- If a bank account was supplied, it must actually be available.
  if new.bank_account_id is not null then
    select status into picked_status
    from public.bank_accounts
    where id = new.bank_account_id;
    if picked_status is distinct from 'available' then
      raise exception 'account_unavailable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_order_insert on public.orders;
create trigger guard_order_insert
  before insert on public.orders
  for each row execute function public.guard_order_insert();

