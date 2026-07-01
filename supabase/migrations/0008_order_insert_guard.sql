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
