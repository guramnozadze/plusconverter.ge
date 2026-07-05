"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createOrder } from "@/lib/actions/orders";
import type { BankAccount, OrderDirection } from "@/lib/supabase/types";

type Props = {
  direction: OrderDirection;
  points: number;
  accounts: BankAccount[];
  defaultFullName: string;
  defaultAccountNumber: string;
};

// createOrder error codes that have their own user-facing message; anything
// else (insert_failed, invalid_*) falls back to the generic one.
const KNOWN_ORDER_ERRORS = new Set([
  "direction_disabled",
  "below_minimum",
  "above_maximum",
  "account_unavailable",
  "order_limit_reached",
]);

export function AccountPicker({
  direction,
  points,
  accounts,
  defaultFullName,
  defaultAccountNumber,
}: Props) {
  const t = useTranslations("selectAccount");
  const router = useRouter();

  // No account is shown to the user for selection — the server assigns the
  // first available one automatically (see createOrder's fallback). We only
  // need this to know whether one exists at all, to block submission if not.
  const hasAvailable = accounts.some((a) => a.status === "available");

  // Prefilled from the user's profile defaults; editable for this order only.
  const [fullName, setFullName] = useState(defaultFullName);
  const [accountNumber, setAccountNumber] = useState(defaultAccountNumber);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsProvided =
    fullName.trim() !== "" && accountNumber.trim() !== "";

  async function confirm() {
    if (!hasAvailable || !detailsProvided) return;
    setError(null);
    setBusy(true);
    const result = await createOrder({
      direction,
      points,
      fullName,
      accountNumber,
      comment,
    });
    if (result.ok) {
      router.push(`/order/${result.orderId}`);
    } else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!hasAvailable && (
        <p className="rounded-xl border border-black/10 dark:border-white/15 p-4 text-sm text-foreground/60">
          {t("noneAvailable")}
        </p>
      )}

      {/* The user's own bank details for this order (prefilled from profile,
          required to submit). */}
      <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold">{t("yourDetails")}</h2>
          <p className="mt-0.5 text-sm text-foreground/60">
            {t("yourDetailsHint", { direction })}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-foreground/60">
            {t("yourFullName")} <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-foreground/60">
            {t("yourAccountNumber")} <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            maxLength={40}
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 font-mono text-base sm:text-sm outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-foreground/60">
            {t("comment")}{" "}
            <span className="text-foreground/40">({t("optional")})</span>
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={t("commentPlaceholder")}
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-foreground/30 placeholder:text-xs"
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {KNOWN_ORDER_ERRORS.has(error) ? t(`errors.${error}`) : t("error")}
        </p>
      )}

      <button
        type="button"
        onClick={confirm}
        disabled={!hasAvailable || busy || !detailsProvided}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-40"
      >
        {busy && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/40 border-t-background" />
        )}
        {t("confirm")}
      </button>
    </div>
  );
}
