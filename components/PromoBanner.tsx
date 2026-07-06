"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useConverterDirection } from "./ConverterDirection";
import { gelFromPoints } from "@/lib/pricing";
import type { Settings } from "@/lib/supabase/types";
import type { PlatformStats } from "@/lib/data";

// Illustrative example amount, in PLUS points — the GEL payout below is
// computed live from the real pricing helper, so it can never drift from
// what the converter itself would quote.
const EXAMPLE_POINTS = 100000;

export function PromoBanner({
  initialSettings,
  stats,
}: {
  initialSettings: Settings;
  stats: PlatformStats;
}) {
  const t = useTranslations("promoBanner");
  const locale = useLocale();
  // REMINDER: restore live pricing before 2027-07-01 (ahead of next year's
  // flash-sale event). Traffic settled back to normal after the July 2026
  // event ended, so the realtime settings subscription below is disabled —
  // the rate now only updates on a full page reload. getSettings() is still
  // fetched fresh server-side on every request either way (see lib/data.ts).
  const [settings] = useState(initialSettings);
  const { focusDirection } = useConverterDirection();

  // Live price: stay in sync if the owner adjusts the multiplier again, same
  // realtime channel pattern as Converter. Disabled 2026-07-06 — see the
  // REMINDER above `settings`. To restore: bring back `setSettings` in the
  // destructure above, re-add the `useEffect`/`createClient` imports, and
  // uncomment this effect.
  // useEffect(() => {
  //   const supabase = createClient();
  //   const channel = supabase
  //     .channel("settings-live-promo")
  //     .on(
  //       "postgres_changes",
  //       { event: "*", schema: "public", table: "settings" },
  //       (payload) => setSettings(payload.new as Settings),
  //     )
  //     .subscribe();
  //   return () => {
  //     supabase.removeChannel(channel);
  //   };
  // }, []);

  const pointsFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );
  // Always shows 2 fraction digits so the payout reads like a quoted price
  // (e.g. "22,857.14"), split below into whole/fraction for the subscript.
  // Locale pinned to en-US (not the UI locale) so the decimal point is
  // always a "." — ka/ru number formatting isn't consistently supported
  // across browsers and can silently swap in a "," instead.
  const payoutFmt = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const payout = gelFromPoints(EXAMPLE_POINTS, settings.sell_multiplier);
  const payoutParts = payoutFmt.formatToParts(payout);
  const decimalIndex = payoutParts.findIndex((part) => part.type === "decimal");
  const payoutWhole = payoutParts
    .slice(0, decimalIndex)
    .map((part) => part.value)
    .join("");
  const payoutFraction = payoutParts
    .slice(decimalIndex)
    .map((part) => part.value)
    .join("");

  return (
    <div
      onClick={() => focusDirection("sell")}
      className="mb-4 block w-full text-left rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-gradient-to-br from-orange-50 via-amber-50 to-white dark:from-orange-500/15 dark:via-amber-500/10 dark:to-transparent p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-2.5 py-1 text-xs font-semibold text-white">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          {t("badge")}
        </span>
      </div>

      <p className="mt-3 text-lg sm:text-xl font-semibold leading-tight">
        {t("headline")}
      </p>

      <p className="mt-3 text-xs font-normal text-foreground/60">
        {t("exampleLabel", { points: pointsFmt.format(EXAMPLE_POINTS) })}
      </p>
      {/* The payout is the whole pitch, but as a quoted-price panel nested in
          the banner rather than bare oversized text floating on it. Its own
          button (stopping propagation) so only this click pre-fills the
          example amount — a tap elsewhere on the banner just scrolls down. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          focusDirection("sell", EXAMPLE_POINTS);
        }}
        className="glow-ring mt-2 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-orange-200/70 dark:border-orange-500/20 bg-white/60 dark:bg-black/20 px-4 py-3 text-left shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-transform duration-300 hover:scale-[1.01]"
      >
        <span className="glow-ring-sheen-wrap" aria-hidden="true">
          <span className="glow-ring-sheen" />
        </span>
        <p className="flex flex-wrap items-baseline gap-y-0 font-extrabold tracking-tight text-orange-600 dark:text-orange-400">
          <span className="flex items-baseline tabular-nums font-[family-name:var(--font-baloo)]">
            <span className="text-3xl sm:text-4xl">{payoutWhole}</span>
            <span className="align-sub text-base sm:text-lg text-orange-600/70 dark:text-orange-400/70">
              {payoutFraction}
            </span>
          </span>
          <span className="ml-3 whitespace-nowrap text-base sm:text-lg">{t("gelUnit")}</span>
        </p>
        {/* Genuinely live: settings (and so this payout) update over the
            realtime subscription above whenever the rate changes. */}
        <span className="hidden shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400 sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
          </span>
          {t("live")}
        </span>
      </button>

      <div className="mt-4 flex items-start gap-2 text-sm font-medium text-foreground/70">
        <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="flex flex-col gap-1">
          <span>{t("activityOrders", { orders: stats.totalOrders })}</span>
          <span>{t("activityPoints", { points: pointsFmt.format(stats.totalPoints) })}</span>
          <span>{t("activityUsers", { users: stats.totalUsers })}</span>
        </span>
      </div>
    </div>
  );
}
