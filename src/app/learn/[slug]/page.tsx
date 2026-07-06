import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getArticle, getAllSlugs, articles } from '@/content'
import { EmailCapture } from '@/components/email-capture'
import { RelatedLinks, type RelatedLink } from '@/components/related-links'
import { TOOLBOXES } from '@/app/toolboxes/toolbox-data'
import { EXAMPLES } from '@/content/examples'

export function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return { title: 'Not Found' }
  const url = `https://mtopython.com/learn/${slug}`
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      url,
      publishedTime: article.publishedAt,
      authors: ['Rob Batt'],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
    },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: { '@type': 'Person', name: 'Rob Batt' },
    publisher: {
      '@type': 'Organization',
      name: 'MATLABtoPython',
      url: 'https://mtopython.com',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://mtopython.com/learn/${slug}`,
    },
    keywords: article.keyword,
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <header className="mb-10">
          <time className="text-xs text-slate-500 font-[family-name:var(--font-jetbrains)]">
            {article.publishedAt}
          </time>
          <h1 className="font-[family-name:var(--font-syne)] text-3xl lg:text-4xl font-bold text-slate-900 mt-2 leading-tight">
            {article.title}
          </h1>
          <p className="text-slate-600 mt-4 text-lg">
            {article.description}
          </p>
        </header>

        {/* CTA top */}
        <div className="mb-10 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg">
          <a href="/convert" className="text-orange-600 hover:text-orange-500 text-sm font-medium transition-colors">
            Try the converter free (50 lines, no account) →
          </a>
        </div>

        {/* Article sections */}
        <div className="space-y-8">
          {article.sections.map((section, i) => (
            <section key={i}>
              <h2 className="font-[family-name:var(--font-syne)] text-xl font-semibold text-slate-900 mb-3">
                {section.heading}
              </h2>
              <div className="text-slate-600 text-sm leading-relaxed space-y-4">
                {section.body.split('\n\n').map((paragraph, j) => {
                  // Handle bold markers
                  if (paragraph.startsWith('**') || paragraph.includes('**')) {
                    return (
                      <p key={j} dangerouslySetInnerHTML={{
                        __html: paragraph
                          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-700">$1</strong>')
                          .replace(/`(.+?)`/g, '<code class="text-orange-600 font-[family-name:var(--font-jetbrains)] text-xs bg-gray-50 px-1 py-0.5 rounded">$1</code>')
                      }} />
                    )
                  }
                  return (
                    <p key={j} dangerouslySetInnerHTML={{
                      __html: paragraph
                        .replace(/`(.+?)`/g, '<code class="text-orange-600 font-[family-name:var(--font-jetbrains)] text-xs bg-gray-50 px-1 py-0.5 rounded">$1</code>')
                    }} />
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {/* CTA bottom */}
        <div className="mt-12 text-center">
          <a
            href="/convert"
            className="inline-block px-8 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-500 transition-colors"
          >
            Start converting
          </a>
          <p className="text-slate-500 text-xs mt-2">
            Free for 50 lines. No account required.
          </p>
        </div>

        {/* Newsletter capture — article-scoped source for attribution */}
        <div className="mt-12">
          <EmailCapture
            source={`article-${slug}`}
            headline="More like this, once a week"
            sub={`New articles on MATLAB-to-Python migration. Short, practical, no fluff — the same tone as the one you just read.`}
          />
        </div>

        {/* Related content — keeps visitors on-site */}
        <RelatedLinks
          heading="Keep reading"
          links={buildRelatedLinks(slug, article.keyword)}
        />
      </article>
    </div>
  )
}

/**
 * Build a 4-link "Keep reading" block: 2 other articles (by keyword
 * overlap, then by recency), 1 toolbox page (if topic matches), 1
 * example (if topic matches). Always includes the converter CTA if
 * fewer than 4 items match.
 */
function buildRelatedLinks(currentSlug: string, keyword: string): RelatedLink[] {
  const links: RelatedLink[] = []
  const lowerKw = keyword.toLowerCase()

  // Other articles — prefer shared keywords
  const otherArticles = articles
    .filter(a => a.slug !== currentSlug)
    .map(a => ({
      article: a,
      score: overlapScore(lowerKw, a.keyword.toLowerCase()),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)

  for (const { article } of otherArticles) {
    links.push({
      kind: 'article',
      href: `/learn/${article.slug}`,
      title: article.title,
      caption: article.description,
    })
  }

  // One related toolbox
  const toolboxMatch = TOOLBOXES.find(t =>
    lowerKw.includes(t.slug.replace(/-/g, ' ')) || lowerKw.includes(t.name.toLowerCase()),
  )
  if (toolboxMatch) {
    links.push({
      kind: 'toolbox',
      href: `/toolboxes/${toolboxMatch.slug}`,
      title: `${toolboxMatch.name} Toolbox mapping`,
      caption: `Every ${toolboxMatch.matlabName} function mapped to ${toolboxMatch.pythonLib}.`,
    })
  }

  // One related example
  const exampleMatch = EXAMPLES.find(ex =>
    ex.tags.some(tag => lowerKw.includes(tag.replace(/-/g, ' '))),
  )
  if (exampleMatch) {
    links.push({
      kind: 'example',
      href: `/examples/${exampleMatch.slug}`,
      title: exampleMatch.title,
      caption: exampleMatch.summary,
    })
  }

  // Always include converter CTA
  links.push({
    kind: 'converter',
    href: '/convert',
    title: 'Convert your own MATLAB code',
    caption: 'Paste it in. Same engine that powers every example on this site. Free for 50 lines.',
  })

  return links.slice(0, 4)
}

function overlapScore(a: string, b: string): number {
  const aWords = new Set(a.split(/\s+/).filter(w => w.length > 3))
  const bWords = b.split(/\s+/).filter(w => w.length > 3)
  let score = 0
  for (const w of bWords) if (aWords.has(w)) score++
  return score
}
