import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const t = await getTranslations("order");

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

  const [accountsRes, settings] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("sort_order"),
    getSettings(),
  ]);
  const accounts = (accountsRes.data ?? []) as BankAccount[];

  const assigned =
    accounts.find((a) => a.id === order.bank_account_id) ??
    accounts.find((a) => a.status === "available") ??
    null;
  const others = accounts.filter((a) => a.id !== assigned?.id);

  const expiresAt = new Date(
    new Date(order.created_at).getTime() + settings.timer_minutes * 60_000,
  ).toISOString();

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">{t("title")}</h1>
      <OrderView
        order={order}
        assigned={assigned}
        others={others}
        expiresAt={expiresAt}
      />
    </div>
  );
}
