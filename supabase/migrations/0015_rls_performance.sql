-- Performance advisor fixes (0 live users right now, safe to rewrite policies):
--
-- 1. Wrap auth.uid()/is_admin() calls in RLS policies as `(select ...)` so
--    Postgres evaluates them once per statement (InitPlan) instead of once per
--    row. See https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- 2. Split bank_accounts_write_admin/settings_write_admin off SELECT so they
--    no longer overlap with the public select-all policies ("multiple
--    permissive policies" - Postgres was evaluating two policies per read).
-- 3. Add the missing orders.bank_account_id FK index.
-- 4. Pin masked_display_name's search_path (flagged as mutable).

-- profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using (id = (select auth.uid()) or (select is_admin()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- orders
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders
  for select
  using (user_id = (select auth.uid()) or (select is_admin()));

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin" on public.orders
  for update
  using ((select is_admin()))
  with check ((select is_admin()));

create index if not exists orders_bank_account_id_idx
  on public.orders (bank_account_id);

-- reviews
drop policy if exists "reviews_update_admin" on public.reviews;
create policy "reviews_update_admin" on public.reviews
  for update
  using ((select is_admin()))
  with check ((select is_admin()));

-- bank_accounts: admin policy split by command so it no longer overlaps
-- bank_accounts_select_all for SELECT.
drop policy if exists "bank_accounts_write_admin" on public.bank_accounts;
create policy "bank_accounts_insert_admin" on public.bank_accounts
  for insert
  with check ((select is_admin()));
create policy "bank_accounts_update_admin" on public.bank_accounts
  for update
  using ((select is_admin()))
  with check ((select is_admin()));
create policy "bank_accounts_delete_admin" on public.bank_accounts
  for delete
  using ((select is_admin()));

-- settings: app only ever updates the singleton row, so the admin policy
-- only needs to cover UPDATE (was FOR ALL, overlapping settings_select_all).
drop policy if exists "settings_write_admin" on public.settings;
create policy "settings_update_admin" on public.settings
  for update
  using ((select is_admin()))
  with check ((select is_admin()));

alter function public.masked_display_name(text, text) set search_path = '';
