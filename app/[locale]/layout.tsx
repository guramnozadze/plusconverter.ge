import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { MetaPixel } from "@/components/MetaPixel";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Header reads the auth cookie on every request (via `Header` -> `getUserProfile`).
// Without this, Next's production build can serve a cached/prerendered shell for
// a URL right after the OAuth redirect, showing stale "signed out" markup until a
// manual reload forces a fresh render — invisible in dev, where caching is off.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL("https://plusconverter.ge"),
    title: {
      default: title,
      template: "%s · plusconverter.ge",
    },
    description,
    other: {
      "facebook-domain-verification": "ku8i4se7tw87ah7ktgkfhats1mqe2n",
    },
    alternates: {
      canonical: locale === "ka" ? "/" : `/${locale}`,
      languages: {
        ka: "/",
        en: "/en",
        ru: "/ru",
      },
    },
    openGraph: {
      title,
      description,
      url: locale === "ka" ? "https://plusconverter.ge" : `https://plusconverter.ge/${locale}`,
      siteName: "plusconverter.ge",
      type: "website",
      locale,
      images: [
        {
          url: "/plusoncverter-cover.png",
          width: 1536,
          height: 768,
          alt: title,
        },
        {
          url: "/plusconverter-profile-pic.png",
          width: 1024,
          height: 1024,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/plusoncverter-cover.png"],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <Header />
          <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
        <Analytics />
        <MetaPixel />
      </body>
    </html>
  );
}
