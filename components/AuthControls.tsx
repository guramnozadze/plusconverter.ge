"use client";

import { useEffect, useRef, useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { isInAppBrowser } from "@/lib/inAppBrowser";
import { Spinner } from "./Spinner";
import { OpenInBrowserModal } from "./OpenInBrowserModal";
import { EmailOtpForm } from "./EmailOtpForm";
import { GoogleIcon, FacebookIcon, TelegramIcon, WhatsAppIcon } from "./icons/ProviderIcons";

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="m4 7 8 6 8-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  isAuthenticated: boolean;
  displayName: string | null;
};

export function AuthControls({ isAuthenticated, displayName }: Props) {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const tFooter = useTranslations("footer");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [showOpenInBrowserHint, setShowOpenInBrowserHint] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!emailOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (emailRef.current && !emailRef.current.contains(e.target as Node)) {
        setEmailOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [emailOpen]);

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

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
    setBusy(false);
  }

  if (!isAuthenticated) {
    return (
      <div className="relative flex items-center gap-1.5" ref={emailRef}>
        <button
          type="button"
          onClick={() => signIn("google")}
          disabled={busyProvider !== null}
          className="inline-flex items-center gap-1.5 rounded-md border border-black/15 dark:border-white/20 px-2.5 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busyProvider === "google" ? <Spinner /> : <GoogleIcon className="h-4 w-4 shrink-0" />}
          {t("signInWithGoogle")}
        </button>
        <button
          type="button"
          onClick={() => setEmailOpen((v) => !v)}
          aria-label={t("emailOtp.continueWithEmail")}
          className="inline-flex items-center rounded-md border border-black/15 dark:border-white/20 px-2 py-1.5"
        >
          <MailIcon className="h-4 w-4 shrink-0 text-foreground/70" />
        </button>
        {emailOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-black/10 dark:border-white/15 bg-background p-3 shadow-lg">
            <EmailOtpForm />
          </div>
        )}
        {showOpenInBrowserHint && (
          <OpenInBrowserModal
            onClose={() => setShowOpenInBrowserHint(false)}
            onUseEmail={() => {
              setShowOpenInBrowserHint(false);
              setEmailOpen(true);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative min-w-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-md border border-black/15 dark:border-white/20 px-2.5 py-1.5 text-sm font-medium"
      >
        <UserIcon className="h-4 w-4 shrink-0 text-foreground/70" />
        {displayName && (
          <span className="min-w-0 max-w-[8rem] truncate">{displayName}</span>
        )}
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-foreground/50" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-black/10 dark:border-white/15 bg-background shadow-lg">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground/40">
            {tNav("help")}
          </p>
          <a
            href="http://m.me/61591533212017"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/80 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <FacebookIcon className="h-4 w-4 shrink-0" />
            {tFooter("facebookLabel")}
          </a>
          <a
            href="https://t.me/plusconverter"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/80 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <TelegramIcon className="h-4 w-4 shrink-0" />
            {tFooter("contactLabel")}
          </a>
          <a
            href="https://wa.me/995574120140"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/80 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0" />
            {tFooter("whatsappLabel")}
          </a>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="flex w-full items-center gap-2 border-t border-black/10 dark:border-white/10 px-3 py-2 text-left text-sm text-foreground/80 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
          >
            {busy ? <Spinner /> : null}
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
