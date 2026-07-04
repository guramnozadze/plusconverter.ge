"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useConverterDirection } from "./ConverterDirection";

// Not a live query (deliberately: a real aggregate would mean summing the
// reviews table on every page load). Bump these by hand occasionally so the
// copy doesn't go stale.
const ACTIVITY_TRADERS = 31;
const ACTIVITY_POINTS = 785348;

export function PromoBanner() {
  const t = useTranslations("promoBanner");
  const locale = useLocale();
  const { focusSell } = useConverterDirection();

  const pointsFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );

  return (
    <button
      type="button"
      onClick={focusSell}
      className="mb-4 flex w-full items-center gap-2 rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 px-3 py-2 text-left text-sm font-medium text-foreground/80 transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      {t("activity", {
        traders: ACTIVITY_TRADERS,
        points: pointsFmt.format(ACTIVITY_POINTS),
      })}
    </button>
  );
}
