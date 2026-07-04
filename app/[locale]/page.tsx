import { setRequestLocale } from "next-intl/server";
import { getSettings } from "@/lib/data";
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
  searchParams: Promise<{ reviewsPage?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();

  const [settings, { user, profile }, { reviewsPage: reviewsPageRaw }] =
    await Promise.all([
      getSettings(),
      getUserProfile(),
      searchParams,
    ]);

  const reviewsPage = Math.max(1, Number(reviewsPageRaw) || 1);

  // Public community feed (RLS: non-hidden rows are world-readable). Ranked so
  // rows with a written comment come first, then star-only ratings, then plain
  // completed-transaction rows - newest first within each tier.
  const { data: feedData } = await supabase
    .from("reviews")
    .select("*")
    .eq("hidden", false)
    .order("created_at", { ascending: false });
  const feedTier = (r: Review) => (r.comment ? 0 : r.rating != null ? 1 : 2);
  const sortedFeed = ((feedData ?? []) as Review[]).sort(
    (a, b) => feedTier(a) - feedTier(b),
  );
  const reviewsTotalPages = Math.max(
    1,
    Math.ceil(sortedFeed.length / REVIEWS_PER_PAGE),
  );
  const rangeStart = (reviewsPage - 1) * REVIEWS_PER_PAGE;
  const feed = sortedFeed.slice(rangeStart, rangeStart + REVIEWS_PER_PAGE);

  // "Latest and greatest" for the logged-out carousel: newest highly-rated
  // written reviews (sortedFeed is already newest-first within its comment tier).
  const carouselReviews = sortedFeed
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
            <PromoBanner initialSettings={settings} />
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
        myOrders={myOrders}
        reviewByOrder={reviewByOrder}
        isAuthenticated={Boolean(user)}
      />
    </div>
  );
}
