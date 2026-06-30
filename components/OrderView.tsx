"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { markOrderPaid } from "@/lib/actions/orders";
import { BankStatusBadge } from "./BankStatusBadge";
import type { BankAccount, Order } from "@/lib/supabase/types";

type Props = {
  order: Order;
  assigned: BankAccount | null;
  others: BankAccount[];
  expiresAt: string;
};

function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );
  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

export function OrderView({ order, assigned, others, expiresAt }: Props) {
  const t = useTranslations("order");
  const locale = useLocale();
  const router = useRouter();
  const remaining = useCountdown(expiresAt);
  const [confirmed, setConfirmed] = useState(order.user_confirmed);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const gelFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );
  const pointsFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );

  const sendLabel =
    order.direction === "buy"
      ? `${gelFmt.format(order.gel_amount)} GEL`
      : `${pointsFmt.format(order.points_amount)} PLUS`;
  const receiveLabel =
    order.direction === "buy"
      ? `${pointsFmt.format(order.points_amount)} PLUS`
      : `${gelFmt.format(order.gel_amount)} GEL`;

  const expired = remaining <= 0;
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  async function pay() {
    setBusy(true);
    const res = await markOrderPaid(order.id);
    if (res.ok) {
      setConfirmed(true);
      router.refresh();
    }
    setBusy(false);
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (order.status !== "pending") {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/15 p-6 text-center">
        <p className="text-lg font-medium">{t(`status.${order.status}`)}</p>
        <p className="mt-2 text-sm text-foreground/60">
          {receiveLabel} · {sendLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timer */}
      <div className="rounded-2xl border border-black/10 dark:border-white/15 p-4 text-center">
        <p className="text-sm text-foreground/60">{t("timeLeft")}</p>
        {expired ? (
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
            {t("expired")}
          </p>
        ) : (
          <p className="text-3xl font-semibold tabular-nums">
            {minutes}:{String(seconds).padStart(2, "0")}
          </p>
        )}
      </div>

      <p className="text-sm text-foreground/70">{t("instructions")}</p>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/5 dark:bg-white/10 p-3">
          <p className="text-xs text-foreground/60">{t("youSend")}</p>
          <p className="font-semibold tabular-nums">{sendLabel}</p>
        </div>
        <div className="rounded-xl bg-black/5 dark:bg-white/10 p-3">
          <p className="text-xs text-foreground/60">{t("youReceive")}</p>
          <p className="font-semibold tabular-nums">{receiveLabel}</p>
        </div>
      </div>

      {/* Assigned account */}
      {assigned && (
        <div className="rounded-2xl border border-black/10 dark:border-white/15 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-foreground/60">{t("bank")}</span>
            <span>{assigned.bank_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-foreground/60">{t("accountName")}</span>
            <span>{assigned.account_name}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground/60">{t("accountNumber")}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono">{assigned.account_number}</span>
              <button
                type="button"
                onClick={() => copy(assigned.account_number)}
                className="rounded-md border border-black/15 dark:border-white/20 px-2 py-0.5 text-xs"
                aria-label={t("accountNumber")}
              >
                {copied ? "✓" : "⧉"}
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Pay button */}
      <button
        type="button"
        onClick={pay}
        disabled={busy || confirmed}
        className="w-full rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50"
      >
        {confirmed ? t("paidConfirmed") : t("paid")}
      </button>

      {/* Other accounts (scarcity) */}
      {others.length > 0 && (
        <div>
          <p className="text-sm text-foreground/60 mb-2">{t("otherAccounts")}</p>
          <ul className="space-y-2">
            {others.map((acc) => (
              <li
                key={acc.id}
                className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
              >
                <span>
                  {acc.bank_name} ·{" "}
                  <span className="font-mono text-foreground/70">
                    {acc.account_number}
                  </span>
                </span>
                <BankStatusBadge status={acc.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
