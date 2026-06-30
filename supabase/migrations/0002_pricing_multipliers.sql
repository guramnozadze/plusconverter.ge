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
