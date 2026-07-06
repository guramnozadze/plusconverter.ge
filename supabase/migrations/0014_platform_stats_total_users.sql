-- Adds a registered-users count to the public platform stats RPC, for the
-- promo banner's new user-count stat. Changing the return signature needs
-- the function dropped first — CREATE OR REPLACE can't alter OUT params.
drop function if exists public.get_platform_stats();

create function public.get_platform_stats()
returns table (total_orders bigint, total_points bigint, total_users bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.orders where status = 'completed')::bigint,
    (select coalesce(sum(points_amount), 0) from public.orders where status = 'completed')::bigint,
    (select count(*) from public.profiles)::bigint;
$$;
