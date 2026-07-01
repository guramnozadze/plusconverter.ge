import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function Footer() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="w-full max-w-2xl mx-auto px-4 py-6 text-sm">
        <div className="flex items-start justify-between gap-3">
          <nav className="flex flex-col items-start gap-2">
            <Link
              href="/terms"
              className="text-foreground/70 hover:text-foreground"
            >
              {t("footer.termsLink")}
            </Link>
            <Link
              href="/privacy"
              className="text-foreground/70 hover:text-foreground"
            >
              {t("footer.privacyLink")}
            </Link>
            <a
              href="https://t.me/plusconverter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/70 hover:text-foreground"
            >
              {t("footer.contactLabel")}
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61591187956542"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/70 hover:text-foreground"
            >
              {t("footer.facebookLabel")}
            </a>
          </nav>
          <LanguageSwitcher />
        </div>
        <div className="mt-6 flex flex-col items-center gap-1 text-center">
          <p className="text-xs text-foreground/50">
            {t("footer.disclaimer")}
          </p>
          <p className="text-xs text-foreground/50">
            {t("footer.copyright", { year })}
          </p>
        </div>
      </div>
    </footer>
  );
}
