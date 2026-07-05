"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConverterDirection } from "./ConverterDirection";
import { pointsFromGel } from "@/lib/pricing";
import type { Settings } from "@/lib/supabase/types";
import type { PlatformStats } from "@/lib/data";

// Illustrative example amount, in GEL — the points payout below is computed
// live from the real pricing helper, so it can never drift from what the
// converter itself would quote.
const EXAMPLE_GEL = 100;

export function PromoBanner({
  initialSettings,
  stats,
}: {
  initialSettings: Settings;
  stats: PlatformStats;
}) {
  const t = useTranslations("promoBanner");
  const locale = useLocale();
  const [settings, setSettings] = useState(initialSettings);
  const { focusDirection } = useConverterDirection();

  // Live price: stay in sync if the owner adjusts the multiplier again,
  // same realtime channel pattern as Converter.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("settings-live-promo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload) => setSettings(payload.new as Settings),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const gelFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );
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

  const payout = pointsFromGel(EXAMPLE_GEL, settings.buy_multiplier);
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
    <button
      type="button"
      onClick={() => focusDirection("buy")}
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
        {t("exampleLabel", { gel: gelFmt.format(EXAMPLE_GEL) })}
      </p>
      {/* The payout is the whole pitch, but as a quoted-price panel nested in
          the banner rather than bare oversized text floating on it. */}
      <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-orange-200/70 dark:border-orange-500/20 bg-white/60 dark:bg-black/20 px-4 py-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="flex flex-wrap items-baseline gap-y-0 font-extrabold tracking-tight text-orange-600 dark:text-orange-400">
          <span className="flex items-baseline tabular-nums font-[family-name:var(--font-baloo)]">
            <span className="text-3xl sm:text-4xl">{payoutWhole}</span>
            <span className="align-sub text-base sm:text-lg text-orange-600/70 dark:text-orange-400/70">
              {payoutFraction}
            </span>
          </span>
          <span className="ml-3 whitespace-nowrap text-base sm:text-lg">{t("points")}</span>
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
      </div>

      <div className="mt-4 flex items-start gap-2 text-sm font-medium text-foreground/70">
        <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="flex flex-col">
          <span>{t("activityOrders", { orders: stats.totalOrders })}</span>
          <span>{t("activityPoints", { points: pointsFmt.format(stats.totalPoints) })}</span>
        </span>
      </div>
    </button>
  );
}
