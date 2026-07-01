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
