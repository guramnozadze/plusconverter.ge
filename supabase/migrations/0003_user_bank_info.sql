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
