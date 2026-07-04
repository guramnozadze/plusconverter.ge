"use client";

import { useEffect } from "react";
import type { Provider } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./Spinner";

// Ad-landing page: skips the converter entirely and fires the OAuth redirect
// on mount, so a Facebook ad can point straight at a login prompt instead of
// the homepage. Sized to match PromoBanner (rounded-2xl, p-5 sm:p-6) since
// the two sit stacked on the same page.
export function SignInRedirect({ provider }: { provider: Provider }) {
  const t = useTranslations("signin");
  const tCommon = useTranslations("common");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [provider]);

  return (
    <div className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-7 sm:p-8 text-center">
      <div className="flex justify-center">
        <Spinner className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xl sm:text-2xl font-semibold leading-tight">
        {t("title")}
      </p>
      <p className="mt-2 text-base text-foreground/60">
        {t("body", { provider: tCommon(provider) })}
      </p>
    </div>
  );
}
