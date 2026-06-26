import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TOOLBOXES, getToolbox } from '../toolbox-data'

export function generateStaticParams() {
  return TOOLBOXES.map((tb) => ({ slug: tb.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tb = getToolbox(slug)
  if (!tb) return { title: 'Toolbox Not Found' }
  const url = `https://mtopython.com/toolboxes/${slug}`
  return {
    title: `${tb.matlabName} to ${tb.pythonLib}`,
    description: tb.autoConverted
      ? `Function mapping from MATLAB ${tb.matlabName} to Python ${tb.pythonLib}. ${tb.mappings.length} of the most-used functions, auto-converted with the correct imports.`
      : `Migration guide from MATLAB ${tb.matlabName} to Python ${tb.pythonLib}. ${tb.mappings.length} hand-mapped equivalents — flagged by the converter, not auto-converted.`,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: `${tb.matlabName} to ${tb.pythonLib}`, url },
  }
}

export default async function ToolboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tb = getToolbox(slug)
  if (!tb) notFound()

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Header */}
      <div className="mb-8">
        <a href="/toolboxes" className="text-slate-500 text-sm hover:text-slate-700 transition-colors mb-4 inline-block">
          Toolboxes
        </a>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-slate-900">
            {tb.matlabName} → {tb.pythonLib}
          </h1>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              tb.autoConverted
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {tb.autoConverted ? 'Auto-converted' : 'Migration guide'}
          </span>
        </div>
        <p className="text-slate-600 max-w-2xl">{tb.description}</p>
        {!tb.autoConverted && (
          <p className="text-slate-600 max-w-2xl mt-3 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
            <strong className="text-amber-700">Not auto-converted.</strong> These constructs
            have no 1:1 Python equivalent, so the converter won&apos;t rewrite them — it flags
            each one with a <code className="text-amber-700">{`# TODO:`}</code> comment pointing
            to the equivalents below. Use this page as a hand-migration reference.
          </p>
        )}
      </div>

      {/* Install */}
      <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-slate-500 text-xs mb-1">Install</div>
        <code className="text-purple-600 font-[family-name:var(--font-jetbrains)] text-sm">
          {tb.installCmd}
        </code>
      </div>

      {/* CTA */}
      <div className="mb-8">
        <a
          href="/convert"
          className="inline-block px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 transition-colors"
        >
          {tb.autoConverted ? `Convert ${tb.name} code now` : 'Convert your MATLAB code'}
        </a>
      </div>

      {/* Mapping Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 text-slate-600 font-medium">MATLAB</th>
              <th className="px-4 py-3 text-slate-600 font-medium">Python</th>
              <th className="px-4 py-3 text-slate-600 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {tb.mappings.map((m, i) => (
              <tr
                key={i}
                className="border-t border-gray-200 hover:bg-gray-50"
              >
                <td className="px-4 py-2.5 font-[family-name:var(--font-jetbrains)] text-amber-600 text-xs">
                  {m.matlab}
                </td>
                <td className="px-4 py-2.5 font-[family-name:var(--font-jetbrains)] text-green-600 text-xs">
                  {m.python}
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">
                  {m.note || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 text-center">
        <p className="text-slate-600 mb-4">
          {tb.autoConverted
            ? `The converter automatically detects ${tb.name} functions and adds the correct imports.`
            : `The converter flags ${tb.name} constructs with a # TODO comment and links here, so you always know exactly what needs a hand-port — never silently broken code.`}
        </p>
        <a
          href="/convert"
          className="inline-block px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 transition-colors"
        >
          Try the converter
        </a>
      </div>
    </div>
  )
}
