"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  bankValueGel,
  gelFromPoints,
  isDirectionEnabled,
  julyValueGel,
  multiplierFor,
  pointsFromGel,
} from "@/lib/pricing";
import { createOrder } from "@/lib/actions/orders";
import type { OrderDirection, Settings } from "@/lib/supabase/types";

type Props = {
  initialSettings: Settings;
  isAuthenticated: boolean;
};

function fmtField(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  // Trim trailing zeros from the computed field for readability.
  return String(Number(n.toFixed(2)));
}

export function Converter({ initialSettings, isAuthenticated }: Props) {
  const t = useTranslations("converter");
  const locale = useLocale();
  const router = useRouter();

  const [settings, setSettings] = useState(initialSettings);
  const [direction, setDirection] = useState<OrderDirection>("buy");
  const [gel, setGel] = useState("");
  const [points, setPoints] = useState("");
  const anchor = useRef<"gel" | "points">("points");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const multiplier = multiplierFor(direction, settings);

  // Live price: update multipliers instantly when the owner changes them.
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

  // Recompute the dependent field whenever the multiplier (live) or direction
  // changes, anchored on whichever field the user last edited.
  useEffect(() => {
    if (anchor.current === "points") {
      const p = Number(points);
      setGel(p > 0 ? fmtField(gelFromPoints(p, multiplier)) : "");
    } else {
      const g = Number(gel);
      setPoints(g > 0 ? fmtField(pointsFromGel(g, multiplier)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplier, direction]);

  const onPointsChange = useCallback(
    (v: string) => {
      anchor.current = "points";
      setPoints(v);
      const p = Number(v);
      setGel(v !== "" && p > 0 ? fmtField(gelFromPoints(p, multiplier)) : "");
    },
    [multiplier],
  );

  const onGelChange = useCallback(
    (v: string) => {
      anchor.current = "gel";
      setGel(v);
      const g = Number(v);
      setPoints(v !== "" && g > 0 ? fmtField(pointsFromGel(g, multiplier)) : "");
    },
    [multiplier],
  );

  const pointsNum = Number(points);
  const hasPoints = points !== "" && Number.isFinite(pointsNum) && pointsNum > 0;
  const enabled = isDirectionEnabled(direction, settings);

  const gelFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );

  const pointsHint = hasPoints
    ? direction === "buy"
      ? t("worthJuly", { gel: gelFmt.format(julyValueGel(pointsNum)) })
      : t("worthInBank", { gel: gelFmt.format(bankValueGel(pointsNum)) })
    : null;

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
    if (!hasPoints || !enabled) return;
    setError(null);
    setBusy(true);
    const result = await createOrder({ direction, points: pointsNum });
    if (result.ok) {
      router.push(`/order/${result.orderId}`);
    } else {
      setError(result.error);
      setBusy(false);
    }
  }

  // Field renderers — order flips by direction.
  const gelField = (label: string) => (
    <div>
      <label className="block text-sm text-foreground/60 mb-1">{label}</label>
      <div className="flex items-center rounded-lg border border-black/15 dark:border-white/20 px-3 focus-within:ring-2 focus-within:ring-foreground/30">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={gel}
          onChange={(e) => onGelChange(e.target.value)}
          placeholder="0"
          className="flex-1 bg-transparent py-3 text-lg outline-none"
        />
        <span className="text-sm font-medium text-foreground/60">{t("gel")}</span>
      </div>
    </div>
  );

  const pointsField = (label: string) => (
    <div>
      <label className="block text-sm text-foreground/60 mb-1">{label}</label>
      <div className="flex items-center rounded-lg border border-black/15 dark:border-white/20 px-3 focus-within:ring-2 focus-within:ring-foreground/30">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={points}
          onChange={(e) => onPointsChange(e.target.value)}
          placeholder="0"
          className="flex-1 bg-transparent py-3 text-lg outline-none"
        />
        <span className="text-sm font-medium text-foreground/60">
          {t("points")}
        </span>
      </div>
      <p className="mt-1 h-4 text-xs text-foreground/50">{pointsHint}</p>
    </div>
  );

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
              direction === dir ? "bg-background shadow-sm" : "text-foreground/60"
            }`}
            aria-pressed={direction === dir}
          >
            {t(dir)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {direction === "buy" ? (
          <>
            {gelField(t("youPay"))}
            {pointsField(t("youGet"))}
          </>
        ) : (
          <>
            {pointsField(t("youPay"))}
            {gelField(t("youGet"))}
          </>
        )}
      </div>

      <p className="mt-3 mb-5 text-xs text-foreground/50">
        {t("multiplier", { mult: multiplier })}
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
          disabled={!hasPoints || !enabled || busy}
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
