"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./Spinner";

type Props = {
  isAuthenticated: boolean;
  displayName: string | null;
};

export function AuthControls({ isAuthenticated, displayName }: Props) {
  const t = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    const next = window.location.pathname + window.location.search;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    setBusy(false);
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy && <Spinner />}
        {t("login")}
      </button>
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
