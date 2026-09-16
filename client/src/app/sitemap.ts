import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: APP_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${APP_URL}/welcome`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${APP_URL}/gallery`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${APP_URL}/history`, lastModified: now, changeFrequency: 'always', priority: 0.7 },
    { url: `${APP_URL}/documents`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${APP_URL}/chat`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${APP_URL}/traces`, lastModified: now, changeFrequency: 'always', priority: 0.5 },
  ];
}
