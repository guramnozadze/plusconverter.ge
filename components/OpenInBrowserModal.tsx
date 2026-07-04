"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Shown when Google sign-in is attempted inside an embedded webview
// (Messenger, Facebook, Instagram) that Google itself refuses to complete.
// Copy follows a "what happened / why / reassurance / way out / fix it"
// structure rather than a blunt error dump.
export function OpenInBrowserModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/[72%] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/15 bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">{t("openInBrowserTitle")}</h2>
        <p className="text-sm text-foreground/70 mb-2">{t("openInBrowserIntro")}</p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-foreground/70">
          <li>{t("openInBrowserBullet1")}</li>
          <li>{t("openInBrowserBullet2")}</li>
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-black/15 dark:border-white/20 py-2 font-medium"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="flex-1 rounded-lg bg-foreground text-background py-2 font-medium"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>
    </div>
  );
}
