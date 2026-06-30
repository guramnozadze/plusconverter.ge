"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// Shown once after first login when the profile has no username yet. Optional —
// the user can skip and the card disappears for the session.
export function UsernamePrompt({ userId }: { userId: string }) {
  const t = useTranslations("username");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (dismissed) return null;

  async function save() {
    const username = value.trim();
    if (!username) {
      setDismissed(true);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ username }).eq("id", userId);
    setBusy(false);
    setDismissed(true);
    router.refresh();
  }

  return (
    <div className="mb-4 rounded-xl border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-medium">{t("title")}</h2>
      <p className="text-sm text-foreground/60 mb-3">{t("subtitle")}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          maxLength={32}
          className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {t("save")}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md px-3 py-1.5 text-sm text-foreground/60"
        >
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
