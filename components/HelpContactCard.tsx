import { useTranslations } from "next-intl";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "./icons/ProviderIcons";

// Shown throughout the order-creation flow (account picker through the
// pending order screen) so a stuck user always has a way to reach a human.
// Disappears once the order reaches a terminal status (see call sites).
export function HelpContactCard() {
  const t = useTranslations("help");
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 text-sm space-y-2">
      <p className="text-foreground/70">{t("intro")}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href="http://m.me/61591533212017"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 font-medium text-foreground/80 hover:border-black/20 hover:text-foreground dark:hover:border-white/25"
        >
          <FacebookIcon className="h-4 w-4 shrink-0" />
          {t("messenger")}
        </a>
        <a
          href="https://t.me/plusconverter"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 font-medium text-foreground/80 hover:border-black/20 hover:text-foreground dark:hover:border-white/25"
        >
          <TelegramIcon className="h-4 w-4 shrink-0" />
          {t("telegram")}
        </a>
        <a
          href="https://wa.me/995574120140"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 font-medium text-foreground/80 hover:border-black/20 hover:text-foreground dark:hover:border-white/25"
        >
          <WhatsAppIcon className="h-4 w-4 shrink-0" />
          {t("whatsapp")}
        </a>
      </div>
    </div>
  );
}
