import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/registro`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/diccionario`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/pesito-para`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/como-funciona`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/comparacion`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
