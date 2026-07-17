"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MoonIcon, SunIcon } from "./icons/ThemeIcons";

// Mirrors LanguageSwitcher's button shell (h-8 w-8 bordered square) so the
// two toggles read as a matched pair in the header.
export function ThemeToggle() {
  const t = useTranslations("nav");
  // Starts unmounted so the server-rendered markup (no `document`) matches
  // the first client render exactly - the inline theme script in the root
  // layout has already set the real `.dark` class on <html> by the time
  // this mounts, so we just read it rather than guessing and risking a
  // hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    // Persisting the choice can throw (storage disabled/blocked, private-
    // browsing quirks, quota) - guarded so a failed write can't stop
    // `setIsDark` below and leave the button's own state stuck out of sync
    // with the class it just toggled.
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggleTheme")}
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/15 dark:border-white/20 h-8 w-8 text-base leading-none"
    >
      {mounted && (
        <>
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
        </>
      )}
    </button>
  );
}
