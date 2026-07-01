"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  createBankAccount,
  deleteBankAccount,
  updateBankAccountStatus,
} from "@/lib/actions/admin";
import type { BankAccount, BankAccountStatus } from "@/lib/supabase/types";

const STATUSES: BankAccountStatus[] = ["available", "unavailable", "sold_out"];

export function BankAccountsManager({ accounts }: { accounts: BankAccount[] }) {
  const t = useTranslations("admin");
  const tStatus = useTranslations("bankStatus");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    bank_name: "",
    account_name: "",
    account_number: "",
    id_number: "",
  });

  async function add() {
    if (!form.bank_name || !form.account_name || !form.account_number) return;
    setBusy(true);
    const res = await createBankAccount({
      ...form,
      id_number: form.id_number || undefined,
      status: "available",
      sort_order: accounts.length + 1,
    });
    setBusy(false);
    if (res.ok) {
      setForm({ bank_name: "", account_name: "", account_number: "", id_number: "" });
      router.refresh();
    }
  }

  async function changeStatus(id: string, status: BankAccountStatus) {
    await updateBankAccountStatus(id, status);
    router.refresh();
  }

  async function remove(id: string) {
    await deleteBankAccount(id);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/15 p-5">
      <h2 className="font-semibold mb-4">{t("bankAccounts")}</h2>

      <ul className="space-y-2 mb-4">
        {accounts.map((acc) => (
          <li
            key={acc.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{acc.bank_name}</p>
              <p className="text-foreground/60 font-mono text-xs">
                {acc.account_number} · {acc.account_name}
                {acc.id_number && ` · ${acc.id_number}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={acc.status}
                onChange={(e) =>
                  changeStatus(acc.id, e.target.value as BankAccountStatus)
                }
                className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-xs"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tStatus(s)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(acc.id)}
                className="rounded-md border border-red-300 text-red-600 px-2 py-1 text-xs"
              >
                {t("delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid sm:grid-cols-4 gap-2">
        <input
          value={form.bank_name}
          onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
          placeholder={t("bankName")}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        <input
          value={form.account_name}
          onChange={(e) => setForm({ ...form, account_name: e.target.value })}
          placeholder={t("accountName")}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        <input
          value={form.account_number}
          onChange={(e) => setForm({ ...form, account_number: e.target.value })}
          placeholder={t("accountNumber")}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        <input
          value={form.id_number}
          onChange={(e) => setForm({ ...form, id_number: e.target.value })}
          placeholder={t("idNumber")}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="mt-3 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {t("addAccount")}
      </button>
    </section>
  );
}
