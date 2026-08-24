import type { MetadataRoute } from "next";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${site.domain}`;
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/work`, priority: 0.9 },
    ...caseStudies.map((study) => ({
      url: `${base}/work/${study.slug}`,
      priority: 0.8,
    })),
    { url: `${base}/building`, priority: 0.7 },
    { url: `${base}/about`, priority: 0.6 },
  ];
}
