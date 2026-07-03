import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { FacebookIcon, TelegramIcon } from "./icons/ProviderIcons";

export async function Footer() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-4 border-t border-black/10 dark:border-white/10">
      <div className="w-full max-w-2xl mx-auto px-4 pt-8 pb-6 text-sm">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
            {t("footer.contactTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://www.facebook.com/profile.php?id=61591533212017"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 font-medium text-foreground/80 hover:border-black/20 hover:text-foreground dark:hover:border-white/25"
            >
              <FacebookIcon className="h-4 w-4 shrink-0" />
              {t("footer.facebookLabel")}
            </a>
            <a
              href="https://t.me/plusconverter"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 font-medium text-foreground/80 hover:border-black/20 hover:text-foreground dark:hover:border-white/25"
            >
              <TelegramIcon className="h-4 w-4 shrink-0" />
              {t("footer.contactLabel")}
            </a>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
            {t("footer.legalTitle")}
          </p>
          <nav className="flex flex-col items-start gap-1.5">
            <Link
              href="/terms"
              prefetch={false}
              className="text-foreground/70 hover:text-foreground"
            >
              {t("footer.termsLink")}
            </Link>
            <Link
              href="/privacy"
              prefetch={false}
              className="text-foreground/70 hover:text-foreground"
            >
              {t("footer.privacyLink")}
            </Link>
          </nav>
        </div>

        <div className="mt-5 flex justify-center">
          <LanguageSwitcher />
        </div>

        <div className="mt-5 flex flex-col items-center gap-1 text-center">
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
