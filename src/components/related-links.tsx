/**
 * Reusable "You might also like" block. Surfaces cross-links between
 * articles, toolboxes, and examples so visitors have a path deeper into
 * the site — improves time-on-site, internal PageRank, and SEO.
 *
 * Takes a heterogeneous list of link objects so each page can mix
 * sibling content types without needing a separate component per case.
 */

export interface RelatedLink {
  href: string
  title: string
  caption?: string
  kind?: 'article' | 'toolbox' | 'example' | 'converter'
}

const KIND_LABELS: Record<NonNullable<RelatedLink['kind']>, string> = {
  article: 'Guide',
  toolbox: 'Toolbox',
  example: 'Example',
  converter: 'Tool',
}

export function RelatedLinks({
  heading = 'Related',
  links,
}: {
  heading?: string
  links: RelatedLink[]
}) {
  if (links.length === 0) return null
  return (
    <section className="mt-12 border-t border-gray-200 pt-8">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
        {heading}
      </h2>
      <div className="grid md:grid-cols-2 gap-3">
        {links.map(link => (
          <a
            key={link.href}
            href={link.href}
            className="group block p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-orange-400 transition-colors"
          >
            {link.kind && (
              <div className="text-[10px] uppercase tracking-wider text-orange-600 font-[family-name:var(--font-jetbrains)] mb-1">
                {KIND_LABELS[link.kind]}
              </div>
            )}
            <div className="text-slate-900 font-medium text-sm group-hover:text-orange-600 transition-colors">
              {link.title}
            </div>
            {link.caption && (
              <div className="text-slate-500 text-xs mt-1">{link.caption}</div>
            )}
          </a>
        ))}
      </div>
    </section>
  )
}
