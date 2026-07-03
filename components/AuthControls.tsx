"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./Spinner";
import { GoogleIcon } from "./icons/ProviderIcons";

type Props = {
  isAuthenticated: boolean;
  displayName: string | null;
};

export function AuthControls({ isAuthenticated, displayName }: Props) {
  const t = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signIn(provider: Provider) {
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
          onClick={() => signIn("google")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-black/15 dark:border-white/20 px-2.5 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? <Spinner /> : <GoogleIcon className="h-4 w-4 shrink-0" />}
          {t("google")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {displayName && (
        <span className="inline max-w-[6rem] sm:max-w-[10rem] truncate text-foreground/70">
          {displayName}
        </span>
      )}
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 disabled:opacity-50"
      >
        {busy && <Spinner />}
        {t("logout")}
      </button>
    </div>
  );
}
