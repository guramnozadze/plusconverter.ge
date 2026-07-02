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
  maxPoints,
  minGive,
  multiplierFor,
  pointsFromGel,
} from "@/lib/pricing";
import type { OrderDirection, Settings } from "@/lib/supabase/types";
import { PlusBadge } from "./PlusBadge";
import { Spinner } from "./Spinner";

type Props = {
  initialSettings: Settings;
  isAuthenticated: boolean;
};

type FlashDir = "up" | "down" | null;
type FlashField = "give" | "get" | "max";

const flashClass: Record<Exclude<FlashDir, null>, string> = {
  up: "text-green-600 dark:text-green-400",
  down: "text-red-600 dark:text-red-400",
};

function fmtField(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  // Trim trailing zeros from the computed field for readability.
  return String(Number(n.toFixed(2)));
}

// Keep only digits and a single decimal point — no commas, signs, or letters.
function sanitizeNumeric(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

export function Converter({ initialSettings, isAuthenticated }: Props) {
  const t = useTranslations("converter");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [settings, setSettings] = useState(initialSettings);
  const [direction, setDirection] = useState<OrderDirection>("buy");
  // Two editable legs. `give` is what the user puts in (GEL when buying, PLUS
  // when selling); `get` is the rate-adjusted amount they receive. Either can be
  // edited — the other is recomputed (reverse pricing).
  const [give, setGive] = useState("");
  const [get, setGet] = useState("");
  const anchor = useRef<"give" | "get">("give");
  const [busy, setBusy] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [showMinPopup, setShowMinPopup] = useState(false);

  // Flashes a field green/red for a beat when a live settings update moves it,
  // since the rate itself is never shown — this is the only visible cue.
  const [flashGive, setFlashGive] = useState<FlashDir>(null);
  const [flashGet, setFlashGet] = useState<FlashDir>(null);
  const [flashMax, setFlashMax] = useState<FlashDir>(null);
  const flashSetters = useRef({ give: setFlashGive, get: setFlashGet, max: setFlashMax });
  const flashTimers = useRef<Partial<Record<FlashField, ReturnType<typeof setTimeout>>>>({});

  const triggerFlash = useCallback((field: FlashField, dir: "up" | "down") => {
    flashSetters.current[field](dir);
    clearTimeout(flashTimers.current[field]);
    flashTimers.current[field] = setTimeout(() => flashSetters.current[field](null), 900);
  }, []);

  useEffect(
    () => () => {
      Object.values(flashTimers.current).forEach(clearTimeout);
    },
    [],
  );

  const multiplier = multiplierFor(direction, settings);

  // The realtime subscription below is set up once; these refs let its
  // callback always read the latest direction/amounts without resubscribing.
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const giveRef = useRef(give);
  giveRef.current = give;
  const getRef = useRef(get);
  getRef.current = get;

  // Live price: keep the rate current so the amounts stay accurate when the
  // owner changes multipliers or thresholds. The rate itself is never shown
  // to the user, so flash the visible fields it affects instead.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("settings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload) => {
          const oldSettings = payload.old as Settings;
          const newSettings = payload.new as Settings;
          const dir = directionRef.current;

          if (oldSettings) {
            const oldMax = maxPoints(dir, oldSettings);
            const newMax = maxPoints(dir, newSettings);
            if (oldMax !== newMax) {
              triggerFlash("max", newMax > oldMax ? "up" : "down");
            }

            const oldMultiplier = multiplierFor(dir, oldSettings);
            const newMultiplier = multiplierFor(dir, newSettings);
            if (oldMultiplier !== newMultiplier) {
              // Flash whichever amount is currently computed — the one the
              // user isn't actively typing into.
              if (anchor.current === "give") {
                const g = Number(giveRef.current);
                if (g > 0) {
                  const oldVal =
                    dir === "buy"
                      ? pointsFromGel(g, oldMultiplier)
                      : gelFromPoints(g, oldMultiplier);
                  const newVal =
                    dir === "buy"
                      ? pointsFromGel(g, newMultiplier)
                      : gelFromPoints(g, newMultiplier);
                  if (oldVal !== newVal) {
                    triggerFlash("get", newVal > oldVal ? "up" : "down");
                  }
                }
              } else {
                const x = Number(getRef.current);
                if (x > 0) {
                  const oldVal =
                    dir === "buy"
                      ? gelFromPoints(x, oldMultiplier)
                      : pointsFromGel(x, oldMultiplier);
                  const newVal =
                    dir === "buy"
                      ? gelFromPoints(x, newMultiplier)
                      : pointsFromGel(x, newMultiplier);
                  if (oldVal !== newVal) {
                    triggerFlash("give", newVal > oldVal ? "up" : "down");
                  }
                }
              }
            }
          }

          setSettings(newSettings);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerFlash]);

  // Convert between the two legs. For buy, `give` is GEL and `get` is PLUS; for
  // sell it's the reverse — both reduce to the same two pricing helpers.
  const giveToGet = useCallback(
    (g: number) =>
      direction === "buy"
        ? pointsFromGel(g, multiplier)
        : gelFromPoints(g, multiplier),
    [direction, multiplier],
  );
  const getToGive = useCallback(
    (x: number) =>
      direction === "buy"
        ? gelFromPoints(x, multiplier)
        : pointsFromGel(x, multiplier),
    [direction, multiplier],
  );

  // Re-anchor and recompute when the multiplier (live) or direction changes.
  useEffect(() => {
    if (anchor.current === "give") {
      const g = Number(give);
      setGet(g > 0 ? fmtField(giveToGet(g)) : "");
    } else {
      const x = Number(get);
      setGive(x > 0 ? fmtField(getToGive(x)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplier, direction]);

  const onGiveChange = useCallback(
    (raw: string) => {
      const v = sanitizeNumeric(raw);
      anchor.current = "give";
      setGive(v);
      const g = Number(v);
      setGet(v !== "" && g > 0 ? fmtField(giveToGet(g)) : "");
    },
    [giveToGet],
  );

  const onGetChange = useCallback(
    (raw: string) => {
      const v = sanitizeNumeric(raw);
      anchor.current = "get";
      setGet(v);
      const x = Number(v);
      setGive(v !== "" && x > 0 ? fmtField(getToGive(x)) : "");
    },
    [getToGive],
  );

  const giveNum = Number(give);
  const getNum = Number(get);
  const hasAmount = giveNum > 0 && getNum > 0;
  const enabled = isDirectionEnabled(direction, settings);

  const gelFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );

  // Thresholds: min is on the "give" leg (GEL for buy, points for sell); max
  // caps the points leg (available to buy, or max to sell). 0 = no limit.
  const min = minGive(direction, settings);
  const max = maxPoints(direction, settings);
  const pointsAmount = direction === "buy" ? getNum : giveNum;
  const aboveMax = max > 0 && pointsAmount > max;
  const minUnit = direction === "buy" ? t("gel") : t("points");

  // Sell only: the fixed face value of the points being sold (no rate applied).
  const baseValue =
    direction === "sell" && giveNum > 0
      ? gelFmt.format(bankValueGel(giveNum))
      : "0";

  // Sell only: GEL earned above the plain bank face value — the gain, no rate.
  const sellBonus =
    direction === "sell" && giveNum > 0 && getNum > 0
      ? Number((getNum - bankValueGel(giveNum)).toFixed(2))
      : 0;

  function onContinue() {
    if (!hasAmount || !enabled || aboveMax) return;
    if (min > 0 && giveNum < min) {
      setShowMinPopup(true);
      return;
    }
    // Canonical order input is always PLUS points (server derives the GEL leg):
    // for buy that's the `get` leg, for sell the `give` leg.
    setNavigating(true);
    router.push(`/order/new?direction=${direction}&points=${pointsAmount}`);
  }

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

  // Currency suffix per leg, flipped by direction.
  const giveCurrency = direction === "buy" ? t("gel") : t("points");
  const getCurrency = direction === "buy" ? t("points") : t("gel");

  // "PLUS Points" renders as an orange badge; GEL stays plain text.
  const pointsLabel = t("points");
  const currencyTag = (cur: string) =>
    cur === pointsLabel ? (
      <PlusBadge />
    ) : (
      <span className="text-sm font-medium text-foreground/60">{cur}</span>
    );

  // Numeric input field (text + sanitizer, so no spinner arrows and no commas).
  const numField = (
    value: string,
    onChange: (v: string) => void,
    currency: string,
    flash: FlashDir = null,
  ) => (
    <div className="flex flex-1 items-center rounded-lg border border-black/15 dark:border-white/20 px-3 focus-within:ring-2 focus-within:ring-foreground/30">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={`w-full bg-transparent py-3 text-lg outline-none transition-colors duration-300 ${
          flash ? flashClass[flash] : ""
        }`}
      />
      {currencyTag(currency)}
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
              setGive("");
              setGet("");
              anchor.current = "give";
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

      {/* Buy: points currently available to buy. Sell: max points accepted. */}
      {direction === "buy" && max > 0 && (
        <p
          className={`mb-3 text-sm transition-colors duration-300 ${
            flashMax ? flashClass[flashMax] : "text-foreground/60"
          }`}
        >
          {t("available", { amount: gelFmt.format(max), unit: t("points") })}
        </p>
      )}
      {direction === "sell" && max > 0 && (
        <p
          className={`mb-3 text-sm transition-colors duration-300 ${
            flashMax ? flashClass[flashMax] : "text-foreground/60"
          }`}
        >
          {t("sellMax", { amount: gelFmt.format(max), unit: t("points") })}
        </p>
      )}

      {/* You pay (buy) / You send (sell) */}
      <label className="block text-sm text-foreground/60 mb-1">
        {direction === "sell" ? t("youSend") : t("youPay")}
      </label>
      {direction === "sell" ? (
        // PLUS in  =  GEL face value
        <div className="flex items-center gap-2">
          {numField(give, onGiveChange, giveCurrency, flashGive)}
          <span className="text-lg text-foreground/40">=</span>
          <div className="flex flex-1 items-center rounded-lg border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 px-3">
            <span className="w-full py-3 text-lg tabular-nums text-foreground/70">
              {baseValue}
            </span>
            {currencyTag(getCurrency)}
          </div>
        </div>
      ) : (
        numField(give, onGiveChange, giveCurrency, flashGive)
      )}

      {/* You get: editable rate-adjusted amount (reverse pricing) */}
      <label className="mt-4 block text-sm text-foreground/60 mb-1">
        {t("youGet")}
      </label>
      {numField(get, onGetChange, getCurrency, flashGet)}

      {/* Buy: July 5th spend-power pitch (2× value at the bank) */}
      {direction === "buy" && getNum > 0 && (
        <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 text-center text-sm font-medium text-green-700 dark:text-green-300">
          {t("worthJuly", { gel: gelFmt.format(julyValueGel(getNum)) })}
        </div>
      )}

      {/* Sell: extra GEL earned over the bank face value */}
      {direction === "sell" && sellBonus > 0 && (
        <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 text-center text-sm font-medium text-green-700 dark:text-green-300">
          {t("sellBonus", { gel: gelFmt.format(sellBonus) })}
        </div>
      )}

      {!enabled && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          {direction === "buy" ? t("buyDisabled") : t("sellDisabled")}
        </p>
      )}

      {enabled && aboveMax && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          {t("exceedsMax")}
        </p>
      )}

      {isAuthenticated ? (
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasAmount || !enabled || aboveMax || navigating}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-40"
        >
          {navigating && <Spinner />}
          {t("continue")}
        </button>
      ) : (
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50"
        >
          {busy && <Spinner />}
          {t("loginToContinue")}
        </button>
      )}

      {showMinPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowMinPopup(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-2">{t("minPopupTitle")}</h2>
            <p className="text-sm text-foreground/70 mb-4">
              {t("minPopupBody", { amount: gelFmt.format(min), unit: minUnit })}
            </p>
            <button
              type="button"
              onClick={() => setShowMinPopup(false)}
              className="w-full rounded-lg bg-foreground text-background py-2 font-medium"
            >
              {tCommon("ok")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
