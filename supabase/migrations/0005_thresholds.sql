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
