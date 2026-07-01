import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/en/admin", "/order", "/en/order", "/auth"],
    },
    sitemap: "https://plusconverter.ge/sitemap.xml",
  };
}
