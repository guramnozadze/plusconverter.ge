import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getUserProfile } from "@/lib/auth";
import { getBankAccounts, getSettings } from "@/lib/data";
import { quote } from "@/lib/pricing";
import { AccountPicker } from "@/components/AccountPicker";
import type { OrderDirection } from "@/lib/supabase/types";

export default async function NewOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ direction?: string; points?: string }>;
}) {
  const { locale: candidateLocale } = await params;
  const locale = hasLocale(routing.locales, candidateLocale)
    ? candidateLocale
    : routing.defaultLocale;
  setRequestLocale(locale);
  const sp = await searchParams;

  const direction: OrderDirection | null =
    sp.direction === "buy" || sp.direction === "sell" ? sp.direction : null;
  const points = Number(sp.points);
  if (!direction || !Number.isFinite(points) || points <= 0) {
    redirect({ href: "/", locale });
  }

  // Selecting an account creates an order, so require a signed-in user here too.
  // Fetched in parallel with the bank accounts/settings — none of these depend
  // on each other, and `getUserProfile` is memoized so this reuses the Header's
  // auth call rather than making a second round-trip.
  const [{ user, profile }, accounts, settings] = await Promise.all([
    getUserProfile(),
    getBankAccounts(),
    getSettings(),
  ]);
  if (!user) {
    redirect({ href: "/", locale });
  }
  const t = await getTranslations("selectAccount");

  // Transaction summary headline (e.g. "Selling 1,000 PLUS Points for 3.75 GEL").
  const { gel } = quote(direction!, points, settings);
  const pointsStr = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(points);
  const gelStr = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(gel);
  const summary = t(direction === "sell" ? "summarySell" : "summaryBuy", {
    points: pointsStr,
    gel: gelStr,
  });

  return (
    <div>
      <h1 className="text-base font-semibold mb-4">{summary}</h1>
      <AccountPicker
        direction={direction!}
        points={points}
        accounts={accounts}
        defaultFullName={profile?.full_name ?? ""}
        defaultAccountNumber={profile?.account_number ?? ""}
      />
    </div>
  );
}
