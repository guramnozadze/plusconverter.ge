import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { OrderView } from "@/components/OrderView";
import type { BankAccount } from "@/lib/supabase/types";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();

  // RLS guarantees the caller can only read their own order (or any as admin).
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const [accountsRes, settings, reviewRes, profileRes, { user }] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("sort_order"),
    getSettings(),
    supabase.from("reviews").select("rating").eq("order_id", id).maybeSingle(),
    supabase.from("profiles").select("username").eq("id", order.user_id).maybeSingle(),
    getUserProfile(),
  ]);
  const accounts = (accountsRes.data ?? []) as BankAccount[];
  const alreadyReviewed = reviewRes.data?.rating != null;
  const hasUsername = Boolean(profileRes.data?.username?.trim());

  const assigned =
    accounts.find((a) => a.id === order.bank_account_id) ??
    accounts.find((a) => a.status === "available") ??
    null;

  const expiresAt = new Date(
    new Date(order.created_at).getTime() + settings.timer_minutes * 60_000,
  ).toISOString();

  return (
    <div>
      <OrderView
        order={order}
        assigned={assigned}
        expiresAt={expiresAt}
        alreadyReviewed={alreadyReviewed}
        hasUsername={hasUsername}
        userEmail={user?.email ?? null}
      />
    </div>
  );
}
