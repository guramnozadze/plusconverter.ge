"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { setOrderStatus } from "@/lib/actions/admin";
import type { Order } from "@/lib/supabase/types";

export type AdminOrder = Order & { userLabel: string };

export function OrdersPanel({ orders }: { orders: AdminOrder[] }) {
  const t = useTranslations("admin");
  const tOrder = useTranslations("order");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "history">("pending");

  // Live: refetch when any order changes (new submission, status edit).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }),
    [locale],
  );

  const visible = orders.filter((o) =>
    tab === "pending" ? o.status === "pending" : o.status !== "pending",
  );

  async function act(id: string, status: "completed" | "cancelled") {
    await setOrderStatus(id, status);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/15 p-5">
      <h2 className="font-semibold mb-4">{t("orders")}</h2>

      <div className="inline-flex rounded-lg bg-black/5 dark:bg-white/10 p-1 mb-4 text-sm">
        {(["pending", "history"] as const).map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={`rounded-md px-3 py-1.5 ${
              tab === tb ? "bg-background shadow-sm font-medium" : "text-foreground/60"
            }`}
          >
            {tb === "pending" ? t("pendingTab") : t("historyTab")}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("noOrders")}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {o.direction.toUpperCase()} · {o.gel_amount} GEL ↔{" "}
                  {o.points_amount} PLUS
                </p>
                <p className="text-foreground/60 text-xs">
                  {o.userLabel}
                  {o.user_confirmed && o.status === "pending" ? " · 💸" : ""} ·{" "}
                  {dateFmt.format(new Date(o.created_at))}
                </p>
              </div>
              {o.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(o.id, "completed")}
                    className="rounded-md bg-green-600 text-white px-3 py-1 text-xs"
                  >
                    {t("markCompleted")}
                  </button>
                  <button
                    type="button"
                    onClick={() => act(o.id, "cancelled")}
                    className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1 text-xs"
                  >
                    {t("markCancelled")}
                  </button>
                </div>
              ) : (
                <span className="text-xs text-foreground/60">
                  {tOrder(`status.${o.status}`)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
