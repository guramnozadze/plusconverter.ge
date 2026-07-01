"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createOrder } from "@/lib/actions/orders";
import { BankStatusBadge } from "./BankStatusBadge";
import type { BankAccount, OrderDirection } from "@/lib/supabase/types";

type Props = {
  direction: OrderDirection;
  points: number;
  accounts: BankAccount[];
  defaultFullName: string;
  defaultAccountNumber: string;
};

export function AccountPicker({
  direction,
  points,
  accounts,
  defaultFullName,
  defaultAccountNumber,
}: Props) {
  const t = useTranslations("selectAccount");
  const router = useRouter();

  const available = accounts.filter((a) => a.status === "available");
  const others = accounts.filter((a) => a.status !== "available");

  const [selectedId, setSelectedId] = useState(available[0]?.id ?? "");
  // Prefilled from the user's profile defaults; editable for this order only.
  const [fullName, setFullName] = useState(defaultFullName);
  const [accountNumber, setAccountNumber] = useState(defaultAccountNumber);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsProvided =
    fullName.trim() !== "" && accountNumber.trim() !== "";

  async function confirm() {
    if (!selectedId || !detailsProvided) return;
    setError(null);
    setBusy(true);
    const result = await createOrder({
      direction,
      points,
      bankAccountId: selectedId,
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
      {available.length === 0 ? (
        <p className="rounded-xl border border-black/10 dark:border-white/15 p-4 text-sm text-foreground/60">
          {t("noneAvailable")}
        </p>
      ) : (
        <ul className="space-y-2">
          {available.map((acc) => {
            const active = acc.id === selectedId;
            return (
              <li key={acc.id}>
                <label
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 ${
                    active
                      ? "border-foreground ring-2 ring-foreground/30"
                      : "border-black/10 dark:border-white/15"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{acc.bank_name}</span>
                    <span className="block text-sm text-foreground/60">
                      {acc.account_name} ·{" "}
                      <span className="font-mono">{acc.account_number}</span>
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="account"
                    value={acc.id}
                    checked={active}
                    onChange={() => setSelectedId(acc.id)}
                    className="size-4 accent-foreground"
                  />
                </label>
              </li>
            );
          })}
        </ul>
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
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/30"
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
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-foreground/30"
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
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{t("error")}</p>
      )}

      <button
        type="button"
        onClick={confirm}
        disabled={!selectedId || busy || !detailsProvided}
        className="w-full rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-40"
      >
        {t("confirm")}
      </button>

      {/* Other accounts shown for scarcity, not selectable. */}
      {others.length > 0 && (
        <div>
          <p className="text-sm text-foreground/60 mb-2">{t("otherAccounts")}</p>
          <ul className="space-y-2">
            {others.map((acc) => (
              <li
                key={acc.id}
                className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/15 px-3 py-2 text-sm opacity-60"
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
