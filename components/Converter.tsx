"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Provider } from "@supabase/supabase-js";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { isInAppBrowser, useIsInAppBrowser } from "@/lib/inAppBrowser";
import { setAdvancedMatching, track } from "@/lib/meta-pixel";
import { useConverterDirection } from "./ConverterDirection";
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
import type { Settings } from "@/lib/supabase/types";
import { PlusBadge } from "./PlusBadge";
import { Spinner } from "./Spinner";
import { OpenInBrowserModal } from "./OpenInBrowserModal";
import { EmailOtpModal } from "./EmailOtpForm";
import { GoogleIcon, MailIcon } from "./icons/ProviderIcons";

type Props = {
  initialSettings: Settings;
  isAuthenticated: boolean;
  userEmail: string | null;
};

// sessionStorage key for the pre-sign-in draft (direction/give/get) - see
// the restore/save effects in the component below.
const DRAFT_KEY = "converter:draft";

type FlashDir = "up" | "down" | null;
// Only used by the disabled realtime-flash feature below — see REMINDER.
// type FlashField = "give" | "get" | "max";

const flashClass: Record<Exclude<FlashDir, null>, string> = {
  up: "text-green-600 dark:text-green-400",
  down: "text-red-600 dark:text-red-400",
};

function fmtField(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  // Trim trailing zeros from the computed field for readability.
  return String(Number(n.toFixed(2)));
}

// Quick-fill shortcuts for the buy GEL input — only shown to signed-in users,
// since guests hit the login prompt before an amount matters anyway. Fill
// only appears once the input matches the chip's amount; each tier jumps to
// a clearly different hue (not just a lighter/darker shade of the last one)
// so the escalation from plain to exciting actually reads at a glance.
const QUICK_BUY_AMOUNTS = [
  {
    value: 10,
    selectedClassName:
      "border-slate-300 dark:border-slate-400/30 bg-slate-100 dark:bg-slate-500/15 text-slate-700 dark:text-slate-200",
  },
  {
    value: 20,
    selectedClassName:
      "border-amber-400 dark:border-amber-400/40 bg-amber-200 dark:bg-amber-500/25 text-amber-900 dark:text-amber-100",
  },
  {
    value: 50,
    selectedClassName:
      "border-rose-400 dark:border-rose-400/40 bg-rose-200 dark:bg-rose-500/25 text-rose-900 dark:text-rose-100",
  },
  {
    value: 199,
    selectedClassName:
      "border-purple-400 dark:border-purple-400/40 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white !font-bold animate-shimmer",
  },
] as const;

// Quick-fill shortcuts for the sell "you get" field — lets the user pick the
// GEL amount they want to receive rather than the points amount they're
// sending. Same chip styling/tiers as the buy shortcuts, for visual
// consistency, but wired to the reverse-priced `get` leg via onGetChange.
const QUICK_SELL_GEL_AMOUNTS = QUICK_BUY_AMOUNTS;

