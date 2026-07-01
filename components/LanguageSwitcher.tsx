"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = {
  ka: "ქარ",
  en: "EN",
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
    <div
      className="flex items-center gap-1 text-sm"
      aria-busy={isPending}
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          className={`px-2 py-1 rounded-md transition-colors ${
            loc === locale
              ? "bg-foreground text-background font-medium"
              : "hover:bg-black/5 dark:hover:bg-white/10"
          }`}
          aria-pressed={loc === locale}
        >
          {LABELS[loc] ?? loc}
        </button>
      ))}
    </div>
  );
}
