"use client";

import { useState } from "react";
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

// Email OTP is the sign-in path that works inside embedded webviews
// (Messenger, Facebook, Instagram) where Google refuses to complete OAuth:
// the whole exchange happens on this page, with no redirect for the webview
// to break. Requires custom SMTP on the Supabase project — the built-in
// mailer is rate-limited to a couple of emails per hour.
export function EmailOtpForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("common.emailOtp");
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<
    "invalidEmail" | "sendError" | "invalidCode" | null
  >(null);

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
    setStep("code");
  }

  async function verify() {
    const token = code.trim();
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
    // Stay busy: the refresh re-renders the server tree with the new session,
    // which replaces this form with the signed-in UI.
    router.refresh();
    onSuccess?.();
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-3 text-lg outline-none focus:ring-2 focus:ring-foreground/30";

  return (
    <div className="space-y-3">
      {step === "email" ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-foreground/60">
              {t("emailLabel")}
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendCode();
              }}
              placeholder="example@gmail.com"
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
          <p className="text-sm text-foreground/70">
            {t("codeSentTo", { email: email.trim() })}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs text-foreground/60">
              {t("codeLabel")}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              // Supabase's OTP length is a per-project dashboard setting
              // (6–10 digits) — don't hard-assume 6 here.
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") verify();
              }}
              placeholder="000000"
              className={`${inputClass} text-center text-2xl font-semibold tracking-[0.3em] tabular-nums`}
            />
          </label>
          <button
            type="button"
            onClick={verify}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50"
          >
            {busy && <Spinner />}
            {t("verify")}
          </button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              disabled={busy}
              className="text-foreground/60 underline underline-offset-2 disabled:opacity-50"
            >
              {t("changeEmail")}
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className="text-foreground/60 underline underline-offset-2 disabled:opacity-50"
            >
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
// the email/code exchange gets its own focused surface.
export function EmailOtpModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("common");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/[72%] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/15 bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20">
            <MailIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">
              {t("useEmailInstead")}
            </h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              {t("emailOtp.subtitle")}
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
        <EmailOtpForm onSuccess={onClose} />
      </div>
    </div>
  );
}
