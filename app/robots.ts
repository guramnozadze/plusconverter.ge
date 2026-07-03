import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/en/admin",
        "/ru/admin",
        "/order",
        "/en/order",
        "/ru/order",
        "/auth",
      ],
    },
    sitemap: "https://plusconverter.ge/sitemap.xml",
  };
}
