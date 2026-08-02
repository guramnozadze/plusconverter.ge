"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoonIcon, SunIcon } from "./icons/ThemeIcons";

// Mirrors LanguageSwitcher's button shell (h-8 w-8 bordered square) so the
// two toggles read as a matched pair in the header.
export function ThemeToggle({ initialDark }: { initialDark: boolean }) {
  const t = useTranslations("nav");
  // `initialDark` comes from the `theme` cookie, read server-side in
  // `Header` - it's already what's rendered in the `dark` class on <html>
  // (see the root layout), so there's nothing to reconcile on mount.
  const [isDark, setIsDark] = useState(initialDark);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    // Cookie, not localStorage - it needs to be readable during SSR (by the
    // root layout and Header) so the `dark` class is already correct in the
    // first byte of HTML on the next load, instead of a client script
    // racing first paint to add it.
    document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggleTheme")}
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/15 dark:border-white/20 h-8 w-8 text-base leading-none"
    >
      <SunIcon
        className={`absolute h-4 w-4 transition-all duration-300 ease-out motion-reduce:transition-none ${
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-50 opacity-0"
        }`}
      />
      <MoonIcon
        className={`absolute h-4 w-4 transition-all duration-300 ease-out motion-reduce:transition-none ${
          isDark
            ? "-rotate-90 scale-50 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        }`}
      />
    </button>
  );
}
