"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { trackOnce } from "@/lib/meta-pixel";
import { Spinner } from "./Spinner";

// Email OTP is the sign-in path that works inside embedded webviews
// (Messenger, Facebook, Instagram) where Google refuses to complete OAuth:
// the whole exchange happens on this page, with no redirect for the webview
// to break. Requires custom SMTP on the Supabase project — the built-in
// mailer is rate-limited to a couple of emails per hour.
export function EmailOtpForm() {
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
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-3 text-base outline-none focus:ring-2 focus:ring-foreground/30";

  return (
    <div className="space-y-2">
      {step === "email" ? (
        <>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendCode();
            }}
            placeholder={t("emailLabel")}
            aria-label={t("emailLabel")}
            className={inputClass}
          />
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
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") verify();
            }}
            placeholder={t("codeLabel")}
            aria-label={t("codeLabel")}
            className={`${inputClass} tracking-[0.3em] font-mono`}
          />
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
