"use client";

import { useEffect } from "react";
import type { Provider } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./Spinner";

// Ad-landing page: skips the converter entirely and fires the OAuth redirect
// on mount, so a Facebook ad can point straight at a login prompt instead of
// the homepage.
export function SignInRedirect({ provider }: { provider: Provider }) {
  const t = useTranslations("common");

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
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Spinner />
      <p className="text-sm text-foreground/60">{t("loading")}</p>
    </div>
  );
}
