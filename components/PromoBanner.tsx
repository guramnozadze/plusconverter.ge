"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { bankValueGel, gelFromPoints, round, GEL_DECIMALS } from "@/lib/pricing";
import type { Settings } from "@/lib/supabase/types";

// Next campaign: edit this constant (UTC). Currently 2026-07-05 11:00 Tbilisi
// time (UTC+4).
const PROMO_DEADLINE = "2026-07-05T07:00:00Z";

// Illustrative example amount, in PLUS points — the payout and gain below are
// computed live from the real pricing helpers, so they can never drift from
// what the converter itself would quote.
const EXAMPLE_POINTS = 40000;

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

  const payout = gelFromPoints(EXAMPLE_POINTS, settings.sell_multiplier);
  // Clamp for display only — the banner always shows, but never claims a
  // negative gain if the multiplier is ever at/below face value.
  const delta = Math.max(0, round(payout - bankValueGel(EXAMPLE_POINTS), GEL_DECIMALS));

  return (
    <div className="mb-4 rounded-2xl border border-black/10 dark:border-white/15 p-5 sm:p-6">
      <span className="inline-block rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
        {t("badge")}
      </span>
      <p className="mt-3 text-lg sm:text-xl font-semibold leading-tight">
        {t("headline", {
          points: gelFmt.format(EXAMPLE_POINTS),
          payout: gelFmt.format(payout),
        })}
      </p>

      {/* The gain is the whole pitch — biggest, boldest thing on the banner. */}
      <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-3 text-center">
        <p className="text-3xl sm:text-4xl font-extrabold text-green-700 dark:text-green-300">
          {t("deltaAmount", { delta: gelFmt.format(delta) })}
        </p>
        <p className="mt-1 text-sm font-medium text-green-700/80 dark:text-green-300/80">
          {t("deltaCaption")}
        </p>
      </div>

      <p className="mt-3 text-sm text-foreground/60">
        {t("endsIn", { days })}
      </p>
    </div>
  );
}
