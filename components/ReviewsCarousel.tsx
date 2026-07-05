import { getTranslations } from "next-intl/server";
import type { Review } from "@/lib/supabase/types";

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400 text-xs" aria-label={`${value}/5`}>
      {"★".repeat(value)}
      <span className="text-foreground/25">{"★".repeat(5 - value)}</span>
    </span>
  );
}

// Logged-out-only teaser above the promo banner: a slow, CSS-only marquee of
// the best written reviews. No JS state (no "use client") - the loop is a
// pure CSS animation, the list is duplicated once in markup so it wraps
// seamlessly (see the `animate-reviews-marquee` keyframes in globals.css).
export async function ReviewsCarousel({
  reviews,
  locale,
}: {
  reviews: Review[];
  locale: string;
}) {
  if (reviews.length === 0) return null;

  const t = await getTranslations("reviews");
  const pointsFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const pointsLine = (direction: Review["direction"], points: number) =>
    t(direction === "sell" ? "soldPoints" : "boughtPoints", {
      points: pointsFmt.format(points),
    });

  const card = (r: Review, hidden: boolean) => (
    <div
      key={`${r.id}-${hidden ? "dup" : "orig"}`}
      aria-hidden={hidden}
      className="w-64 shrink-0 rounded-xl border border-black/10 dark:border-white/15 bg-background p-3 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">@{r.display_name}</span>
        {r.rating != null && <Stars value={r.rating} />}
      </div>
      <p className="mt-1 line-clamp-2 text-foreground/80">{r.comment}</p>
      <p className="mt-1 text-xs text-foreground/60">
        {pointsLine(r.direction, r.points_amount)}
      </p>
    </div>
  );

  return (
    <div className="mb-4 -mx-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
      <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {t("carouselTitle")}
      </p>
      <div className="flex w-max animate-reviews-marquee gap-3 px-4">
        {reviews.map((r) => card(r, false))}
        {reviews.map((r) => card(r, true))}
      </div>
    </div>
  );
}
