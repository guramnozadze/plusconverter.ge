import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { SignInRedirect } from "@/components/SignInRedirect";
import { PromoBanner } from "@/components/PromoBanner";
import { ConverterDirectionProvider } from "@/components/ConverterDirection";

// Ad-landing route: e.g. plusconverter.ge/signin goes straight into the
// OAuth prompt instead of the converter. Google is the only sign-in
// provider (Facebook Login was removed - see git history).
export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [{ user }, settings] = await Promise.all([getUserProfile(), getSettings()]);
  if (user) {
    redirect({ href: "/", locale });
  }

  return (
    <ConverterDirectionProvider>
      <PromoBanner initialSettings={settings} />
      <SignInRedirect />
    </ConverterDirectionProvider>
  );
}
