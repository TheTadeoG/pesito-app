import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";
import { rubroPages } from "@/lib/pesito-para-data";
import { blogPosts } from "@/lib/blog-data";
import { comparisonBlocks } from "@/lib/comparacion-data";
import { glossaryCategories } from "@/lib/diccionario-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const allTerms = glossaryCategories.flatMap((c) => c.terms);

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/registro`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/diccionario`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...allTerms.map((t) => ({
      url: `${siteUrl}/diccionario/${t.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    { url: `${siteUrl}/pesito-para`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...rubroPages.map((r) => ({
      url: `${siteUrl}/pesito-para/${r.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${siteUrl}/como-funciona`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/comparar-planes`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/comparacion`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...comparisonBlocks.map((b) => ({
      url: `${siteUrl}/comparacion/${b.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    { url: `${siteUrl}/preguntas-frecuentes`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
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
