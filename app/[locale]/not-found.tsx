import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-foreground/80">{t("body")}</p>
      <Link
        href="/"
        className="text-sm font-medium text-foreground underline underline-offset-4"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
