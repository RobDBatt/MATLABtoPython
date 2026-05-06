import { articles } from '@/content'

/**
 * RSS 2.0 feed for the /learn articles. Picked up by aggregators
 * (Planet.Python, DEV.to import), personal feed readers, and some SEO
 * tools. Keeps the site discoverable beyond plain search.
 */

const BASE_URL = 'https://mtopython.com'

function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET() {
  const sorted = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )

  const items = sorted.map(a => {
    const url = `${BASE_URL}/learn/${a.slug}`
    const pubDate = new Date(a.publishedAt).toUTCString()
    return `    <item>
      <title>${escape(a.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escape(a.description)}</description>
    </item>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MATLABtoPython — Migration Guides</title>
    <link>${BASE_URL}/learn</link>
    <description>Practical guides for engineers migrating from MATLAB to Python.</description>
    <language>en-us</language>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
