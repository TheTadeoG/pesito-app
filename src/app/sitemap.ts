import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";
import { rubroPages } from "@/lib/pesito-para-data";
import { blogPosts } from "@/lib/blog-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/registro`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/diccionario`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/pesito-para`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...rubroPages.map((r) => ({
      url: `${siteUrl}/pesito-para/${r.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${siteUrl}/como-funciona`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/comparacion`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...blogPosts.map((p) => ({
      url: `${siteUrl}/blog/${p.slug}`,
      lastModified: new Date(p.publishedAt),
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
    { url: `${siteUrl}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