// Keep only digits and a single decimal point — no commas, signs, or letters.
function sanitizeNumeric(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

export function Converter({
  initialSettings,
  isAuthenticated,
  userEmail,
}: Props) {
  const t = useTranslations("converter");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { direction, setDirection, focusToken, focusAmount } = useConverterDirection();

  // REMINDER: restore live pricing before 2027-07-01 (ahead of next year's
  // flash-sale event). Traffic settled back to normal after the July 2026
  // event ended, so the realtime settings subscription (and the flash-on-
  // change cues it drove) is disabled below — the rate now only updates on a
  // full page reload. getSettings() is still fetched fresh server-side on
  // every request either way (see lib/data.ts).
  const [settings] = useState(initialSettings);
  // Two editable legs. `give` is what the user puts in (GEL when buying, PLUS
  // when selling); `get` is the rate-adjusted amount they receive. Either can be
  // edited — the other is recomputed (reverse pricing).
  const [give, setGive] = useState("");
  const [get, setGet] = useState("");
  const anchor = useRef<"give" | "get">("give");

  // Guests who fill in an amount (e.g. from the promo banner) and then sign
  // in lose all React state: Google OAuth is a full-page redirect away and
  // back, and a tapped magic-link email is the same. Mirror the in-progress
  // draft to sessionStorage while signed out so it survives that round trip,
  // and restore it once on mount — covers whichever sign-in path the user
  // took, not just the button click that's easiest to hook.
  useEffect(() => {
    // No isAuthenticated guard here (unlike the save effect below): this
    // must run on the mount right after sign-in, when isAuthenticated has
    // already flipped to true, to actually restore what was saved while
    // signed out.
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        direction?: "buy" | "sell";
        give?: string;
        get?: string;
        anchor?: "give" | "get";
      };
      const restoredDirection = draft.direction ?? direction;
      const restoredAnchor = draft.anchor ?? "give";
      if (draft.direction) setDirection(draft.direction);
      anchor.current = restoredAnchor;

      // Recompute the non-anchor leg fresh from settings instead of trusting
      // the saved pair verbatim - the "re-anchor and recompute" effect below
      // also runs on this same mount, but reads give/get from its stale
      // pre-restore closure (still ""), so its own setGive/setGet would
      // otherwise clobber whichever leg it computes with "". Doing the full
      // give+get pair here, and skipping that effect's first run (see its
      // mountedRef below), keeps the two fields from ever landing out of
      // sync - one populated, the other blank - after a restore.
      const m = multiplierFor(restoredDirection, settings);
      if (restoredAnchor === "give") {
        const g = Number(draft.give ?? "");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGive(draft.give ?? "");
        setGet(
          g > 0
            ? fmtField(
                restoredDirection === "buy" ? pointsFromGel(g, m) : gelFromPoints(g, m),
              )
            : "",
        );
      } else {
        const x = Number(draft.get ?? "");
        setGet(draft.get ?? "");
        setGive(
          x > 0
            ? fmtField(
                restoredDirection === "buy" ? gelFromPoints(x, m) : pointsFromGel(x, m),
              )
            : "",
        );
      }
    } catch {
      // Storage inaccessible (e.g. private mode) - just skip the restore.
    } finally {
      sessionStorage.removeItem(DRAFT_KEY);
    }
    // Restore once on mount only - the save effect below takes over after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    try {
      if (give || get) {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ direction, give, get, anchor: anchor.current }),
        );
      } else {
        sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // Storage inaccessible - the draft just won't survive a reload.
    }
  }, [isAuthenticated, direction, give, get]);

  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [showMinPopup, setShowMinPopup] = useState(false);
  const [showOpenInBrowserHint, setShowOpenInBrowserHint] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const inApp = useIsInAppBrowser();
  const giveInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Flashed a field green/red for a beat when a live settings update moved
  // it. Disabled 2026-07-06 along with the realtime subscription below (see
  // REMINDER above `settings`) — flashGive/flashGet/flashMax now just stay
  // null forever, which numField/the "available" text already render as a
  // no-op. To restore: uncomment this block and the effect further down,
  // and swap `const [settings] = useState(...)` back to
  // `const [settings, setSettings] = useState(...)`.
  // const [flashGive, setFlashGive] = useState<FlashDir>(null);
  // const [flashGet, setFlashGet] = useState<FlashDir>(null);
  // const [flashMax, setFlashMax] = useState<FlashDir>(null);
  // const flashSetters = useRef({ give: setFlashGive, get: setFlashGet, max: setFlashMax });
  // const flashTimers = useRef<Partial<Record<FlashField, ReturnType<typeof setTimeout>>>>({});
  //
  // const triggerFlash = useCallback((field: FlashField, dir: "up" | "down") => {
  //   flashSetters.current[field](dir);
  //   clearTimeout(flashTimers.current[field]);
  //   flashTimers.current[field] = setTimeout(() => flashSetters.current[field](null), 900);
  // }, []);
  //
  // useEffect(
  //   () => () => {
  //     Object.values(flashTimers.current).forEach(clearTimeout);
  //   },
  //   [],
  // );
  const flashGive: FlashDir = null;
  const flashGet: FlashDir = null;
  const flashMax: FlashDir = null;

  const multiplier = multiplierFor(direction, settings);

  // The realtime subscription below is set up once; these refs let its
  // callback always read the latest direction/amounts without resubscribing.
  // Disabled along with the effect itself — see REMINDER above `settings`.
  // const directionRef = useRef(direction);
  // directionRef.current = direction;
  // const giveRef = useRef(give);
  // giveRef.current = give;
  // const getRef = useRef(get);
  // getRef.current = get;

  // Live price: keep the rate current so the amounts stay accurate when the
  // owner changes multipliers or thresholds. The rate itself is never shown
  // to the user, so flash the visible fields it affects instead. Disabled
  // 2026-07-06 — see REMINDER above `settings`.
  // useEffect(() => {
  //   const supabase = createClient();
  //   const channel = supabase
  //     .channel("settings-live")
  //     .on(
  //       "postgres_changes",
  //       { event: "*", schema: "public", table: "settings" },
  //       (payload) => {
  //         const oldSettings = payload.old as Settings;
  //         const newSettings = payload.new as Settings;
  //         const dir = directionRef.current;
  //
  //         if (oldSettings) {
  //           const oldMax = maxPoints(dir, oldSettings);
  //           const newMax = maxPoints(dir, newSettings);
  //           if (oldMax !== newMax) {
  //             triggerFlash("max", newMax > oldMax ? "up" : "down");
  //           }
  //
  //           const oldMultiplier = multiplierFor(dir, oldSettings);
  //           const newMultiplier = multiplierFor(dir, newSettings);
  //           if (oldMultiplier !== newMultiplier) {
  //             // Flash whichever amount is currently computed — the one the
  //             // user isn't actively typing into.
  //             if (anchor.current === "give") {
  //               const g = Number(giveRef.current);
  //               if (g > 0) {
  //                 const oldVal =
  //                   dir === "buy"
  //                     ? pointsFromGel(g, oldMultiplier)
  //                     : gelFromPoints(g, oldMultiplier);
  //                 const newVal =
  //                   dir === "buy"
  //                     ? pointsFromGel(g, newMultiplier)
  //                     : gelFromPoints(g, newMultiplier);
  //                 if (oldVal !== newVal) {
  //                   triggerFlash("get", newVal > oldVal ? "up" : "down");
  //                 }
  //               }
  //             } else {
  //               const x = Number(getRef.current);
  //               if (x > 0) {
  //                 const oldVal =
  //                   dir === "buy"
  //                     ? gelFromPoints(x, oldMultiplier)
  //                     : pointsFromGel(x, oldMultiplier);
  //                 const newVal =
  //                   dir === "buy"
  //                     ? gelFromPoints(x, newMultiplier)
  //                     : pointsFromGel(x, newMultiplier);
  //                 if (oldVal !== newVal) {
  //                   triggerFlash("give", newVal > oldVal ? "up" : "down");
  //                 }
  //               }
  //             }
  //           }
  //         }
  //
  //         setSettings(newSettings);
  //       },
  //     )
  //     .subscribe();
  //   return () => {
  //     supabase.removeChannel(channel);
  //   };
  // }, [triggerFlash]);

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
  // Skips its first (mount) run: the draft-restore effect above already
  // produces a consistent give/get pair on mount (using a freshly computed
  // multiplier), and this effect's first invocation would otherwise read
  // give/get from a stale pre-restore closure and clobber whichever leg it
  // computes with "".
  const skippedMountRecompute = useRef(false);
  useEffect(() => {
    if (!skippedMountRecompute.current) {
      skippedMountRecompute.current = true;
      return;
    }
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

  // Only the promo banner's click should jump focus here — bumping
  // focusToken is how it signals that (a plain tab click must not). If it
  // also carried a prefill amount (e.g. the banner's example figure), fill
  // the give input with it too.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (focusAmount != null) {
      anchor.current = "give";
      // This effect only runs in response to an external signal (the promo
      // banner bumping focusToken), never as a reaction to `give`/`get`
      // themselves — there's no render-time equivalent to compute this from.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGive(String(focusAmount));
      setGet(fmtField(giveToGet(focusAmount)));
    }
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    // Only focus on desktop — on mobile this pops the keyboard, which eats
    // half the screen and fights the scroll below for no benefit (there's no
    // physical keyboard to save the user a tap on).
    if (!isMobile) {
      giveInputRef.current?.focus({ preventScroll: true });
    }
    // Scroll the section (not the input itself) into view — scrolling to
    // the input landed too far down, past the title. scroll-mt-4 on the
    // container gives it a little breathing room from the top edge.
    // Mobile always scrolls (the keyboard eats half the screen, so it's
    // worth the jump); desktop only scrolls if the section is actually cut
    // off — if it's already fully in view, forcing a scroll would be
    // gratuitous motion for no reason.
    const rect = containerRef.current?.getBoundingClientRect();
    const cutOff = rect ? rect.top < 0 || rect.bottom > window.innerHeight : false;
    if (isMobile || cutOff) {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

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
  // Commented out along with the readonly "= face value" box below — keeping
  // the calc here so both can be restored together.
  // const baseValue =
  //   direction === "sell" && giveNum > 0
  //     ? gelFmt.format(bankValueGel(giveNum))
  //     : "0";

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
    // Continue is only reachable when isAuthenticated (see the render below),
    // so the email is always known here.
    if (userEmail) setAdvancedMatching({ em: userEmail.trim().toLowerCase() });
    track("InitiateCheckout", {
      value: direction === "buy" ? giveNum : getNum,
      currency: "GEL",
      content_category: direction,
    });
    router.push(`/order/new?direction=${direction}&points=${pointsAmount}`);
  }

  async function signIn(provider: Provider) {
    // Google refuses to complete OAuth inside embedded webviews (Messenger,
    // Instagram, etc.) and shows its own confusing block page — head that
    // off with an in-locale instruction instead.
    if (provider === "google" && isInAppBrowser()) {
      setShowOpenInBrowserHint(true);
      return;
    }
    setBusyProvider(provider);
    const supabase = createClient();
    const next = window.location.pathname + window.location.search;
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  // Currency suffix per leg, flipped by direction.
  const giveCurrency = direction === "buy" ? t("gel") : t("points");
  const getCurrency = direction === "buy" ? t("points") : t("gel");

  // "PLUS Points" renders as an orange badge; GEL stays plain text. Full unit
  // word on mobile too now that both directions render a single full-width
  // input row (the sell side dropped its paired "= face value" box).
  const pointsLabel = t("points");
  const currencyTag = (cur: string) =>
    cur === pointsLabel ? (
      <PlusBadge expandOnMobile />
    ) : (
      <span className="text-sm font-medium text-foreground/60">{cur}</span>
    );

  // Numeric input field (text + sanitizer, so no spinner arrows and no commas).
  const numField = (
    value: string,
    onChange: (v: string) => void,
    currency: string,
    flash: FlashDir = null,
    inputRef?: RefObject<HTMLInputElement | null>,
  ) => (
    <div className="input-well flex flex-1 items-center rounded-lg border px-3 focus-within:ring-2 focus-within:ring-black/10 dark:focus-within:ring-orange-500/20">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={`w-full bg-transparent py-3 text-lg font-medium outline-none transition-colors duration-300 placeholder:text-foreground/30 ${
          flash ? flashClass[flash] : ""
        }`}
      />
      {currencyTag(currency)}
    </div>
  );

  return (
    <div
      id="converter"
      ref={containerRef}
      className="surface-card scroll-mt-4 rounded-2xl border p-5 sm:p-6"
    >
      <div className="mb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
      </div>

      {/* Direction toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/5 dark:bg-black/20 p-1 mb-5">
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
              direction === dir
                ? "bg-white dark:bg-white/15 shadow-sm"
                : "text-foreground/60"
            }`}
            aria-pressed={direction === dir}
          >
            {t(dir)}
          </button>
        ))}
      </div>

      {/* Buy: points currently available to buy — implies limited stock. */}
      {direction === "buy" && max > 0 && (
        <p
          className={`mb-3 text-sm transition-colors duration-300 ${
            flashMax ? flashClass[flashMax] : "text-foreground/60"
          }`}
        >
          {t("available", { amount: gelFmt.format(max), unit: t("points") })}
        </p>
      )}

      {/* You pay (buy) / You send (sell) */}
      <label className="block text-sm text-foreground/60 mb-1">
        {direction === "sell" ? t("youSend") : t("youPay")}
      </label>
      {/* Sell used to pair the input with a readonly "= face value" box.
          Commented out for now (with its baseValue calc above) — just the
          plain input for both directions until this comes back.
      {direction === "sell" ? (
        <div className="flex items-center gap-2">
          {numField(give, onGiveChange, giveCurrency, flashGive, giveInputRef)}
          <span className="text-lg text-foreground/40">=</span>
          <div className="flex flex-1 items-center rounded-lg border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 px-3">
            <span className="w-full py-3 text-lg tabular-nums text-foreground/70">
              {baseValue}
            </span>
            {currencyTag(getCurrency)}
          </div>
        </div>
      ) : (
        numField(give, onGiveChange, giveCurrency, flashGive, giveInputRef)
      )}
      */}
      {numField(give, onGiveChange, giveCurrency, flashGive, giveInputRef)}

      {/* Quick-fill shortcuts — buy only */}
      {direction === "buy" && (
        <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
          {QUICK_BUY_AMOUNTS.map(({ value, selectedClassName }) => {
            const selected = giveNum === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onGiveChange(String(value))}
                className={`whitespace-nowrap rounded-full border bg-clip-padding px-[11px] py-[3px] text-[11px] font-medium transition-all sm:px-3.5 sm:py-1 sm:text-xs ${
                  selected
                    ? selectedClassName
                    : "border-black/15 dark:border-white/20 text-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {value} {t("gel")}
              </button>
            );
          })}
        </div>
      )}

      {/* You get: editable rate-adjusted amount (reverse pricing) */}
      <label className="mt-4 block text-sm text-foreground/60 mb-1">
        {t("youGet")}
      </label>
      {numField(get, onGetChange, getCurrency, flashGet)}

      {/* Quick-fill shortcuts — sell only, picks the GEL amount received */}
      {direction === "sell" && (
        <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
          {QUICK_SELL_GEL_AMOUNTS.map(({ value, selectedClassName }) => {
            const selected = getNum === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onGetChange(String(value))}
                className={`whitespace-nowrap rounded-full border bg-clip-padding px-[11px] py-[3px] text-[11px] font-medium transition-all sm:px-3.5 sm:py-1 sm:text-xs ${
                  selected
                    ? selectedClassName
                    : "border-black/15 dark:border-white/20 text-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {value} {t("gel")}
              </button>
            );
          })}
        </div>
      )}

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
          {direction === "sell"
            ? t("exceedsMax", { amount: gelFmt.format(max), unit: t("points") })
            : t("exceedsMaxBuy")}
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
        <div className="mt-5 space-y-2">
          <p className="text-center text-sm text-foreground/60">
            {t("loginToContinue")}
          </p>
          {/* Inside Meta's in-app browser Google OAuth is a dead end, so the
              email code is the only option there; in a normal browser Google
              leads with email as the alternative. */}
          {!inApp && (
            <button
              type="button"
              onClick={() => signIn("google")}
              disabled={busyProvider !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/15 dark:border-white/20 py-3 font-medium disabled:opacity-50"
            >
              {busyProvider === "google" ? <Spinner /> : <GoogleIcon className="h-5 w-5 shrink-0" />}
              {t("continueWithGoogle")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium"
          >
            <MailIcon className="h-5 w-5 shrink-0" />
            {tCommon("emailOtp.continueWithEmail")}
          </button>
        </div>
      )}

      {showMinPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowMinPopup(false)}
        >
          <div
            className="surface-card w-full max-w-sm rounded-2xl border p-5 shadow-lg"
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

      {showEmailModal && (
        <EmailOtpModal onClose={() => setShowEmailModal(false)} />
      )}

      {showOpenInBrowserHint && (
        <OpenInBrowserModal
          onClose={() => setShowOpenInBrowserHint(false)}
          onUseEmail={() => {
            setShowOpenInBrowserHint(false);
            setShowEmailModal(true);
          }}
        />
      )}
    </div>
  );
}
