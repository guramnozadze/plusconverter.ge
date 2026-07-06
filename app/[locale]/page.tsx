import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSettings, getPlatformStats, getReviewsFeed } from "@/lib/data";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Converter } from "@/components/Converter";
import { PromoBanner } from "@/components/PromoBanner";
import { ConverterDirectionProvider } from "@/components/ConverterDirection";
import { ProfileCard } from "@/components/ProfileCard";
import { ActivityTabs } from "@/components/ActivityTabs";
import { ReviewsCarousel } from "@/components/ReviewsCarousel";
import type { Order, Review } from "@/lib/supabase/types";

const REVIEWS_PER_PAGE = 15;
const CAROUSEL_MIN_RATING = 4;
const CAROUSEL_MAX_ITEMS = 10;

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reviewsPage?: string; reviewsSort?: string }>;
}) {
  const { locale: candidateLocale } = await params;
  const locale = hasLocale(routing.locales, candidateLocale)
    ? candidateLocale
    : routing.defaultLocale;
  setRequestLocale(locale);

  const supabase = await createClient();

  const [
    settings,
    { user, profile },
    { reviewsPage: reviewsPageRaw, reviewsSort: reviewsSortRaw },
    platformStats,
    latestFeed,
  ] = await Promise.all([
    getSettings(),
    getUserProfile(),
    searchParams,
    getPlatformStats(),
    getReviewsFeed(),
  ]);

  const reviewsPage = Math.max(1, Number(reviewsPageRaw) || 1);
  const reviewsSort = reviewsSortRaw === "best" ? "best" : "latest";

  // `latestFeed` (cached, see lib/data.ts) is plain reverse-chronological.
  // `bestSortedFeed` re-ranks so rows with a written comment come first, then
  // star-only ratings, then plain completed-transaction rows - newest first
  // within each tier. The toggle in ActivityTabs picks which one is shown;
  // the carousel always uses the "best" ranking regardless of that toggle.
  const feedTier = (r: Review) => (r.comment ? 0 : r.rating != null ? 1 : 2);
  const bestSortedFeed = [...latestFeed].sort(
    (a, b) => feedTier(a) - feedTier(b),
  );

  const displayFeed = reviewsSort === "best" ? bestSortedFeed : latestFeed;
  const reviewsTotalPages = Math.max(
    1,
    Math.ceil(displayFeed.length / REVIEWS_PER_PAGE),
  );
  const rangeStart = (reviewsPage - 1) * REVIEWS_PER_PAGE;
  const feed = displayFeed.slice(rangeStart, rangeStart + REVIEWS_PER_PAGE);

  // "Latest and greatest" for the logged-out carousel: newest highly-rated
  // written reviews, independent of the visible feed's sort toggle.
  const carouselReviews = bestSortedFeed
    .filter((r) => r.comment && (r.rating ?? 0) >= CAROUSEL_MIN_RATING)
    .slice(0, CAROUSEL_MAX_ITEMS);

  // The signed-in user's own orders + the review status of each (rating is null
  // until they leave one). RLS scopes both reads to the caller.
  let myOrders: Order[] = [];
  let reviewByOrder: Record<string, number | null> = {};
  if (user) {
    const [ordersRes, myReviewsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("reviews").select("order_id, rating"),
    ]);
    myOrders = (ordersRes.data ?? []) as Order[];
    const myOrderIds = new Set(myOrders.map((o) => o.id));
    for (const r of myReviewsRes.data ?? []) {
      if (myOrderIds.has(r.order_id)) reviewByOrder[r.order_id] = r.rating;
    }
  }

  return (
    <div>
      <ConverterDirectionProvider>
        {!user && (
          <>
            <ReviewsCarousel reviews={carouselReviews} locale={locale} />
            <PromoBanner initialSettings={settings} stats={platformStats} />
          </>
        )}
        {user && profile && <ProfileCard profile={profile} />}
        <Converter
          initialSettings={settings}
          isAuthenticated={Boolean(user)}
        />
      </ConverterDirectionProvider>
      <ActivityTabs
        feed={feed}
        reviewsPage={reviewsPage}
        reviewsTotalPages={reviewsTotalPages}
        reviewsSort={reviewsSort}
        myOrders={myOrders}
        reviewByOrder={reviewByOrder}
        isAuthenticated={Boolean(user)}
      />
    </div>
  );
}
