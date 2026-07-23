# PLUS Converter

![PLUS Converter](public/plusoncverter-cover.png)

**Live at [plusconverter.ge](https://plusconverter.ge/en)** — a mobile-first exchange for
Bank of Georgia **PLUS loyalty points**, running as a real single-operator business.
Users sign in with Google, get a live quote, place a buy or sell order, and settle by
bank transfer against a countdown timer; the operator manages pricing, inventory, and
the order queue from a realtime admin panel.

Bilingual (Georgian default / English) · **Next.js 16** · **Supabase** · **TypeScript** · **Tailwind v4**

## Engineering highlights

This is a small production system, not a tutorial build. The parts worth reading:

- **Server-authoritative pricing, with defense in depth.** The client-side converter is
  a preview only. `createOrder` ([`lib/actions/orders.ts`](lib/actions/orders.ts))
  ignores client-sent amounts and recomputes the rate and both legs from the canonical
  `settings` row — [`lib/pricing.ts`](lib/pricing.ts) is shared by the preview and the
  server so the math can't drift. Then a Postgres `BEFORE INSERT` trigger
  ([`0008_order_insert_guard.sql`](supabase/migrations/0008_order_insert_guard.sql))
  re-validates thresholds and recomputes the same fields *again*, so even a direct
  PostgREST call that bypasses the server action can't store a forged price. The trigger
  also caps each user at 4 concurrent pending orders.
- **RLS-first security model.** Every table has Row Level Security; the browser only
  ever holds the publishable key. Users can't self-complete orders: the state
  transitions they're allowed to make (`mark_order_paid`, `submit_review`) are narrow
  `SECURITY DEFINER` RPCs rather than broad `UPDATE` policies, so the allowed writes are
  exactly enumerated in SQL.
- **Realtime by default.** Pricing, per-direction min/max thresholds, and enable toggles
  live in a singleton `settings` row the converter subscribes to via Supabase Realtime —
  when the operator reprices, open sessions update without a refresh. The admin order
  queue and bank-account availability update the same way.
- **Current-generation Next.js.** App Router on Next 16: Server Components by default,
  mutations through server actions, and [`proxy.ts`](proxy.ts) (Next 16's successor to
  `middleware.ts`) composing next-intl locale routing and Supabase session refresh into
  a single Node-runtime response.
- **Locale-routed i18n.** `/` is Georgian, `/en` is English (next-intl v4). Every
  user-facing string lives in ICU message catalogs (`messages/{ka,en}.json`) with
  English as the source of truth for keys; navigation goes through locale-aware wrappers
  so links never drop the prefix.

## How it works

PLUS points have a fixed bank face value of **400 points = 1 GEL**. The operator sets a
buy and a sell multiplier on top of that base; a quote is `gel = points / 400 ×
multiplier`. The canonical order input is always **points** — for buy orders the client
converts the entered GEL amount to points first, and the server derives the GEL leg. The
converter deliberately shows only the face value, never the multiplier.

Order lifecycle:

1. **Converter** (`Converter.tsx`) — live quote, direction toggle, threshold validation.
2. **Account picker** (`/order/new`) — user chooses a payout/deposit bank account;
   accounts carry `available` / `unavailable` / `sold_out` states the operator flips in
   realtime. The chosen account is re-validated as available server-side.
3. **Order page** (`/order/[id]`) — payment instructions with a countdown timer; the
   user confirms payment via the `mark_order_paid` RPC.
4. **Admin queue** (`/admin`) — the operator completes or cancels; completion fires a
   trigger that auto-creates a **review** row the customer can rate once. The public
   review feed is post-then-moderate (hide/unhide from `/admin/reviews`).

## Architecture

```
app/[locale]/          Locale-routed pages: converter, order/new, order/[id], admin
app/auth/callback/     Non-localized OAuth code exchange
proxy.ts               next-intl routing + Supabase session refresh (Node runtime)
components/            Client components (Converter, AccountPicker, OrderView, admin/*)
lib/actions/           Server actions: orders, admin, profile, reviews
lib/pricing.ts         Canonical conversion math (shared client/server)
lib/supabase/          Browser/server/middleware clients + hand-maintained DB types
i18n/ · messages/      Routing config and ICU message catalogs (ka, en)
supabase/migrations/   Numbered schema: tables, RLS, triggers, RPCs, Realtime, seed
```

### Data model

| Table | Purpose | Writes |
|---|---|---|
| `profiles` | User rows auto-created on signup (`handle_new_user` trigger); `is_admin` flag | Own row; admin via policy |
| `settings` | Singleton: multipliers, thresholds, toggles, order timer | Admin only |
| `bank_accounts` | Operator accounts with availability states | Admin only |
| `orders` | Snapshotted rate + both legs; status machine | Insert guarded by trigger; user transitions via RPC; admin via policy |
| `reviews` | Auto-created on completion; one rating per order | `submit_review` RPC; moderation via policy |

## Running locally

1. `npm install`
2. Create a [Supabase](https://supabase.com) project and copy its credentials into
   `.env.local` (see `.env.example`):

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. Apply `supabase/migrations/` in order (or `supabase db push`). `0001_init.sql`
   creates tables, RLS policies, triggers, and RPCs, enables Realtime, and seeds default
   settings; later migrations layer on the multiplier pricing model, reviews,
   thresholds, and the order-insert guard.
4. Enable **Google OAuth** in Supabase → Authentication → Providers, backed by a Google
   Cloud OAuth client with the redirect URL Supabase shows you.
5. `npm run dev`, sign in once, then promote yourself in the SQL editor:

   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```

   The **Admin** link appears in the header.

`npm run build` doubles as the full typecheck; `npm run lint` for ESLint.

## Deployment

Vercel (Node 20.9+). Set the two `NEXT_PUBLIC_SUPABASE_*` env vars and register the
production domain with both Supabase Auth redirect URLs and the Google OAuth client.

## Trade-offs, deliberately made

- **Hand-maintained DB types** (`lib/supabase/types.ts`) instead of codegen — the schema
  is small and the types double as documentation; kept in lockstep with migrations.
- **Manual bank-transfer settlement** instead of a payment provider — matches how this
  market actually operates and keeps the operator in the loop on every order.
- **No secret-key server path yet** — everything runs through RLS with the publishable
  key, which keeps the security story auditable in one place: the migration files.
