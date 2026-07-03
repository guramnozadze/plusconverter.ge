"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = {
  ka: "ქართული",
  en: "English",
  ru: "Русский",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      // `pathname` from next-intl's navigation is locale-agnostic, so we can
      // re-render the same route under a different locale.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <select
      value={locale}
      onChange={(e) => switchTo(e.target.value)}
      disabled={isPending}
      aria-label="Language"
      className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm disabled:opacity-50"
    >
      {routing.locales.map((loc) => (
        <option key={loc} value={loc}>
          {LABELS[loc] ?? loc}
        </option>
      ))}
    </select>
  );
}
