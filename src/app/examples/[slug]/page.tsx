import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EXAMPLES, getExample, getAllExampleSlugs } from '@/content/examples'
import { convert } from '@/lib/converter'
import { EmailCapture } from '@/components/email-capture'

export function generateStaticParams() {
  return getAllExampleSlugs().map(slug => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const example = getExample(slug)
  if (!example) return { title: 'Not Found' }
  return {
    title: `${example.title} — MATLAB to Python example`,
    description: example.summary,
  }
}

export default async function ExamplePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const example = getExample(slug)
  if (!example) return notFound()

  // Run the source through the same converter the public uses, at build
  // time. Any converter improvement flows into the example automatically.
  const result = convert(example.matlab)

  // Find neighboring examples for pagination-style nav
  const currentIdx = EXAMPLES.findIndex(e => e.slug === example.slug)
  const prevExample = currentIdx > 0 ? EXAMPLES[currentIdx - 1] : null
  const nextExample =
    currentIdx < EXAMPLES.length - 1 ? EXAMPLES[currentIdx + 1] : null

  const matlabLineCount = example.matlab.split('\n').length
  const pythonLineCount = result.python.split('\n').length
  const flagCount = result.report.flags.length

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <nav className="text-xs text-slate-500 mb-6">
        <a href="/examples" className="hover:text-orange-600">← All examples</a>
      </nav>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {example.tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs text-slate-500 font-[family-name:var(--font-jetbrains)]"
            >
              {tag}
            </span>
          ))}
        </div>
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-slate-900 mb-3 leading-tight">
          {example.title}
        </h1>
        <p className="text-slate-600">{example.summary}</p>
      </header>

      <section className="mb-8 text-sm text-slate-700 leading-relaxed">
        <p>{example.context}</p>
      </section>

      {/* Side-by-side */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* MATLAB */}
        <div className="rounded-lg border border-gray-200 bg-slate-950 overflow-hidden">
          <div className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-mono flex items-center justify-between">
            <span>MATLAB source</span>
            <span className="text-slate-500">{matlabLineCount} lines</span>
          </div>
          <pre className="p-4 text-sm text-slate-100 overflow-x-auto font-[family-name:var(--font-jetbrains)] whitespace-pre-wrap">
            {example.matlab}
          </pre>
        </div>
        {/* Python */}
        <div className="rounded-lg border border-gray-200 bg-slate-950 overflow-hidden">
          <div className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-mono flex items-center justify-between">
            <span>Python output (converter-generated)</span>
            <span className="text-slate-500">
              {pythonLineCount} lines · {flagCount} flag{flagCount === 1 ? '' : 's'}
            </span>
          </div>
          <pre className="p-4 text-sm text-slate-100 overflow-x-auto font-[family-name:var(--font-jetbrains)] whitespace-pre-wrap">
            {result.python}
          </pre>
        </div>
      </div>

      {/* Flags (if any) */}
      {result.report.flags.length > 0 && (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="text-slate-900 font-medium mb-2">
            Converter flags ({result.report.flags.length})
          </div>
          <ul className="space-y-2 text-slate-700">
            {result.report.flags.slice(0, 8).map((flag, i) => (
              <li key={i} className="flex gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-200 text-amber-900 shrink-0 h-fit">
                  {flag.type}
                </span>
                <span>
                  Line {flag.originalLine}: {flag.message}
                </span>
              </li>
            ))}
            {result.report.flags.length > 8 && (
              <li className="text-xs text-slate-500">
                ...and {result.report.flags.length - 8} more.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Notes */}
      {example.notes && (
        <div className="mb-10 p-4 rounded-lg border border-gray-200 bg-gray-50 text-sm text-slate-700">
          <div className="font-medium text-slate-900 mb-1">Implementation notes</div>
          {example.notes}
        </div>
      )}

      {/* CTA */}
      <div className="my-10 text-center">
        <a
          href="/convert"
          className="inline-block px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-500 transition-colors"
        >
          Try it on your own MATLAB
        </a>
        <p className="text-slate-500 text-xs mt-2">
          Free for 50 lines. Same converter that produced the Python above.
        </p>
      </div>

      {/* Prev / Next */}
      <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-6 mt-12">
        <div>
          {prevExample && (
            <a
              href={`/examples/${prevExample.slug}`}
              className="block p-4 rounded-lg border border-gray-200 hover:border-orange-400 transition-colors"
            >
              <div className="text-xs text-slate-500 mb-1">← Previous example</div>
              <div className="text-slate-900 font-medium text-sm">{prevExample.title}</div>
            </a>
          )}
        </div>
        <div>
          {nextExample && (
            <a
              href={`/examples/${nextExample.slug}`}
              className="block p-4 rounded-lg border border-gray-200 hover:border-orange-400 transition-colors text-right"
            >
              <div className="text-xs text-slate-500 mb-1">Next example →</div>
              <div className="text-slate-900 font-medium text-sm">{nextExample.title}</div>
            </a>
          )}
        </div>
      </div>

      {/* Email capture */}
      <div className="mt-12">
        <EmailCapture
          source={`example-${slug}`}
          headline="More examples like this, once a week"
          sub="New canonical conversions and release notes from the converter. One email, no spam."
        />
      </div>
    </div>
  )
}
