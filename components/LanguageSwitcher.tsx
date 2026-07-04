"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

// Only cycles between ka/en — ru stays a valid route (for existing links/SEO)
// but isn't offered here since it's no longer an actively supported locale.
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const next = locale === "en" ? "ka" : "en";

  function toggle() {
    startTransition(() => {
      // `pathname` from next-intl's navigation is locale-agnostic, so we can
      // re-render the same route under a different locale.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={next === "ka" ? "ქართულად გადართვა" : "Switch to English"}
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-black/15 dark:border-white/20 h-8 w-8 text-sm font-medium disabled:opacity-50"
    >
      {next === "ka" ? "კა" : "EN"}
    </button>
  );
}
