"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { setReviewHidden } from "@/lib/actions/admin";
import { PlusBadge } from "@/components/PlusBadge";
import type { Review } from "@/lib/supabase/types";

export function ReviewsPanel({ reviews }: { reviews: Review[] }) {
  const t = useTranslations("reviews");
  const tConv = useTranslations("converter");
  const locale = useLocale();
  const router = useRouter();

  // Live: refetch when any review changes (new completion, edit, hide).
  // Debounced because our own writes (setReviewHidden) already call
  // router.refresh() directly - the Realtime echo of that same write would
  // otherwise trigger a second, redundant full-table refetch moments later,
  // and multiple admin tabs open at once would each pay that cost independently.
  useEffect(() => {
    const supabase = createClient();
    let debounce: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel("admin-reviews")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => router.refresh(), 1500);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [locale],
  );
  const pointsFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );

  async function toggle(id: string, hidden: boolean) {
    await setReviewHidden(id, hidden);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/15 p-5">
      <h2 className="font-semibold mb-4">{t("adminTitle")}</h2>

      {reviews.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("emptyFeed")}</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                r.hidden
                  ? "border-black/10 dark:border-white/15 opacity-50"
                  : "border-black/10 dark:border-white/15"
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {r.rating != null && (
                    <span className="text-amber-400">
                      {"★".repeat(r.rating)}
                    </span>
                  )}{" "}
                  @{r.display_name}
                </p>
                {r.comment && (
                  <p className="text-foreground/70 break-words">{r.comment}</p>
                )}
                <p className="text-foreground/60 text-xs">
                  {r.direction.toUpperCase()} · {pointsFmt.format(r.points_amount)}{" "}
                  <PlusBadge /> · {dateFmt.format(new Date(r.created_at))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(r.id, !r.hidden)}
                className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1 text-xs"
              >
                {r.hidden ? t("unhide") : t("hide")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
