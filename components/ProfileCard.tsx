"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { saveProfile } from "@/lib/actions/profile";
import type { Profile } from "@/lib/supabase/types";

// Other pages (e.g. the review nudge) can link to "/?editUsername=1" to land
// here, expand, and focus the username field — a query param rather than a
// "#id" anchor, since anchors make the browser jump-scroll on arrival.
export const PROFILE_USERNAME_PARAM = "editUsername";

// Always-visible account card: the user's default details. Full name + account
// number are used to receive GEL when selling; only username is ever shown to
// others. All fields optional. Folded by default (mobile-first, max 2 lines);
// the edit button expands it, and saving folds it back.
export function ProfileCard({ profile }: { profile: Profile }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [accountNumber, setAccountNumber] = useState(
    profile.account_number ?? "",
  );
  const [username, setUsername] = useState(profile.username ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  // useSearchParams re-fires this effect both on first load and on same-page
  // navigations (e.g. from "My Transactions", already on "/"), unlike a
  // mount-only effect watching window.location.
  useEffect(() => {
    if (searchParams.get(PROFILE_USERNAME_PARAM) !== "1") return;
    setEditing(true);
    const query = Object.fromEntries(searchParams.entries());
    delete query[PROFILE_USERNAME_PARAM];
    router.replace({ pathname, query }, { scroll: false });
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (!editing) return;
    usernameRef.current?.focus();
    usernameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [editing]);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    const res = await saveProfile({ username, fullName, accountNumber });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setEditing(false);
      router.refresh();
    } else {
      setError(res.error ?? "update_failed");
    }
  }

  const summary = [
    fullName,
    accountNumber,
    username ? `@${username}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-4 rounded-xl border border-black/10 dark:border-white/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{t("title")}</h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="shrink-0 rounded-full bg-black/5 dark:bg-white/10 px-4 py-1.5 text-sm font-medium"
        >
          {t("edit")}
        </button>
      </div>

      {!editing && (
        <p className="mt-1 truncate text-sm text-foreground/60">
          {summary || t("empty")}
        </p>
      )}

      {editing && (
        <>
          <p className="text-sm text-foreground/60 mb-3 mt-1">
            {t("securityNote")}
          </p>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-foreground/60">
                {t("fullName")}
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setSaved(false);
                }}
                maxLength={120}
                className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/30"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-foreground/60">
                {t("accountNumber")}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value);
                  setSaved(false);
                }}
                maxLength={40}
                className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-foreground/30"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-foreground/60">
                {t("username")}
              </span>
              <p className="mb-1.5 text-xs text-foreground/50">
                {t("usernameHint")}
              </p>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/\s/g, ""));
                  setSaved(false);
                  setError(null);
                }}
                maxLength={32}
                placeholder={t("usernamePlaceholder")}
                className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/30"
              />
              {(error === "username_taken" || error === "username_invalid") && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {t(error === "username_taken" ? "usernameTaken" : "usernameInvalid")}
                </p>
              )}
            </label>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {t("save")}
            </button>
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400">
                {t("saved")}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
