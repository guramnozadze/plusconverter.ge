-- PLUS Converter — enforce unique usernames.
-- Case-insensitive so "Kvara7" and "kvara7" can't collide; the partial index
-- skips NULLs, so having no username set is unrestricted.
-- Apply via the Supabase SQL editor or `supabase db push`.

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;
