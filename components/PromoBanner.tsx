"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConverterDirection } from "./ConverterDirection";
import { gelFromPoints } from "@/lib/pricing";
import type { Settings } from "@/lib/supabase/types";

// Next campaign: edit this constant (UTC). Currently 2026-07-05 11:00 Tbilisi
// time (UTC+4).
const PROMO_DEADLINE = "2026-07-05T07:00:00Z";

// Illustrative example amount, in PLUS points — the payout below is computed
// live from the real pricing helper, so it can never drift from what the
// converter itself would quote.
const EXAMPLE_POINTS = 100000;

// Illustrative "last 24h" activity line — not a live query (deliberately: a
// real aggregate would mean summing the reviews table on every page load).
// Bump these by hand occasionally so the copy doesn't go stale.
const ACTIVITY_TRADERS = 31;
const ACTIVITY_POINTS = 785348;

const DAY_MS = 24 * 60 * 60 * 1000;

// Coarse "N day(s) left" instead of a precise countdown. Deliberately biased
// down by a day (floor, minus one, floored at 1) rather than rounded to the
// nearest day — "ends in 1 day" reads more urgent than "2 days" and is still
// truthful (there is in fact less than 2 full days left).
function daysRemaining(deadline: string): number {
  const wholeDays = Math.floor((new Date(deadline).getTime() - Date.now()) / DAY_MS);
  return Math.max(1, wholeDays - 1);
}

function useDaysRemaining(deadline: string) {
  const [days, setDays] = useState(() => daysRemaining(deadline));
  useEffect(() => {
    const tick = () => setDays(daysRemaining(deadline));
    tick();
    // Day-granularity copy doesn't need second-by-second updates.
    const id = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return days;
}

export function PromoBanner({ initialSettings }: { initialSettings: Settings }) {
  const t = useTranslations("promoBanner");
  const locale = useLocale();
  const [settings, setSettings] = useState(initialSettings);
  const days = useDaysRemaining(PROMO_DEADLINE);
  const { focusSell } = useConverterDirection();

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

  const payout = gelFromPoints(EXAMPLE_POINTS, settings.sell_multiplier);

  return (
    <button
      type="button"
      onClick={focusSell}
      className="mb-4 block w-full text-left rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-gradient-to-br from-orange-50 via-amber-50 to-white dark:from-orange-500/15 dark:via-amber-500/10 dark:to-transparent p-5 sm:p-6 transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-2.5 py-1 text-xs font-semibold text-white">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          {t("badge")}
        </span>
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">
          {t("endsIn", { days })}
        </span>
      </div>

      <p className="mt-3 text-lg sm:text-xl font-semibold leading-tight">
        {t("headline")}
      </p>

      <p className="mt-3 text-xs font-medium text-foreground/50">
        {t("exampleLabel", { points: pointsFmt.format(EXAMPLE_POINTS) })}
      </p>
      {/* The payout is the whole pitch — biggest, boldest thing on the banner. */}
      <p className="text-4xl sm:text-5xl font-extrabold tracking-tight text-orange-600 dark:text-orange-400">
        {gelFmt.format(payout)} <span className="text-2xl sm:text-3xl">GEL</span>
      </p>

      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-foreground/70">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        {t("activity", {
          traders: ACTIVITY_TRADERS,
          points: pointsFmt.format(ACTIVITY_POINTS),
        })}
      </div>
    </button>
  );
}
