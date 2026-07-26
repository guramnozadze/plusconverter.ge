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

## Why it exists

Bank of Georgia customers accumulate PLUS loyalty points faster than they ever spend them.
Other people would happily buy those points at a discount. Until now that trade
lived in Facebook comment threads: no published price, no idea who you were sending money
to, no record that the deal ever happened. Every trade was a small act of faith.

PLUS Converter replaces the comment thread with a market. A published price, an order that
exists on the record, a countdown that tells you how long the quote is good for, and a
public feed of completed trades that makes the next stranger easier to trust.

| | |
|---|---|
| **Live** | [plusconverter.ge](https://plusconverter.ge/en) (English; the bare domain serves Georgian) |
| **Who uses it** | Customers buying and selling points · one operator running the desk |
| **Reach** | Mobile-first, in Georgian, English and Russian |
| **Built by** | One person: product, design, engineering, and daily operations |

## What it does

**For the customer**, it removes every reason to hesitate. A quote appears as they type, in
either direction. They sign in with Google or a one-time email code, pick which bank
account settles the trade, and get a live order page with payment instructions and a timer
counting down the quote they were promised. When it completes, they can rate it, and that
rating joins the public feed the next customer reads before deciding to trust the place.

**For the operator**, it replaces a spreadsheet and a full inbox. One screen sets both
prices, the minimum and maximum trade sizes, and how long a quote survives. Either side of
the market can be switched off outright the moment inventory or cash runs out. Orders
arrive in a live queue and by email, so the desk isn't chained to a dashboard, and prices
can be moved at any time without stranding a customer mid-decision.

## How a trade is priced

The bank fixes what a point is worth. The operator's margin rides on top:

```
        400 points  =  1 GEL          fixed face value, set by the bank
      x  multiplier                   the operator's buy or sell spread
      ------------------------------
      =  your quote
```

The customer sees the face value and their quote - never the multiplier, so the desk's
margin stays private. Changing a price is one number, and it reaches every open browser
before the next order is placed.

## Idea to live in five days

First commit was June 30, 2026. Bank of Georgia had announced a promotion for July 5 that
temporarily doubled what points were worth to spend, which meant a short, sharp spike in
people wanting to buy them and a narrow window to be the place they bought them from.

The bet was that being live and trustworthy on the day beat being feature-complete later.
Auth, pricing, orders, the admin desk, three languages, and paid-ad conversion tracking all
shipped inside five days, and the site was live and advertising through the event. It has
been in production since, still run by one operator.

What that timeline bought, and what it deliberately skipped, is the substance of the
sections below.

---

## Under the hood

For readers who want the engineering rather than the product.

<details open>
<summary><b>The database is the last word on money</b></summary>

The converter in the browser is a preview and nothing more. The server discards whatever
amounts the client sends and recomputes the price from scratch, and the conversion math
lives in [one shared module](lib/pricing.ts) that both the preview and the server import,
so the two can never quietly disagree.

Then Postgres does it a third time. A [trigger](supabase/migrations/0008_order_insert_guard.sql)
recomputes and re-validates every order as it's inserted, so a request that skips the
application entirely still cannot forge a favorable rate, book an order as already
completed, or open more orders than one person is allowed. Handling other people's money
seemed like the wrong place to trust a single layer of validation.
</details>

<details>
<summary><b>Customers can't do what they shouldn't, by construction</b></summary>

Every table enforces row-level security, so a customer's session can only ever read and
write their own rows. The two changes a customer is allowed to make - confirming they've
paid, and rating a finished trade - are single-purpose database functions rather than
general write permission, which means the complete list of things a user can do is short,
explicit, and reviewable in one place instead of inferred from application code.

The public review feed follows the same instinct: it carries no account identifiers at all,
and reviewers who never chose a username get a
[fixed-width masked name](supabase/migrations/0011_masked_email_display_name.sql), so the
length of the original isn't leaked either.
</details>

<details>
<summary><b>Repricing reaches everyone already looking</b></summary>

Prices, limits and the on/off switches live in one row that every open converter subscribes
to. When the operator moves a price, every browser currently mid-decision updates without a
refresh, and the admin queue, account availability and review feed arrive the same way.
For a desk whose inventory changes hour to hour, a stale quote on someone's screen is a
support conversation at best and a loss at worst.
</details>

<details>
<summary><b>Conversion tracking that survives the tab closing</b></summary>

Orders are completed by hand, sometimes hours after the customer has closed the browser.
A conventional browser-only ad pixel would therefore miss precisely the conversions worth
measuring, so registrations and purchases are also reported server-side, from the code that
actually owns the moment they happen.

Doing that without corrupting the numbers is the interesting part: both halves share a
per-order identifier so the ad platform merges the pair instead of counting it twice, and
the signup event checks that a sign-in is genuinely a first one, so a returning customer
isn't recounted as a new acquisition weeks later.
</details>

<details>
<summary><b>Choosing the current generation on purpose</b></summary>

Built on Next.js 16 and React 19 - new enough that most published tutorials are actively
wrong about the parts that changed, which is a real cost. It was worth paying once: the
framework's own shipped documentation settled the conventions, and the traps are written
down in the repo so they don't get rediscovered.

Smaller choices in the same spirit: upstream calls time out in ten seconds rather than
holding a serverless function open to the platform's five-minute ceiling, and side effects
like alert emails run after the response, where a mail outage can't take an order down
with it.
</details>

## Decisions worth defending

- **Bank transfers, not a payment processor.** It's how this market already works, it
  avoids per-transaction fees on thin margins, and a human seeing every order is itself the
  fraud control. A card flow would have looked more impressive and served the business
  worse.
- **Built for one operator, not an imagined ten.** No multi-tenancy, no role hierarchy.
  Generalizing for a second operator who doesn't exist would have cost the launch window
  and bought nothing.
- **The margin stays private, the price does not.** Publishing a quote is what makes the
  market trustworthy; publishing the spread behind it would just invite being undercut.

<div align="center">
<br>

Built by [guramnozadze](https://github.com/guramnozadze) · Source published for review, not licensed for reuse

</div>
