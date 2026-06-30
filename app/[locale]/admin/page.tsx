import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { BankAccountsManager } from "@/components/admin/BankAccountsManager";
import { OrdersPanel, type AdminOrder } from "@/components/admin/OrdersPanel";
import type { BankAccount, Order, Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminPage({
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
  const [settings, accountsRes, ordersRes, profilesRes] = await Promise.all([
    getSettings(),
    supabase.from("bank_accounts").select("*").order("sort_order"),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);

  const accounts = (accountsRes.data ?? []) as BankAccount[];
  const orders = (ordersRes.data ?? []) as Order[];
  const profiles = (profilesRes.data ?? []) as Profile[];

  const labelById = new Map(
    profiles.map((p) => [p.id, p.username || p.email || p.id]),
  );
  const adminOrders: AdminOrder[] = orders.map((o) => ({
    ...o,
    userLabel: labelById.get(o.user_id) ?? o.user_id,
  }));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <SettingsEditor settings={settings} />
      <BankAccountsManager accounts={accounts} />
      <OrdersPanel orders={adminOrders} />
    </div>
  );
}
