"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateSettings } from "@/lib/actions/admin";
import type { Settings } from "@/lib/supabase/types";

export function SettingsEditor({ settings }: { settings: Settings }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [form, setForm] = useState({
    buy_multiplier: String(settings.buy_multiplier),
    sell_multiplier: String(settings.sell_multiplier),
    buy_enabled: settings.buy_enabled,
    sell_enabled: settings.sell_enabled,
    timer_minutes: String(settings.timer_minutes),
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    const res = await updateSettings({
      buy_multiplier: Number(form.buy_multiplier),
      sell_multiplier: Number(form.sell_multiplier),
      buy_enabled: form.buy_enabled,
      sell_enabled: form.sell_enabled,
      timer_minutes: Number(form.timer_minutes),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    }
  }

  const numberField = (
    key: "buy_multiplier" | "sell_multiplier" | "timer_minutes",
    label: string,
  ) => (
    <label className="block">
      <span className="text-sm text-foreground/60">{label}</span>
      <input
        type="number"
        min="0"
        step={key === "timer_minutes" ? "1" : "0.01"}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
      />
    </label>
  );

  const toggle = (key: "buy_enabled" | "sell_enabled", label: string) => (
    <label className="flex items-center justify-between rounded-md border border-black/15 dark:border-white/20 px-3 py-2">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
        className="h-4 w-4"
      />
    </label>
  );

  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/15 p-5">
      <h2 className="font-semibold mb-4">{t("rates")}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {numberField("buy_multiplier", t("buyMultiplier"))}
        {numberField("sell_multiplier", t("sellMultiplier"))}
        {toggle("buy_enabled", t("buyEnabled"))}
        {toggle("sell_enabled", t("sellEnabled"))}
        {numberField("timer_minutes", t("timerMinutes"))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {t("save")}
        </button>
        {saved && <span className="text-sm text-green-600">{t("saved")}</span>}
      </div>
    </section>
  );
}
