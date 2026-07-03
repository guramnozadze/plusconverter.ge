import { setRequestLocale } from "next-intl/server";
import { getSettings, getTotalPointsSold } from "@/lib/data";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Converter } from "@/components/Converter";
import { PromoBanner } from "@/components/PromoBanner";
import { ProfileCard } from "@/components/ProfileCard";
import { ActivityTabs } from "@/components/ActivityTabs";
import type { Order, Review } from "@/lib/supabase/types";

const REVIEWS_PER_PAGE = 10;

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

  const [settings, totalPointsSold, { user, profile }, { reviewsPage: reviewsPageRaw }] =
    await Promise.all([
      getSettings(),
      getTotalPointsSold(),
      getUserProfile(),
      searchParams,
    ]);

  const reviewsPage = Math.max(1, Number(reviewsPageRaw) || 1);
  const rangeStart = (reviewsPage - 1) * REVIEWS_PER_PAGE;

  // Public community feed (RLS: non-hidden rows are world-readable).
  const { data: feedData, count: feedCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact" })
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeStart + REVIEWS_PER_PAGE - 1);
  const feed = (feedData ?? []) as Review[];
  const reviewsTotalPages = Math.max(
    1,
    Math.ceil((feedCount ?? 0) / REVIEWS_PER_PAGE),
  );

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

  const hasUsername = Boolean(profile?.username && profile.username.trim());

  return (
    <div>
      <PromoBanner initialSettings={settings} />
      {user && profile && <ProfileCard profile={profile} />}
      <Converter
        initialSettings={settings}
        isAuthenticated={Boolean(user)}
        totalPointsSold={totalPointsSold}
      />
      <ActivityTabs
        feed={feed}
        reviewsPage={reviewsPage}
        reviewsTotalPages={reviewsTotalPages}
        myOrders={myOrders}
        reviewByOrder={reviewByOrder}
        isAuthenticated={Boolean(user)}
        hasUsername={hasUsername}
      />
    </div>
  );
}
