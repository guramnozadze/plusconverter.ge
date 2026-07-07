"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
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

function BackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
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

// Exposes the code step's "back to email" action to EmailOtpModal, which
// renders its own back button up in the header (alongside the close
// button) rather than inline in the form - see the modal component below.
export type EmailOtpFormHandle = {
  back: () => void;
};

// Email OTP is the sign-in path that works inside embedded webviews
// (Messenger, Facebook, Instagram) where Google refuses to complete OAuth:
// the whole exchange happens on this page, with no redirect for the webview
// to break. Requires custom SMTP on the Supabase project — the built-in
// mailer is rate-limited to a couple of emails per hour.
export const EmailOtpForm = forwardRef<
  EmailOtpFormHandle,
  {
    onSuccess?: () => void;
    onStepChange?: (step: Step, email: string) => void;
  }
>(function EmailOtpForm({ onSuccess, onStepChange }, ref) {
  const t = useTranslations("common.emailOtp");
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<
    "invalidEmail" | "sendError" | "invalidCode" | null
  >(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    // Wait for the RSC refresh to actually commit before closing the modal —
    // otherwise the modal disappears while the header/CTA are still
    // rendering the old signed-out tree, leaving a brief "signed out" flash.
    if (signedIn && !isRefreshing) {
      onSuccess?.();
    }
  }, [signedIn, isRefreshing, onSuccess]);

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

  function changeEmail() {
    if (verifying) return;
    setError(null);
    setCode("");
    goToStep("email");
  }

  useImperativeHandle(ref, () => ({ back: changeEmail }));

  async function sendCode() {
    const target = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(target)) {
      setError("invalidEmail");
      return;
    }
    setError(null);
    setCode("");
    // Switch to the code step before the network call, not after: once an
    // await crosses a real network round-trip, iOS Safari stops treating a
    // later focus() as tied to this tap and won't raise the keyboard. Doing
    // it here keeps the step change (and the mount + focus it triggers) in
    // the same gesture window as the click; roll back on send failure.
    goToStep("code");
    setSending(true);
    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: target,
      options: {
        shouldCreateUser: true,
        // If the user taps the emailed link instead of typing the code
        // (e.g. the "Confirm signup" template still shows a link), route
        // through the same server-side code-exchange callback the Google
        // OAuth flow uses, so cookies are written before the page renders
        // instead of relying on the client SDK's after-the-fact URL parsing.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSending(false);
    if (sendError) {
      setError("sendError");
      goToStep("email");
      return;
    }
  }

  async function verify(tokenOverride?: string) {
    const token = (tokenOverride ?? code).trim();
    if (token.length < 6) {
      setError("invalidCode");
      return;
    }
    setError(null);
    setVerifying(true);
    // Dismiss the keyboard as soon as verification starts rather than
    // waiting for the modal to unmount — otherwise the keyboard-close
    // animation and the post-sign-in header swap happen at the same instant.
    codeInputRef.current?.blur();
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    if (verifyError || !data.session) {
      setVerifying(false);
      setError("invalidCode");
      return;
    }
    // Same one-shot Lead as the OAuth ?signed_in=1 path — shared localStorage
    // key, so whichever method completes first wins and the other no-ops.
    trackOnce("lead", "Lead");
    // The user may have scrolled deep into the converter while signing in —
    // bring them back to the top so the now-signed-in header/CTA is visible.
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Stay busy (verifying stays true) until the refresh commits — see the
    // effect above, which closes the modal once isRefreshing flips false.
    startRefresh(() => {
      router.refresh();
    });
    setSignedIn(true);
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
              key="email-step-input"
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
            disabled={sending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50"
          >
            {sending && <Spinner />}
            {t("sendCode")}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-foreground/70">{t("linkFallbackHint")}</p>
          <label className="block">
            <span className="mb-1 block text-xs text-foreground/60">
              {t("codeLabel")}
            </span>
            <input
              key="code-step-input"
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
            disabled={verifying}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50"
          >
            {verifying ? <Spinner /> : <ArrowRightIcon className="h-4 w-4 shrink-0" />}
            {t("verify")}
          </button>
          <div className="flex items-center justify-center pt-1 text-sm">
            <button
              type="button"
              onClick={sendCode}
              disabled={sending || verifying}
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
});

// The OTP flow always runs in this modal — sign-in buttons stay compact and
// the email/code exchange gets its own focused surface. Header copy tracks
// the form's current step so "code sent" replaces the intro once a code
// has actually gone out.
export function EmailOtpModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("common");
  const [step, setStep] = useState<Step>("email");
  const [sentTo, setSentTo] = useState("");
  const formRef = useRef<EmailOtpFormHandle>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/[72%] p-4"
      onClick={step === "email" ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/15 bg-background p-6 pb-6 shadow-lg"
      >
        {step === "code" && (
          // Back shares this row with close so close stays put regardless
          // of step; on the email step there's no back button, so close
          // just joins the mail-icon row below instead of sitting alone up
          // here (which used to add a whole empty row of top padding).
          <div className="mb-3 flex items-center">
            <button
              type="button"
              onClick={() => formRef.current?.back()}
              aria-label={t("emailOtp.changeEmail")}
              className="-ml-2 rounded-md p-2 text-foreground/60 hover:text-foreground/80"
            >
              <BackIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("cancel")}
              className="-m-1.5 ml-auto rounded-md p-1.5 text-foreground/40 hover:text-foreground/70"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>
        )}

        <div className="mb-6 flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20">
            <MailIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">
              {step === "code" ? t("emailOtp.codeSentTitle") : t("useEmailInstead")}
            </h2>
            <p
              className={`mt-1 text-sm text-foreground/60 ${step === "code" ? "truncate" : ""}`}
            >
              {step === "code"
                ? t("emailOtp.codeSentTo", { email: sentTo })
                : t("emailOtp.subtitle")}
            </p>
          </div>
          {step === "email" && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("cancel")}
              className="-m-1.5 rounded-md p-1.5 text-foreground/40 hover:text-foreground/70"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          )}
        </div>
        <EmailOtpForm
          ref={formRef}
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
