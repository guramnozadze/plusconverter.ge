import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Georgian is the default (served without a prefix), English is available
  // at /en.
  locales: ["ka", "en"],
  defaultLocale: "ka",
  localePrefix: "as-needed",
  // Without this, the middleware re-detects locale from the NEXT_LOCALE
  // cookie / Accept-Language header on every request — independent of which
  // locale the link was clicked from — so a bare "/" (Georgian) can bounce to
  // "/en" if the browser's language or a stale cookie says English. The URL
  // itself should be the only source of truth for which locale to serve.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
