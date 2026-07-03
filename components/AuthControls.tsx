"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { isInAppBrowser } from "@/lib/inAppBrowser";
import { Spinner } from "./Spinner";
import { GoogleIcon, FacebookIcon } from "./icons/ProviderIcons";

type Props = {
  isAuthenticated: boolean;
  displayName: string | null;
};

export function AuthControls({ isAuthenticated, displayName }: Props) {
  const t = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showOpenInBrowserHint, setShowOpenInBrowserHint] = useState(false);

  async function signIn(provider: Provider) {
    // Google refuses to complete OAuth inside embedded webviews (Messenger,
    // Instagram, etc.) and shows its own confusing block page — head that
    // off with an in-locale instruction instead.
    if (provider === "google" && isInAppBrowser()) {
      setShowOpenInBrowserHint(true);
      return;
    }
    setBusy(true);
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
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => signIn("facebook")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-black/15 dark:border-white/20 px-2.5 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? <Spinner /> : <FacebookIcon className="h-4 w-4 shrink-0" />}
          {t("facebook")}
        </button>
        <button
          type="button"
          onClick={() => signIn("google")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-black/15 dark:border-white/20 px-2.5 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? <Spinner /> : <GoogleIcon className="h-4 w-4 shrink-0" />}
          {t("google")}
        </button>
        {showOpenInBrowserHint && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowOpenInBrowserHint(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/15 bg-background p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-2">{t("openInBrowserTitle")}</h2>
              <p className="text-sm text-foreground/70 mb-2">{t("openInBrowserIntro")}</p>
              <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-foreground/70">
                <li>{t("openInBrowserBullet1")}</li>
                <li>{t("openInBrowserBullet2")}</li>
              </ul>
              <button
                type="button"
                onClick={() => {
                  setShowOpenInBrowserHint(false);
                  signIn("facebook");
                }}
                className="relative flex w-full items-center justify-center rounded-lg border border-transparent bg-[#1877F2] py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-[#166FE5] dark:border-white/40 dark:bg-[#1877F2]/80 dark:hover:bg-[#1877F2]/90"
              >
                <FacebookIcon
                  className="absolute left-4 h-5 w-5 shrink-0"
                  color="white"
                />
                {t("signInWithFacebook")}
              </button>
              <button
                type="button"
                onClick={() => setShowOpenInBrowserHint(false)}
                className="mt-2 w-full rounded-lg border border-black/15 dark:border-white/20 py-2 font-medium"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      {displayName && (
        <span className="min-w-0 shrink truncate text-foreground/70">
          {displayName}
        </span>
      )}
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 disabled:opacity-50"
      >
        {busy && <Spinner />}
        {t("logout")}
      </button>
    </div>
  );
}
