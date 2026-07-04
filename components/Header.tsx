import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/auth";
import { AuthControls } from "./AuthControls";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function Header() {
  const t = await getTranslations();
  const locale = await getLocale();
  const { user, profile } = await getUserProfile();

  const displayName = profile?.username
    ? `@${profile.username}`
    : user?.email || null;

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="w-full max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          <span className="text-orange-500">Plus</span>converter.ge
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {user && (
            <a
              href="http://m.me/61591533212017"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm text-foreground/70 hover:text-foreground"
            >
              {t("nav.help")}
            </a>
          )}
          {profile?.is_admin && (
            <Link
              href="/admin"
              className="shrink-0 text-sm text-foreground/70 hover:text-foreground"
            >
              {t("nav.admin")}
            </Link>
          )}
          <AuthControls
            isAuthenticated={Boolean(user)}
            displayName={displayName}
          />
          {locale === "en" && <LanguageSwitcher />}
        </div>
      </div>
    </header>
  );
}
