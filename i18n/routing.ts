import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Georgian is the default (served without a prefix), English and Russian
  // are available at /en and /ru respectively.
  locales: ["ka", "en", "ru"],
  defaultLocale: "ka",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
