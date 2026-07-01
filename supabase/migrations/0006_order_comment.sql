-- PLUS Converter — optional order comment.
-- Lets a user attach a free-text note to their order (e.g. a phone number for
-- support to reach them). Snapshotted onto the order row like the other
-- user-supplied details; covered by existing orders RLS (insert own /
-- select own-or-admin), so only the order's owner and admins can read it.
-- Apply via the Supabase SQL editor or `supabase db push`.

alter table public.orders
  add column if not exists comment text;
