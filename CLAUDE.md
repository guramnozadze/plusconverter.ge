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
- `i18n/` — `routing.ts` (locales `ka`/`en`/`ru`, default `ka`),
  `request.ts`, `navigation.ts` (locale-aware `Link`/`useRouter`/etc).
- `messages/{ka,en,ru}.json` — all UI strings (ICU). English is source of truth.
- `lib/supabase/` — `client.ts` (browser), `server.ts` (RSC/actions), `middleware.ts`
  (`updateSession`), `types.ts` (hand-maintained DB types).
- `lib/actions/` — server actions (`orders.ts`, `admin.ts`, `auth.ts`). `lib/data.ts`,
  `lib/auth.ts`, `lib/pricing.ts` (canonical conversion math).
- `supabase/migrations/` — schema, RLS, triggers, RPCs, Realtime, seed.
- `lib/meta-pixel.ts` (browser) + `lib/meta-capi.ts` (server) — Meta ad tracking, see below.

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

## Auth flow

- **OAuth** (Google, and any future provider): `Converter.tsx` calls
  `signInWithOAuth` → `app/auth/callback/route.ts` exchanges the code server-side,
  appends `?signed_in=1` to mark a *completed* sign-in (vs. just clicking the
  button), then redirects. This route is provider-agnostic — it never branches
  on which provider was used.
- **Email OTP**: `EmailOtpForm.tsx` calls `supabase.auth.verifyOtp()` directly
  from the browser — there's no server route in the middle for this path.
- Both paths converge on the same post-sign-in behavior (draft restore, Meta
  tracking) — see below.

## Meta Pixel / Conversions API

- Dual-fired for `CompleteRegistration` and `Purchase`: a browser pixel event
  (`lib/meta-pixel.ts`, fired from components) **and** a server-side Conversions
  API event (`lib/meta-capi.ts`, fired from the server action/route that
  actually owns that moment — `app/auth/callback/route.ts` + `lib/actions/auth.ts`
  for sign-in, `lib/actions/admin.ts`'s `setOrderStatus` for order completion).
  The server-side twin exists because the browser event depends on the user's
  tab/script surviving to that moment, which isn't reliable (e.g. admin
  completing an order is async and manual — the buyer may be long gone).
- **`trackOnce(key, event, params)`'s `key` doubles as Meta's `eventID`** — pass
  the *same* key server-side (`lib/meta-capi.ts`'s `eventId`) so Meta dedupes
  the browser/server pair instead of double-counting. Keys are per-entity, not
  per-browser (e.g. `registration_${userId}`, `purchase_${orderId}`) — a
  hardcoded key would make Meta dedupe unrelated users/orders against each other.
- `sendCompleteRegistrationCapiEvent` is guarded by `isFirstSignIn` (compares
  `created_at` vs `last_sign_in_at`) so a returning user re-authenticating
  weeks later — past Meta's ~48h dedup window — doesn't get recounted as a
  fresh registration.
- Both no-op silently when unset: `NEXT_PUBLIC_META_PIXEL_ID` (browser + server)
  and `META_CAPI_ACCESS_TOKEN` (server only, never `NEXT_PUBLIC_`).

## i18n conventions

- **No hardcoded user-facing text** — every string via `useTranslations()` /
  `getTranslations()` with a key in `messages/*.json`.
- `ka.json` and `ru.json` are real, hand-translated catalogs (not placeholders); `ka` is
  the default locale, `en` is the source of truth for keys.
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
- The working directory is already this project's root — use relative paths (e.g.
  `app/[locale]/order/[id]/page.tsx`), not long absolute ones.

## Conventions

- Tailwind v4 (CSS-config, no `tailwind.config.js`). 2-space indent, double quotes.
- Server Components by default; `"use client"` only when needed (state, Realtime, events).
