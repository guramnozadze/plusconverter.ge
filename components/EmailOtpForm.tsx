"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { trackOnce } from "@/lib/meta-pixel";
import { Spinner } from "./Spinner";
import { MailIcon } from "./icons/ProviderIcons";

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 4v5h5M20 20v-5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 9A7 7 0 0 1 19 12M18.5 15A7 7 0 0 1 5 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Step = "email" | "code";

// Email OTP is the sign-in path that works inside embedded webviews
// (Messenger, Facebook, Instagram) where Google refuses to complete OAuth:
// the whole exchange happens on this page, with no redirect for the webview
// to break. Requires custom SMTP on the Supabase project — the built-in
// mailer is rate-limited to a couple of emails per hour.
export function EmailOtpForm({
  onSuccess,
  onStepChange,
}: {
  onSuccess?: () => void;
  onStepChange?: (step: Step, email: string) => void;
}) {
  const t = useTranslations("common.emailOtp");
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<
    "invalidEmail" | "sendError" | "invalidCode" | null
  >(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // A plain focus() here can lose to the browser's own layout/keyboard
    // timing right after the step swap — wait a frame so the input is
    // actually painted and interactive before we grab focus.
    const target = step === "code" ? codeInputRef : emailInputRef;
    const raf = requestAnimationFrame(() => target.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [step]);

  function goToStep(next: Step) {
    setStep(next);
    onStepChange?.(next, email.trim());
  }

  async function sendCode() {
    const target = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(target)) {
      setError("invalidEmail");
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: target,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (sendError) {
      setError("sendError");
      return;
    }
    setCode("");
    goToStep("code");
  }

  async function verify(tokenOverride?: string) {
    const token = (tokenOverride ?? code).trim();
    if (token.length < 6) {
      setError("invalidCode");
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    if (verifyError || !data.session) {
      setBusy(false);
      setError("invalidCode");
      return;
    }
    // Same one-shot Lead as the OAuth ?signed_in=1 path — shared localStorage
    // key, so whichever method completes first wins and the other no-ops.
    trackOnce("lead", "Lead");
    // The user may have scrolled deep into the converter while signing in —
    // bring them back to the top so the now-signed-in header/CTA is visible.
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Stay busy: the refresh re-renders the server tree with the new session,
    // which replaces this form with the signed-in UI.
    router.refresh();
    onSuccess?.();
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-3 text-lg outline-none focus:ring-2 focus:ring-foreground/30 placeholder:text-sm placeholder:text-foreground/30";

  return (
    <div className="space-y-3">
      {step === "email" ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-foreground/60">
              {t("emailLabel")}
            </span>
            <input
              ref={emailInputRef}
              autoFocus
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendCode();
              }}
              placeholder="magti@gmail.com"
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={sendCode}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50"
          >
            {busy && <Spinner />}
            {t("sendCode")}
          </button>
        </>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-foreground/60">
              {t("codeLabel")}
            </span>
            <input
              ref={codeInputRef}
              autoFocus
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              // Matches the project's Email OTP length setting (Supabase
              // dashboard: Auth → Providers → Email → Email OTP length = 6).
              maxLength={6}
              value={code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                if (digits.length === 6) verify(digits);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6) verify();
              }}
              placeholder="000000"
              className={`${inputClass} text-center text-2xl font-semibold tracking-[0.3em] tabular-nums`}
            />
          </label>
          <button
            type="button"
            onClick={() => verify()}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50"
          >
            {busy ? <Spinner /> : <ArrowRightIcon className="h-4 w-4 shrink-0" />}
            {t("verify")}
          </button>
          <div className="flex justify-center pt-1 text-sm">
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className="inline-flex items-center gap-1 font-medium text-orange-600 hover:text-orange-500 disabled:opacity-50 dark:text-orange-400 dark:hover:text-orange-300"
            >
              <RefreshIcon className="h-3.5 w-3.5 shrink-0" />
              {t("resend")}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{t(error)}</p>
      )}
    </div>
  );
}

// The OTP flow always runs in this modal — sign-in buttons stay compact and
// the email/code exchange gets its own focused surface. Header copy tracks
// the form's current step so "code sent" replaces the intro once a code
// has actually gone out.
export function EmailOtpModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("common");
  const [step, setStep] = useState<Step>("email");
  const [sentTo, setSentTo] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/[72%] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/15 bg-background p-5 shadow-lg">

        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20">
            <MailIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">
              {step === "code" ? t("emailOtp.codeSentTitle") : t("useEmailInstead")}
            </h2>
            <p className="mt-0.5 truncate text-sm text-foreground/60">
              {step === "code"
                ? t("emailOtp.codeSentTo", { email: sentTo })
                : t("emailOtp.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="-m-1 rounded-md p-1 text-foreground/40 hover:text-foreground/70"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <EmailOtpForm
          onSuccess={onClose}
          onStepChange={(nextStep, email) => {
            setStep(nextStep);
            setSentTo(email);
          }}
        />
      </div>
    </div>
  );
}
