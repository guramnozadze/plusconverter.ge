"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { markOrderPaid } from "@/lib/actions/orders";
import { saveProfile } from "@/lib/actions/profile";
import { PlusBadge } from "./PlusBadge";
import { ReviewForm } from "./ReviewForm";
import type { BankAccount, Order } from "@/lib/supabase/types";

type Props = {
  order: Order;
  assigned: BankAccount | null;
  expiresAt: string;
  alreadyReviewed: boolean;
  hasUsername: boolean;
};

function useCountdown(expiresAt: string, paused: boolean) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );
  useEffect(() => {
    if (paused) return;
    const tick = () =>
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, paused]);
  return remaining;
}

export function OrderView({
  order,
  assigned,
  expiresAt,
  alreadyReviewed,
  hasUsername,
}: Props) {
  const t = useTranslations("order");
  const tc = useTranslations("converter");
  const tp = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(order.user_confirmed);
  const remaining = useCountdown(expiresAt, confirmed);
  const [busy, setBusy] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Live: reflect admin actions (completion/cancellation) without a manual
  // refresh. RLS scopes this to the caller's own order.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id, router]);

  const gelFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );
  const pointsFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );

  const gelNode = (amount: number) => (
    <>
      {gelFmt.format(amount)} {tc("gel")}
    </>
  );
  const plusNode = (amount: number) => (
    <>
      {pointsFmt.format(amount)} <PlusBadge />
    </>
  );
  const sendLabel =
    order.direction === "buy"
      ? gelNode(order.gel_amount)
      : plusNode(order.points_amount);
  const receiveLabel =
    order.direction === "buy"
      ? plusNode(order.points_amount)
      : gelNode(order.gel_amount);

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

  async function saveUsername() {
    setUsernameBusy(true);
    setUsernameError(null);
    const res = await saveProfile({ username });
    setUsernameBusy(false);
    if (res.ok) {
      setUsernameSaved(true);
      router.refresh();
    } else {
      setUsernameError(res.error ?? "update_failed");
    }
  }

  async function copy(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (order.status !== "pending") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold mb-2.5">{t("title")}</h1>
        <div className="rounded-2xl border border-black/10 dark:border-white/15 p-6 text-center">
          <p className="text-lg font-medium">{t(`status.${order.status}`)}</p>
          <p className="mt-2 text-sm text-foreground/60">
            {receiveLabel} · {sendLabel}
          </p>
        </div>
        {order.status === "completed" && !alreadyReviewed && (
          <ReviewForm orderId={order.id} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!confirmed && (
        <h1 className="text-xl font-semibold mb-2.5">{t("title")}</h1>
      )}

      {/* Timer */}
      <div className="rounded-2xl border border-black/10 dark:border-white/15 p-4 text-center">
        {confirmed ? (
          <p className="flex items-center justify-center gap-2 text-lg font-semibold text-amber-600 dark:text-amber-400">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            {t("processing")}
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>

      <p className="text-sm text-foreground/70">
        {t.rich("instructions", {
          direction: order.direction,
          paid: (chunks) => (
            <span className="font-bold uppercase text-orange-600 dark:text-orange-400">
              {chunks}
            </span>
          ),
        })}
      </p>

      {/* Big, easy-to-copy ID number card — sell orders only. Sellers transfer
          PLUS points to this ID, not a bank account number, so it gets top
          billing above everything else. */}
      {order.direction === "sell" && assigned?.id_number && (
        <div className="rounded-2xl border-2 border-black/15 dark:border-white/25 p-4 text-center space-y-1">
          <p className="text-xs text-foreground/60">{t("sendPointsHere")}</p>
          <button
            type="button"
            onClick={() => copy("id_number_big", assigned.id_number!)}
            className="mx-auto flex items-center gap-2 font-mono text-2xl font-bold tabular-nums"
            aria-label={t("idNumber")}
          >
            {assigned.id_number}
            <span className="text-base">
              {copiedField === "id_number_big" ? "✓" : "⧉"}
            </span>
          </button>
        </div>
      )}

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
          {order.direction !== "sell" && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground/60">{t("accountNumber")}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{assigned.account_number}</span>
                <button
                  type="button"
                  onClick={() => copy("account_number", assigned.account_number)}
                  className="rounded-md border border-black/15 dark:border-white/20 px-2 py-0.5 text-xs"
                  aria-label={t("accountNumber")}
                >
                  {copiedField === "account_number" ? "✓" : "⧉"}
                </button>
              </span>
            </div>
          )}
          {assigned.id_number && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground/60">{t("idNumber")}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{assigned.id_number}</span>
                <button
                  type="button"
                  onClick={() => copy("id_number", assigned.id_number!)}
                  className="rounded-md border border-black/15 dark:border-white/20 px-2 py-0.5 text-xs"
                  aria-label={t("idNumber")}
                >
                  {copiedField === "id_number" ? "✓" : "⧉"}
                </button>
              </span>
            </div>
          )}
        </div>
      )}

      {/* The user's own account (snapshotted at order time): where they send
          from / receive to. Shown to the owner and, for sell orders, the admin. */}
      {(order.user_full_name || order.user_account_number) && (
        <div className="rounded-2xl border border-black/10 dark:border-white/15 p-4 space-y-2">
          <div>
            <span className="text-sm font-medium">{t("yourAccount")}</span>
            <span className="text-xs text-foreground/60">
              {" — "}
              {t("yourAccountHint", {
                direction: order.direction,
                amount:
                  order.direction === "sell"
                    ? gelFmt.format(order.gel_amount)
                    : pointsFmt.format(order.points_amount),
              })}
            </span>
          </div>
          {order.user_full_name && (
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">{t("accountName")}</span>
              <span>{order.user_full_name}</span>
            </div>
          )}
          {order.user_account_number && (
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">{t("accountNumber")}</span>
              <span className="font-mono">{order.user_account_number}</span>
            </div>
          )}
        </div>
      )}

      {/* Pay button — amber/warning styled (not the site's default black/white
          button) since tapping it is an irreversible declaration that money
          was actually sent, not just a "continue" action. */}
      <button
        type="button"
        onClick={pay}
        disabled={busy || confirmed}
        className={`w-full rounded-lg py-3 font-bold transition-colors ${
          confirmed
            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            : "bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        }`}
      >
        {confirmed ? t("paidConfirmed") : t("paid")}
      </button>

      {/* Nudge to set a username right here — inline input rather than
          sending them off to the profile card, since this is a one-field ask.
          Only shown once they've reported payment, so it doesn't distract
          from paying. */}
      {confirmed && !hasUsername && !usernameSaved && (
        <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 text-sm space-y-2">
          <p className="text-foreground/70">{t("usernameNudge")}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.replace(/\s/g, ""));
                setUsernameError(null);
              }}
              maxLength={32}
              placeholder={tp("usernamePlaceholder")}
              className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/30"
            />
            <button
              type="button"
              onClick={saveUsername}
              disabled={usernameBusy || !username.trim()}
              className="shrink-0 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {tp("save")}
            </button>
          </div>
          {(usernameError === "username_taken" ||
            usernameError === "username_invalid") && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {tp(usernameError === "username_taken" ? "usernameTaken" : "usernameInvalid")}
            </p>
          )}
        </div>
      )}

      {/* Support contact — only surfaces once the user has reported payment */}
      {confirmed && (
        <p className="text-center text-sm text-foreground/60">
          {t("support")}{" "}
          <a
            href="https://t.me/plusconverter"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            @plusconverter
          </a>
        </p>
      )}
    </div>
  );
}
