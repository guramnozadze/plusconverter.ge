"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Deliberately the clean root, not window.location.href - the copied link is
// meant to be pasted straight into a real browser, not carry over whatever
// deep path/query string the user happened to be on.
const CANONICAL_URL = "https://plusconverter.ge";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Shown when Google sign-in is attempted inside an embedded webview
// (Messenger, Facebook, Instagram) that Google itself refuses to complete.
export function OpenInBrowserModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const isAndroid = /Android/i.test(navigator.userAgent);

  async function copyLink() {
    await navigator.clipboard.writeText(CANONICAL_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Android hands https:// links off to the system's default browser when
  // asked via an intent: URL, which escapes Facebook's in-app webview
  // entirely. iOS has no equivalent - WKWebView sandboxing blocks it, hence
  // this button only ever appears on Android.
  function openInBrowser() {
    const url = new URL(window.location.href);
    const scheme = url.protocol.replace(":", "");
    window.location.href = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${scheme};end`;
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
          {isAndroid && <li>{t("openInBrowserBulletOpen")}</li>}
          <li>{t("openInBrowserBullet1")}</li>
          <li>{t("openInBrowserBullet2")}</li>
        </ul>
        {isAndroid && (
          <button
            type="button"
            onClick={openInBrowser}
            className="mb-2 w-full rounded-lg bg-foreground text-background py-2.5 font-medium"
          >
            {t("openInBrowserButton")}
          </button>
        )}
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
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors ${
              copied
                ? "bg-green-600 text-white dark:bg-green-500"
                : "bg-foreground text-background"
            }`}
          >
            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>
    </div>
  );
}
