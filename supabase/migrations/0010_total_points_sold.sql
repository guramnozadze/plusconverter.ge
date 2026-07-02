-- Public aggregate of PLUS points sold to customers (completed buy orders),
-- exposed via a single-purpose RPC so we don't need to grant broad SELECT on
-- orders (which holds names/account numbers) just to show a homepage stat.
create or replace function public.get_total_points_sold()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(points_amount), 0)::bigint
  from public.orders
  where direction = 'buy'
    and status = 'completed';
$$;
