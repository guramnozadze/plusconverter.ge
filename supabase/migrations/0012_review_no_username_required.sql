-- PLUS Converter — allow reviews without a set username.
-- submit_review used to require a profile username and raise 'no_username'
-- otherwise, nudging the user to set one first. Relax that: fall back to a
-- masked email, same as handle_order_completed's existing fallback in
-- 0011_masked_email_display_name.sql, so any completed-order owner can
-- review. Factor the shared fallback logic into one function so the two
-- call sites can't drift apart.
-- Apply via the Supabase SQL editor or `supabase db push`.

create or replace function public.masked_display_name(p_username text, p_email text)
returns text
language plpgsql
immutable
as $$
declare
  v_local text;
  v_len   integer;
begin
  if p_username is not null and trim(p_username) <> '' then
    return trim(p_username);
  end if;

  if p_email is not null and trim(p_email) <> '' then
    v_local := split_part(trim(p_email), '@', 1);
    v_len := length(v_local);
    -- Only mask if the shown first/last 2 characters don't overlap; too
    -- short to safely do that just falls back to 'Anonymous'.
    if v_len >= 4 then
      return substr(v_local, 1, 2) || '******' || substr(v_local, v_len - 1, 2);
    end if;
  end if;

  return 'Anonymous';
end;
$$;

create or replace function public.handle_order_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_email    text;
begin
  select nullif(trim(username), ''), nullif(trim(email), '')
    into v_username, v_email
  from public.profiles
  where id = new.user_id;

  insert into public.reviews (order_id, display_name, direction, points_amount)
  values (
    new.id,
    public.masked_display_name(v_username, v_email),
    new.direction,
    new.points_amount
  )
  on conflict (order_id) do nothing;
  return new;
end;
$$;

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
  v_username     text;
  v_email        text;
  v_display_name text;
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

  select nullif(trim(username), ''), nullif(trim(email), '')
    into v_username, v_email
  from public.profiles where id = auth.uid();

  v_display_name := public.masked_display_name(v_username, v_email);

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating';
  end if;

  -- One-time / immutable: only fill a row that hasn't been rated yet.
  update public.reviews
  set rating       = p_rating,
      comment      = nullif(trim(p_comment), ''),
      display_name = v_display_name
  where order_id = p_order_id
    and rating is null;

  if not found then
    raise exception 'already_reviewed';
  end if;
end;
$$;
