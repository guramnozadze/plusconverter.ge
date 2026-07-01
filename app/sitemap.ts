import type { MetadataRoute } from "next";

const BASE_URL = "https://plusconverter.ge";

// Only public, indexable routes — order/admin pages are per-user or gated.
const PATHS = ["", "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    alternates: {
      languages: {
        ka: `${BASE_URL}${path}`,
        en: `${BASE_URL}/en${path}`,
      },
    },
  }));
}
