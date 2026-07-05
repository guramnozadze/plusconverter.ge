-- Public aggregate of completed orders (both directions), exposed via a
-- single-purpose RPC so we don't need to grant broad SELECT on orders
-- (which holds names/account numbers) just to show a homepage stat.
-- Superseded get_total_points_sold() also lives on, unused, but this is the
-- one the homepage activity line actually calls.
create or replace function public.get_platform_stats()
returns table (total_orders bigint, total_points bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    coalesce(sum(points_amount), 0)::bigint
  from public.orders
  where status = 'completed';
$$;
