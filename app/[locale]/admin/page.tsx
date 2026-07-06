import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { Link } from "@/i18n/navigation";
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
    supabase.from("orders").select("*").order("created_at", { ascending: true }),
    supabase.from("profiles").select("*"),
  ]);

  const accounts = (accountsRes.data ?? []) as BankAccount[];
  const orders = (ordersRes.data ?? []) as Order[];
  const profiles = (profilesRes.data ?? []) as Profile[];

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const bankById = new Map(accounts.map((a) => [a.id, a]));
  const adminOrders: AdminOrder[] = orders.map((o) => {
    const p = profileById.get(o.user_id);
    return {
      ...o,
      userLabel: p?.username || p?.email || o.user_id,
      username: p?.username ?? null,
      userEmail: p?.email ?? null,
      assignedBank: o.bank_account_id ? bankById.get(o.bank_account_id) ?? null : null,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link
          href="/admin/reviews"
          prefetch={false}
          className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm font-medium"
        >
          {t("reviewsLink")}
        </Link>
      </div>
      <SettingsEditor settings={settings} />
      <BankAccountsManager accounts={accounts} />
      <OrdersPanel orders={adminOrders} />
    </div>
  );
}
