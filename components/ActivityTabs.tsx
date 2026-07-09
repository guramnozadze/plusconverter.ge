"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLinkStatus } from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlusBadge } from "./PlusBadge";
import { ReviewForm } from "./ReviewForm";
import type { Order, Review } from "@/lib/supabase/types";

// Pagination Links navigate to a fresh RSC render, which can take a moment -
// this gives the click somewhere to go instead of feeling like a no-op.
function PageLinkLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {pending && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
      )}
    </span>
  );
}

type Props = {
  feed: Review[];
  reviewsPage: number;
  reviewsTotalPages: number;
  reviewsSort: "latest" | "best";
  myOrders: Order[];
  reviewByOrder: Record<string, number | null>;
  isAuthenticated: boolean;
};

// Read-only star row.
function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400" aria-label={`${value}/5`}>
      {"★".repeat(value)}
      <span className="text-foreground/25">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ActivityTabs({
  feed,
  reviewsPage,
  reviewsTotalPages,
  reviewsSort,
  myOrders,
  reviewByOrder,
  isAuthenticated,
}: Props) {
  const t = useTranslations("reviews");
  const tOrder = useTranslations("order");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<"community" | "mine">("community");
  const hasPending = myOrders.some((o) => o.status === "pending");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [sortMenuOpen]);

  // Live community feed: refresh when any review row changes.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("reviews-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
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
  const gelFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );
  const pointsFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );

  const pointsLine = (direction: Order["direction"], points: number) =>
    t(direction === "sell" ? "soldPoints" : "boughtPoints", {
      points: pointsFmt.format(points),
    });

  const community = (
    <>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground/70">
          {reviewsSort === "latest" ? t("sortLatest") : t("sortBest")}
        </span>
        <div className="relative" ref={sortMenuRef}>
          <button
            type="button"
            onClick={() => setSortMenuOpen((v) => !v)}
            aria-label={t("sortLabel")}
            aria-expanded={sortMenuOpen}
            className="rounded-md p-1.5 text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <FilterIcon className="h-4 w-4" />
          </button>
          {sortMenuOpen && (
            <div className="surface-card absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border shadow-lg">
              {(["latest", "best"] as const).map((sort) => (
                <Link
                  key={sort}
                  href={{ pathname: "/", query: { reviewsSort: sort } }}
                  scroll={false}
                  onClick={() => setSortMenuOpen(false)}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className={reviewsSort === sort ? "font-medium" : "text-foreground/70"}>
                    {sort === "latest" ? t("sortLatest") : t("sortBest")}
                  </span>
                  {reviewsSort === sort && (
                    <CheckIcon className="h-4 w-4 shrink-0 text-foreground/60" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <ul className="space-y-2">
        {feed.length === 0 ? (
          <li className="surface-muted rounded-xl border p-4 text-sm text-foreground/60">
            {t("emptyFeed")}
          </li>
        ) : (
          feed.map((r) => (
            <li
              key={r.id}
              className="surface-muted rounded-xl border p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">@{r.display_name}</span>
                <span className="text-xs text-foreground/50">
                  {dateFmt.format(new Date(r.created_at))}
                </span>
              </div>
              {r.rating != null && (
                <div className="mt-1">
                  <Stars value={r.rating} />
                </div>
              )}
              {r.comment && (
                <p className="mt-1 text-foreground/80">{r.comment}</p>
              )}
              <p className="mt-1 text-xs text-foreground/60">
                {pointsLine(r.direction, r.points_amount)}
              </p>
            </li>
          ))
        )}
      </ul>
      {reviewsTotalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <Link
            href={{ pathname: "/", query: { reviewsPage: reviewsPage - 1, reviewsSort } }}
            scroll={false}
            aria-disabled={reviewsPage <= 1}
            className={`rounded-md bg-black/5 dark:bg-white/10 px-3 py-1.5 font-medium transition-colors hover:bg-black/10 dark:hover:bg-white/20 active:bg-black/15 dark:active:bg-white/25 ${
              reviewsPage <= 1 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <PageLinkLabel>{t("prevPage")}</PageLinkLabel>
          </Link>
          <span className="text-foreground/60">
            {t("pageOf", { page: reviewsPage, total: reviewsTotalPages })}
          </span>
          <Link
            href={{ pathname: "/", query: { reviewsPage: reviewsPage + 1, reviewsSort } }}
            scroll={false}
            aria-disabled={reviewsPage >= reviewsTotalPages}
            className={`rounded-md bg-black/5 dark:bg-white/10 px-3 py-1.5 font-medium transition-colors hover:bg-black/10 dark:hover:bg-white/20 active:bg-black/15 dark:active:bg-white/25 ${
              reviewsPage >= reviewsTotalPages ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <PageLinkLabel>{t("nextPage")}</PageLinkLabel>
          </Link>
        </div>
      )}
    </>
  );

  const mine = (
    <ul className="space-y-2">
      {myOrders.length === 0 ? (
        <li className="surface-muted rounded-xl border p-4 text-sm text-foreground/60">
          {t("emptyMine")}
        </li>
      ) : (
        myOrders.map((o) => {
          const rating = reviewByOrder[o.id];
          const reviewed = typeof rating === "number";
          return (
            <li
              key={o.id}
              className="surface-muted rounded-xl border p-3 text-sm space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <Link href={`/order/${o.id}`} className="font-medium underline">
                  {pointsLine(o.direction, o.points_amount)}
                </Link>
                <span className="text-xs text-foreground/50">
                  {dateFmt.format(new Date(o.created_at))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-foreground/60">
                <span>{gelFmt.format(o.gel_amount)} GEL</span>
                <span>{tOrder(`status.${o.status}`)}</span>
              </div>
              {o.status === "completed" &&
                (reviewed ? (
                  <Stars value={rating as number} />
                ) : (
                  <ReviewForm orderId={o.id} />
                ))}
            </li>
          );
        })
      )}
    </ul>
  );

  // Logged-out users only see the community feed (no tab bar).
  if (!isAuthenticated) {
    return (
      <section className="mt-6">
        <h2 className="mb-1 font-semibold">{t("communityTab")}</h2>
        {community}
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-black/5 dark:bg-white/10 p-1 text-sm">
        {(["community", "mine"] as const).map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            aria-pressed={tab === tb}
            className={`rounded-md py-1.5 font-medium transition-colors ${
              tab === tb ? "bg-background shadow-sm" : "text-foreground/60"
            }`}
          >
            {tb === "community" ? (
              t("communityTab")
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                {hasPending && (
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                )}
                {myOrders.length > 0
                  ? `${t("myTab")} (${myOrders.length})`
                  : t("myTab")}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === "community" ? community : mine}
    </section>
  );
}
