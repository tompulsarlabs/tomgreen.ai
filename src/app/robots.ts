import type { MetadataRoute } from "next";
import { site } from "@/lib/content/site";
import { isLaunched } from "@/lib/site-env";

export default function robots(): MetadataRoute.Robots {
  if (!isLaunched) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `https://${site.domain}/sitemap.xml`,
  };
}
