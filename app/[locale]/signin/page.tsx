import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { SignInRedirect } from "@/components/SignInRedirect";
import { PromoBanner } from "@/components/PromoBanner";
import { ConverterDirectionProvider } from "@/components/ConverterDirection";

// Ad-landing route: e.g. plusconverter.ge/signin?provider=facebook goes
// straight into that provider's OAuth prompt instead of the converter.
// Defaults to Facebook since that's the only ad channel in use so far.
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ provider?: string }>;
}) {
  const { locale } = await params;
  const { provider: providerParam } = await searchParams;
  setRequestLocale(locale);

  const [{ user }, settings] = await Promise.all([getUserProfile(), getSettings()]);
  if (user) {
    redirect({ href: "/", locale });
  }

  const provider = providerParam === "google" ? "google" : "facebook";

  return (
    <ConverterDirectionProvider>
      <PromoBanner initialSettings={settings} />
      <SignInRedirect provider={provider} />
    </ConverterDirectionProvider>
  );
}
