-- PLUS Converter — mask the user's email instead of a generic 'Anonymous'
-- label for reviews from users who never set a username, so the public feed
-- doesn't show a wall of identical "@Anonymous" entries. Only the local part
-- (before @) is ever touched: its first 2 and last 2 characters are shown,
-- with a fixed 6-char mask in between (fixed-width, so the real local-part
-- length is never revealed) — the domain is never shown at all.
--
-- This only changes what NEW order completions get: existing reviews keep
-- whatever display_name they already snapshotted (no backfill).
-- Apply via the Supabase SQL editor or `supabase db push`.

create or replace function public.handle_order_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_email    text;
  v_local    text;
  v_len      integer;
  v_display  text;
begin
  select nullif(trim(username), ''), nullif(trim(email), '')
    into v_username, v_email
  from public.profiles
  where id = new.user_id;

  if v_username is not null then
    v_display := v_username;
  elsif v_email is not null then
    v_local := split_part(v_email, '@', 1);
    v_len := length(v_local);
    -- Only mask if the shown first/last 2 characters don't overlap; too
    -- short to safely do that just falls back.
    if v_len >= 4 then
      v_display := substr(v_local, 1, 2) || '******' || substr(v_local, v_len - 1, 2);
    else
      v_display := 'Anonymous';
    end if;
  else
    v_display := 'Anonymous';
  end if;

  insert into public.reviews (order_id, display_name, direction, points_amount)
  values (new.id, v_display, new.direction, new.points_amount)
  on conflict (order_id) do nothing;
  return new;
end;
$$;
