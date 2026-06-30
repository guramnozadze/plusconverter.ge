"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeConversion, isDirectionEnabled } from "@/lib/pricing";
import { createOrder } from "@/lib/actions/orders";
import type { OrderDirection, Settings } from "@/lib/supabase/types";

type Props = {
  initialSettings: Settings;
  isAuthenticated: boolean;
};

export function Converter({ initialSettings, isAuthenticated }: Props) {
  const t = useTranslations("converter");
  const locale = useLocale();
  const router = useRouter();

  const [settings, setSettings] = useState(initialSettings);
  const [direction, setDirection] = useState<OrderDirection>("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live price: update rates instantly when the owner changes them.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("settings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload) => setSettings(payload.new as Settings),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const numericAmount = Number(amount);
  const hasAmount = amount !== "" && Number.isFinite(numericAmount) && numericAmount > 0;
  const enabled = isDirectionEnabled(direction, settings);

  const conversion = useMemo(
    () => (hasAmount ? computeConversion(direction, numericAmount, settings) : null),
    [hasAmount, direction, numericAmount, settings],
  );

  const gelFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );
  const pointsFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );

  const rate = direction === "buy" ? settings.buy_rate : settings.sell_rate;
  const inputUnit = direction === "buy" ? t("gel") : t("points");
  const outputUnit = direction === "buy" ? t("points") : t("gel");
  const outputValue = conversion
    ? direction === "buy"
      ? pointsFmt.format(conversion.points)
      : gelFmt.format(conversion.gel)
    : "0";

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    const next = window.location.pathname + window.location.search;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function submit() {
    if (!hasAmount || !enabled) return;
    setError(null);
    setBusy(true);
    const result = await createOrder({ direction, amount: numericAmount });
    if (result.ok) {
      router.push(`/order/${result.orderId}`);
    } else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/15 p-5 sm:p-6">
      <h1 className="text-xl font-semibold mb-4">{t("title")}</h1>

      {/* Direction toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/5 dark:bg-white/10 p-1 mb-5">
        {(["buy", "sell"] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => {
              setDirection(dir);
              setError(null);
            }}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              direction === dir
                ? "bg-background shadow-sm"
                : "text-foreground/60"
            }`}
            aria-pressed={direction === dir}
          >
            {t(dir)}
          </button>
        ))}
      </div>

      {/* Input */}
      <label className="block text-sm text-foreground/60 mb-1">
        {t("youPay")}
      </label>
      <div className="flex items-center rounded-lg border border-black/15 dark:border-white/20 px-3 mb-4 focus-within:ring-2 focus-within:ring-foreground/30">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="flex-1 bg-transparent py-3 text-lg outline-none"
        />
        <span className="text-sm font-medium text-foreground/60">{inputUnit}</span>
      </div>

      {/* Output */}
      <label className="block text-sm text-foreground/60 mb-1">
        {t("youGet")}
      </label>
      <div className="flex items-center justify-between rounded-lg bg-black/5 dark:bg-white/10 px-3 py-3 mb-2">
        <span className="text-lg font-semibold tabular-nums">{outputValue}</span>
        <span className="text-sm font-medium text-foreground/60">{outputUnit}</span>
      </div>

      <p className="text-xs text-foreground/50 mb-5">
        {direction === "buy"
          ? t("rateBuy", { rate: pointsFmt.format(rate) })
          : t("rateSell", { rate: pointsFmt.format(rate) })}
      </p>

      {!enabled && (
        <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
          {direction === "buy" ? t("buyDisabled") : t("sellDisabled")}
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {isAuthenticated ? (
        <button
          type="button"
          onClick={submit}
          disabled={!hasAmount || !enabled || busy}
          className="w-full rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-40"
        >
          {t("continue")}
        </button>
      ) : (
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="w-full rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50"
        >
          {t("loginToContinue")}
        </button>
      )}
    </div>
  );
}
