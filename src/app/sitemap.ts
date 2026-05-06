import type { MetadataRoute } from 'next'
import { articles } from '@/content'
import { EXAMPLES } from '@/content/examples'
import { TOOLBOXES } from './toolboxes/toolbox-data'

const BASE_URL = 'https://mtopython.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const core: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/convert`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/learn`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/toolboxes`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/examples`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/debug`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const articleUrls: MetadataRoute.Sitemap = articles.map(a => ({
    url: `${BASE_URL}/learn/${a.slug}`,
    lastModified: a.publishedAt ? new Date(a.publishedAt) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const toolboxUrls: MetadataRoute.Sitemap = TOOLBOXES.map(t => ({
    url: `${BASE_URL}/toolboxes/${t.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const exampleUrls: MetadataRoute.Sitemap = EXAMPLES.map(e => ({
    url: `${BASE_URL}/examples/${e.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...core, ...articleUrls, ...toolboxUrls, ...exampleUrls]
}
