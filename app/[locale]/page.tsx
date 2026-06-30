import { setRequestLocale } from "next-intl/server";
import { getSettings } from "@/lib/data";
import { getUserProfile } from "@/lib/auth";
import { Converter } from "@/components/Converter";
import { UsernamePrompt } from "@/components/UsernamePrompt";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [settings, { user, profile }] = await Promise.all([
    getSettings(),
    getUserProfile(),
  ]);

  const needsUsername = Boolean(user && profile && !profile.username);

  return (
    <div>
      {needsUsername && user && <UsernamePrompt userId={user.id} />}
      <Converter initialSettings={settings} isAuthenticated={Boolean(user)} />
    </div>
  );
}
