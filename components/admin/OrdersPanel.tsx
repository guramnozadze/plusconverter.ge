"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { setOrderStatus } from "@/lib/actions/admin";
import { PlusBadge } from "@/components/PlusBadge";
import type { BankAccount, Order } from "@/lib/supabase/types";

export type AdminOrder = Order & {
  userLabel: string;
  username: string | null;
  userEmail: string | null;
  assignedBank: BankAccount | null;
};

export function OrdersPanel({ orders }: { orders: AdminOrder[] }) {
  const t = useTranslations("admin");
  const tOrder = useTranslations("order");
  const tConv = useTranslations("converter");
  const tSelect = useTranslations("selectAccount");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          {visible.map((o) => {
            const expanded = expandedId === o.id;
            return (
              <li
                key={o.id}
                className={`rounded-xl border text-sm ${
                  o.user_confirmed && o.status === "pending"
                    ? "border-orange-400 bg-orange-50 dark:border-orange-500/60 dark:bg-orange-500/10"
                    : "border-black/10 dark:border-white/15"
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(expanded ? null : o.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(expanded ? null : o.id);
                    }
                  }}
                  aria-expanded={expanded}
                  className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-3 py-2 text-left"
                >
                  <div>
                    <p className="font-medium">
                      {o.direction.toUpperCase()} · {o.gel_amount} {tConv("gel")} ↔{" "}
                      {o.points_amount} <PlusBadge />
                      {o.user_confirmed && o.status === "pending" && (
                        <span className="ml-2 inline-flex items-center whitespace-nowrap rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                          {t("paidBadge")}
                        </span>
                      )}
                    </p>
                    <p className="text-foreground/60 text-xs">
                      {o.userLabel} · {dateFmt.format(new Date(o.created_at))}
                    </p>
                  </div>
                  {o.status === "pending" ? (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
                </div>

                {expanded && (
                  <div className="space-y-2 border-t border-black/10 dark:border-white/15 px-3 py-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-foreground/60">{t("orderId")}</span>
                      <span className="font-mono">{o.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">{t("username")}</span>
                      <span>{o.username ? `@${o.username}` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">{t("user")}</span>
                      <span>{o.userEmail ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">{tOrder("accountName")}</span>
                      <span>{o.user_full_name ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">{tOrder("accountNumber")}</span>
                      <span className="font-mono">{o.user_account_number ?? "—"}</span>
                    </div>
                    {o.assignedBank && (
                      <div className="flex justify-between">
                        <span className="text-foreground/60">{tOrder("bank")}</span>
                        <span>
                          {o.assignedBank.bank_name} ·{" "}
                          <span className="font-mono">
                            {o.assignedBank.account_number}
                          </span>
                        </span>
                      </div>
                    )}
                    {o.comment && (
                      <div className="flex justify-between gap-3">
                        <span className="shrink-0 text-foreground/60">
                          {tSelect("comment")}
                        </span>
                        <span className="text-right break-words">{o.comment}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-foreground/60">{t("rateUsed")}</span>
                      <span>{o.rate_used}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">{t("date")}</span>
                      <span>{dateFmt.format(new Date(o.created_at))}</span>
                    </div>
                    {o.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-foreground/60">{t("completedAt")}</span>
                        <span>{dateFmt.format(new Date(o.completed_at))}</span>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
