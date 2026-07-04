"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { isInAppBrowser } from "@/lib/inAppBrowser";
import { Spinner } from "./Spinner";

// Ad-landing page: skips the converter entirely and fires the Google OAuth
// redirect on mount, so an ad click can point straight at a login prompt
// instead of the homepage. Sized to match PromoBanner (rounded-2xl, p-5
// sm:p-6) since the two sit stacked on the same page.
//
// Facebook/Messenger/Instagram's embedded browser can't complete Google
// OAuth (Google blocks it outright), so ad clicks opened inside those apps
// get an "open in your browser" nudge here instead of a doomed redirect.
export function SignInRedirect() {
  const t = useTranslations("signin");
  const tCommon = useTranslations("common");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (isInAppBrowser()) {
      setBlocked(true);
      return;
    }
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  if (blocked) {
    return (
      <div className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-7 sm:p-8 text-center">
        <h2 className="text-xl sm:text-2xl font-semibold leading-tight">
          {tCommon("openInBrowserTitle")}
        </h2>
        <p className="mt-2 text-base text-foreground/60">
          {tCommon("openInBrowserIntro")}
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-left text-sm text-foreground/70">
          <li>{tCommon("openInBrowserBullet1")}</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-7 sm:p-8 text-center">
      <div className="flex justify-center">
        <Spinner className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xl sm:text-2xl font-semibold leading-tight">
        {t("title")}
      </p>
      <p className="mt-2 text-base text-foreground/60">
        {t("body", { provider: tCommon("google") })}
      </p>
    </div>
  );
}
