# PLUS Converter (plusconverter.ge)

A mobile-first web app for buying & selling Bank of Georgia **PLUS points**. Visitors
sign in with Google, use a live converter (Buy GEL → points / Sell points → GEL), submit
an order, and pay to a bank account shown with a countdown timer. The owner controls
pricing and bank-account availability in realtime and tracks every order.

Trilingual: **Georgian (default), English, Russian**.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) + **Tailwind CSS v4**
- **Supabase** — Postgres, Google OAuth, Realtime, Row Level Security
- **next-intl** for i18n (`/` = ka, `/en`, `/ru`)

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

3. **Apply the schema** — run `supabase/migrations/0001_init.sql` in the Supabase SQL
   editor (or `supabase db push`). It creates the tables, RLS policies, the new-user
   trigger, the `is_admin()` / `mark_order_paid()` functions, enables Realtime, and seeds
   default settings + sample bank accounts.

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

- **Pricing**: the singleton `settings` row holds `buy_rate` / `sell_rate` (PLUS per GEL),
  enable toggles and the order timer. The converter subscribes to it via Realtime, so
  price changes appear live.
- **Orders**: created server-side (`lib/actions/orders.ts`) where the rate and amounts are
  recomputed from canonical settings — clients cannot forge a favorable rate. Owners mark
  orders completed/cancelled in the admin orders queue (also live via Realtime).
- **Scarcity**: bank accounts have `available` / `unavailable` / `sold_out` states shown
  to users to drive urgency.
- **Auth boundary**: `proxy.ts` (Next 16's renamed middleware) composes next-intl locale
  routing with Supabase session refresh in a single Node-runtime response.

## i18n

All UI strings live in `messages/{ka,en,ru}.json`. English is complete; **`ka.json` and
`ru.json` currently mirror English** — fill them with real Georgian/Russian translations
when ready (no code changes needed).

## Deploy

Vercel (Node 20.9+). Set the two `NEXT_PUBLIC_SUPABASE_*` env vars and add the production
domain to both Supabase Auth redirect URLs and the Google OAuth client.
