import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/profile", "/login"],
      },
      {
        userAgent: "GPTBot",
        allow: ["/", "/about", "/editorial-policy", "/fact-checking-methodology", "/corrections"],
        disallow: ["/admin", "/api/", "/profile"],
      },
    ],
    sitemap: `${config.siteUrl}/sitemap.xml`,
    host: config.siteUrl,
  };
}
