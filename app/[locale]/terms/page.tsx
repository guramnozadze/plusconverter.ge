import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";

const SECTION_KEYS = [
  "rates",
  "finality",
  "accountDetails",
  "orderExpiry",
  "disclaimer",
  "contact",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });

  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-foreground/80">{t("intro")}</p>
      {SECTION_KEYS.map((key) => (
        <section key={key} className="space-y-1">
          <h2 className="font-medium">{t(`sections.${key}.title`)}</h2>
          <p className="text-sm text-foreground/80">
            {t(`sections.${key}.body`)}
          </p>
        </section>
      ))}
    </div>
  );
}
