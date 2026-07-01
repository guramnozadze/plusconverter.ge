@AGENTS.md

# PLUS Converter — project guide

Mobile-first, trilingual web app for buying/selling Bank of Georgia **PLUS points**.
Next.js 16 (App Router) + Supabase (Postgres/Auth/Realtime/RLS) + next-intl. See
`README.md` for one-time setup (Supabase project, schema, Google OAuth).

## Architecture map

- `app/[locale]/` — all pages (locale-routed). `page.tsx` = converter, `order/[id]`,
  `admin`. `app/auth/callback/route.ts` is **non-localized** (OAuth code exchange).
- `proxy.ts` — Next 16's renamed middleware. Composes next-intl routing **and** Supabase
  session refresh into one response.
- `i18n/` — `routing.ts` (locales `ka`/`en`/`ru`, default `ka`, `as-needed` prefix),
  `request.ts`, `navigation.ts` (locale-aware `Link`/`useRouter`/etc).
- `messages/{ka,en,ru}.json` — all UI strings (ICU). English is source of truth.
- `lib/supabase/` — `client.ts` (browser), `server.ts` (RSC/actions), `middleware.ts`
  (`updateSession`), `types.ts` (hand-maintained DB types).
- `lib/actions/` — server actions (`orders.ts`, `admin.ts`). `lib/data.ts`, `lib/auth.ts`,
  `lib/pricing.ts` (canonical conversion math).
- `supabase/migrations/0001_init.sql` — schema, RLS, triggers, RPCs, Realtime, seed.

## Rules / gotchas (these bit us — keep them true)

- **Next 16, not 15.** Middleware lives in `proxy.ts` (export `proxy` or default), **Node
  runtime, no edge**. Don't follow `middleware.ts` Supabase/next-intl tutorials.
- `cookies()`, `headers()`, `params`, `searchParams` are **async** — always `await`.
- **DB row types must be `type`, not `interface`** (`lib/supabase/types.ts`). Interfaces
  don't satisfy postgrest-js's `Record<string, unknown>` constraint and make **every query
  resolve to `never`**.
- **Keep `lib/supabase/types.ts` in sync with `supabase/migrations/*`.** Editing the schema
  without updating types (or vice-versa) silently breaks typing. Add new RPCs to the
  `Functions` map too.
- **RLS-first security.** Every table has RLS. The **Publishable** key (`sb_publishable_…`,
  stored in `NEXT_PUBLIC_SUPABASE_ANON_KEY`) is browser-safe *only because* RLS is on. The
  **Secret** key (`sb_secret_…`) must never reach the client — it's not used anywhere yet.
- **Pricing is recomputed server-side.** `createOrder` ignores client-sent amounts and
  recomputes rate/amounts from the canonical `settings` row. Never trust client pricing.
- **Checkout flow:** converter (`Converter.tsx`) → `/order/new?direction=&points=`
  (`AccountPicker`, user picks a bank account) → `createOrder` → `/order/[id]`. The
  **canonical order input is always PLUS `points`** (server derives the GEL leg); for *buy*
  the client converts the entered GEL to points first. `createOrder`'s `bankAccountId` is
  re-validated as `available` server-side (falls back to first available if omitted).
- **The converter hides the rate.** It shows only the fixed 400-base face value on the
  readonly side; the multiplier/rate is never rendered (only used to derive `points`).
- User-side order mutations go through SECURITY DEFINER RPCs (e.g. `mark_order_paid`), not
  broad UPDATE policies, so users can't self-complete orders.

## i18n conventions

- **No hardcoded user-facing text** — every string via `useTranslations()` /
  `getTranslations()` with a key in `messages/*.json`.
- `ka.json` and `ru.json` currently **mirror English** (placeholders). Real Georgian/Russian
  translations are a pending task; `ka` is the default locale.
- Adding a string = add the key to **all three** catalogs at the same path (keep
  them in lockstep, or the locale missing it throws `MISSING_MESSAGE`).
- Use `Link`/`useRouter`/`redirect` from `@/i18n/navigation`, never raw `next/link` /
  `next/navigation`, so the locale prefix is preserved.
- **next-intl v4 nav signatures** (not the v3 string form most tutorials show): the
  server `redirect` takes an **object** — `redirect({ href: "/order/new", locale })` (add
  `query` for params, e.g. `{ href: { pathname: "/order/new", query: { direction } }, locale }`).
  `useRouter().push("/path")` still takes a string. Locales live in `i18n/routing.ts`.

## Commands

- `npm run dev` — Turbopack dev server (http://localhost:3000)
- `npm run build` — production build (also full typecheck)
- `npm run lint`

## Conventions

- Tailwind v4 (CSS-config, no `tailwind.config.js`). 2-space indent, double quotes.
- Server Components by default; `"use client"` only when needed (state, Realtime, events).
