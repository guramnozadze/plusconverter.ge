import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { ReviewsPanel } from "@/components/admin/ReviewsPanel";
import type { Review } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const { profile } = await getUserProfile();
  if (!profile?.is_admin) {
    return <p className="text-foreground/70">{t("notAuthorized")}</p>;
  }

  const supabase = await createClient();
  const { data: reviewsData } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });
  const reviews = (reviewsData ?? []) as Review[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link
          href="/admin"
          prefetch={false}
          className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm font-medium"
        >
          {t("ordersLink")}
        </Link>
      </div>
      <ReviewsPanel reviews={reviews} />
    </div>
  );
}
