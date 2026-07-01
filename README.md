# PLUS Converter (plusconverter.ge)

A mobile-first web app for buying & selling Bank of Georgia **PLUS points**. Visitors
sign in with Google, use a live converter (Buy GEL → points / Sell points → GEL), submit
an order, and pay to a bank account shown with a countdown timer. The owner controls
pricing and bank-account availability in realtime and tracks every order.

Bilingual: **Georgian (default), English**.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) + **Tailwind CSS v4**
- **Supabase** — Postgres, Google OAuth, Realtime, Row Level Security
- **next-intl** for i18n (`/` = ka, `/en`)

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Create a Supabase project** and copy its API credentials into `.env.local`
   (see `.env.example`):

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. **Apply the schema** — run the migrations in `supabase/migrations/` in order (or
   `supabase db push`). `0001_init.sql` creates the tables, RLS policies, the new-user
   trigger, the `is_admin()` / `mark_order_paid()` functions, enables Realtime, and seeds
   default settings + sample bank accounts; `0002`–`0008` layer on the multiplier pricing
   model, user bank details, reviews, buy/sell thresholds, order comments, unique
   usernames, and the order-insert guard trigger.

4. **Enable Google OAuth** in Supabase → Authentication → Providers → Google. Add a
   Google Cloud OAuth client and set the authorized redirect URL Supabase shows you.
   Allow your app origins (`http://localhost:3000`, `https://plusconverter.ge`).

5. **Run**

   ```bash
   npm run dev
   ```

6. **Make yourself admin** — sign in once with Google, then in the SQL editor:

   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```

   The **Admin** link appears in the header; manage rates, bank accounts and orders at
   `/admin`.

## How it works

- **Pricing**: PLUS points have a fixed bank face value of 400 points per GEL. The
  singleton `settings` row holds `buy_multiplier` / `sell_multiplier` applied on top of
  that base rate, plus enable toggles, per-direction min/max thresholds, and the order
  timer. The converter subscribes to it via Realtime, so price changes appear live.
- **Orders**: created server-side (`lib/actions/orders.ts`), where the rate, amounts, and
  thresholds are recomputed from canonical settings — clients cannot forge a favorable
  rate. A database trigger (`0008_order_insert_guard.sql`) re-validates and recomputes the
  same fields on every insert, so this holds even against a direct API call that bypasses
  the server action, and also caps each user to 4 concurrent pending orders. Owners mark
  orders completed/cancelled in the admin orders queue (also live via Realtime).
- **Scarcity**: bank accounts have `available` / `unavailable` / `sold_out` states shown
  to users to drive urgency — there's a single real account in practice; the rest are
  marketing placeholders.
- **Reviews**: completing an order auto-creates a review row the buyer/seller can rate
  and comment on once; the public feed is post-then-moderate (admins hide/unhide from
  `/admin/reviews`).
- **Auth boundary**: `proxy.ts` (Next 16's renamed middleware) composes next-intl locale
  routing with Supabase session refresh in a single Node-runtime response.

## i18n

All UI strings live in `messages/{ka,en}.json`. Both are fully translated — English is
the source of truth for keys/structure; add a new string to both files at the same path
(same key set, same nesting) or the locale missing it will throw `MISSING_MESSAGE`.

## Deploy

Vercel (Node 20.9+). Set the two `NEXT_PUBLIC_SUPABASE_*` env vars and add the production
domain to both Supabase Auth redirect URLs and the Google OAuth client.
