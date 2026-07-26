<div align="center">

![PLUS Converter](public/plusoncverter-cover.png)

# PLUS Converter

**A live marketplace for Bank of Georgia PLUS loyalty points.**

[![Live site](https://img.shields.io/badge/live-plusconverter.ge-FF4B00?style=for-the-badge)](https://plusconverter.ge/en)
&nbsp;
![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

</div>

Georgian bank customers accumulate PLUS loyalty points they often can't spend, and buyers
want them at a discount. That trade used to happen in Facebook groups: no pricing, no trust,
no record. **PLUS Converter turns it into a product.** A customer gets an instant quote,
places a buy or sell order, and settles by bank transfer against a countdown timer, while a
single operator runs pricing, inventory, and the order queue from a realtime admin panel.

It runs in production as a real business, not a portfolio exercise. Every decision below was
made under that constraint.

| | |
|---|---|
| **Live** | [plusconverter.ge](https://plusconverter.ge/en) (English; the bare domain serves Georgian) |
| **Users** | Customers buying and selling points · one operator running the desk |
| **Platform** | Mobile-first web, trilingual (Georgian default, English, Russian) |

## How it works

Bank of Georgia fixes the face value of a point. The operator's spread rides on top of it:

```
        400 points  =  1 GEL          fixed face value, set by the bank
      x  multiplier                   the operator's buy or sell spread
      ------------------------------
      =  your quote
```

Two multipliers, one per direction, live in a single `settings` row the operator edits from
the admin panel. **The customer sees only the 400-base face value, never the multiplier**,
so the desk's margin isn't public. Internally, points are always the canonical amount: a buy
order entered in GEL is converted to points, and the server derives the GEL leg back from
them, so the two legs can never disagree.

## Architecture

```
app/[locale]/          Locale-routed pages: converter, order/new, order/[id], admin, legal
app/auth/callback/     Non-localized OAuth code exchange
proxy.ts               next-intl routing + Supabase session refresh (Node runtime)
components/            Client components (Converter, AccountPicker, OrderView, admin/*)
lib/actions/           Server actions: orders, admin, auth, profile, reviews
lib/pricing.ts         Canonical conversion math, shared by client preview and server
lib/supabase/          Browser/server/proxy clients + hand-maintained DB types
i18n/ · messages/      Routing config and ICU message catalogs (ka, en, ru)
supabase/migrations/   Numbered schema: tables, RLS, triggers, RPCs, Realtime, seed
```

| Table | Purpose | Who can write |
|---|---|---|
| `profiles` | Auto-created on signup; username, bank details, `is_admin` | Own row; admin via policy |
| `settings` | Singleton: multipliers, thresholds, toggles, order timer | Admin only |
| `bank_accounts` | Operator's accounts with availability states | Admin only |
| `orders` | Snapshotted rate + both legs; status machine | Insert guarded by trigger; customer transitions via RPC; admin via policy |
| `reviews` | Minted by trigger on completion; one rating per order | `submit_review` RPC only; moderation via policy |

## What it does

**Customers** get an instant quote with a live buy/sell toggle, sign in with Google or a
one-time email code, settle on a realtime order page with a countdown and payment
instructions, and rate the trade once it completes. They see their own history plus a public
feed of completed trades.

**The operator** sets both multipliers, per-direction limits and the order timer; kills
either direction outright when inventory or cash runs out; manages bank-account availability;
works the pending-order queue; and moderates the review feed. Every new order also arrives
as an email, so the desk doesn't have to watch a dashboard.

## Running locally

**Prerequisites:** Node 20.9+, a free [Supabase](https://supabase.com) project.

```bash
npm install
cp .env.example .env.local     # fill in the two NEXT_PUBLIC_SUPABASE_* values
```

1. Apply `supabase/migrations/` in order (or `supabase db push`). `0001_init.sql` creates the
   tables, RLS policies, triggers and RPCs, enables Realtime, and seeds default settings;
   later migrations layer on the multiplier pricing model, reviews, thresholds, and the
   order-insert guard.
2. Enable **Google OAuth** in Supabase → Authentication → Providers, backed by a Google Cloud
   OAuth client using the redirect URL Supabase gives you.
3. Run `npm run dev`, sign in once, then promote yourself in the SQL editor:

   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```

   The **Admin** link appears in the header.

`npm run build` doubles as the full typecheck; `npm run lint` for ESLint. Ad tracking
(`NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`) and order alert emails
(`RESEND_API_KEY`) are optional and no-op when unset.

**Deploying:** Vercel, Node 20.9+. Register the production domain in **both** Supabase Auth
redirect URLs **and** the Google OAuth client - missing either produces an auth failure that
only reproduces in production.

---

## Engineering highlights

<details open>
<summary><b>Server-authoritative pricing, with defense in depth</b></summary>

The client-side converter is a preview and nothing more. `createOrder`
([`lib/actions/orders.ts`](lib/actions/orders.ts)) discards client-sent amounts and recomputes
the rate and both legs from the canonical `settings` row; [`lib/pricing.ts`](lib/pricing.ts)
is imported by both the preview and the server, so the math cannot drift between them.

Then a Postgres `BEFORE INSERT` trigger
([`0008_order_insert_guard.sql`](supabase/migrations/0008_order_insert_guard.sql)) recomputes
and re-validates the same fields **again**. A direct PostgREST call that skips the server
action still can't forge a price, insert an order as already `completed` (which would have
minted a fake public review), or exceed the concurrent-order cap. The database, not the app
tier, is the last word on money.
</details>

<details>
<summary><b>RLS-first security model</b></summary>

Every table has Row Level Security, which is what makes shipping the publishable key to the
browser safe. Customers can't self-complete orders, because the transitions they're allowed
to make (`mark_order_paid`, `submit_review`) are narrow `SECURITY DEFINER` RPCs instead of
broad `UPDATE` policies - so the full set of writes a user can perform is enumerated in SQL
and reviewable in one place. Aggregates like the homepage stats go through purpose-built RPCs
for the same reason: no broad `SELECT` grant on a table holding names and account numbers.

The public review feed is denormalized to match: no `user_id`, and a snapshotted display name
that is [masked at fixed width](supabase/migrations/0011_masked_email_display_name.sql) for
users without a username, so the real length isn't leaked either.
</details>

<details>
<summary><b>Realtime as the default, not a feature</b></summary>

Pricing, thresholds and direction toggles live in a singleton `settings` row the converter
subscribes to over Supabase Realtime. When the operator reprices, open sessions update without
a refresh - which matters when a customer is mid-decision and the desk's inventory just
changed. The admin queue, account availability, and the review feed ride the same channel.
</details>

<details>
<summary><b>Attribution that survives the user closing the tab</b></summary>

`CompleteRegistration` and `Purchase` are dual-fired: a browser pixel event, plus a
server-side Conversions API event from the code that actually owns that moment. Orders are
completed manually by the operator, possibly hours later, so a browser-only pixel would
systematically under-report the conversions that matter most.

The details are where this gets right or wrong: the dedup key is per-entity
(`purchase_${orderId}`) and shared by both sides so Meta collapses the pair instead of
double-counting, and the registration event is gated on an actual first sign-in so a returning
user re-authenticating past Meta's dedup window isn't recounted as a new signup.
</details>

<details>
<summary><b>Current-generation Next.js, read from the source</b></summary>

App Router on Next 16: Server Components by default, mutations through server actions, and
[`proxy.ts`](proxy.ts) - Next 16's successor to `middleware.ts` - composing next-intl locale
routing and Supabase session refresh into one Node-runtime response. Enough of this surface
changed in Next 16 that the published tutorials are actively wrong, so the conventions here
came from the shipped docs in `node_modules` and the traps are written down in
[`CLAUDE.md`](CLAUDE.md) to only cost time once.

Operationally: Supabase clients are wrapped with an
[abort-signal timeout](lib/supabase/fetch-with-timeout.ts) so a stalled upstream fails in 10s
instead of holding a serverless function open to the platform's 300s ceiling, and side effects
like alert emails run in `after()` where they can never fail an order.
</details>

## Trade-offs, deliberately made

- **Hand-maintained DB types** ([`lib/supabase/types.ts`](lib/supabase/types.ts)) over codegen.
  The schema is small and the types double as documentation. One non-obvious constraint is
  baked in: they must be `type` aliases, not `interface`, or postgrest-js resolves every query
  to `never`.
- **Manual bank-transfer settlement** over a payment provider. It's how the market actually
  operates, it avoids per-transaction fees on thin margins, and keeping the operator in the
  loop on every order *is* the fraud control.
- **Single-operator by design.** No multi-tenancy, no role hierarchy beyond `is_admin`.
  Building for a second operator who doesn't exist yet would be the expensive mistake.

<div align="center">
<br>

Built by [guramnozadze](https://github.com/guramnozadze) · Source published for review, not licensed for reuse

</div>
