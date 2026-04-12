import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TOOLBOXES, getToolbox } from '../toolbox-data'

export function generateStaticParams() {
  return TOOLBOXES.map((tb) => ({ slug: tb.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const tb = getToolbox(params.slug)
  if (!tb) return { title: 'Toolbox Not Found' }
  return {
    title: `${tb.matlabName} to ${tb.pythonLib}`,
    description: `Complete function mapping from MATLAB ${tb.matlabName} to Python ${tb.pythonLib}. ${tb.mappings.length} functions with usage notes.`,
  }
}

export default function ToolboxPage({ params }: { params: { slug: string } }) {
  const tb = getToolbox(params.slug)
  if (!tb) notFound()

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Header */}
      <div className="mb-8">
        <a href="/toolboxes" className="text-slate-500 text-sm hover:text-slate-300 transition-colors mb-4 inline-block">
          Toolboxes
        </a>
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-white mb-2">
          {tb.matlabName} → {tb.pythonLib}
        </h1>
        <p className="text-slate-400 max-w-2xl">{tb.description}</p>
      </div>

      {/* Install */}
      <div className="mb-8 p-4 bg-navy-900 border border-navy-800 rounded-lg">
        <div className="text-slate-500 text-xs mb-1">Install</div>
        <code className="text-purple-400 font-[family-name:var(--font-jetbrains)] text-sm">
          {tb.installCmd}
        </code>
      </div>

      {/* CTA */}
      <div className="mb-8">
        <a
          href="/convert"
          className="inline-block px-5 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-400 transition-colors"
        >
          Convert {tb.name} code now
        </a>
      </div>

      {/* Mapping Table */}
      <div className="border border-navy-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-900 text-left">
              <th className="px-4 py-3 text-slate-400 font-medium">MATLAB</th>
              <th className="px-4 py-3 text-slate-400 font-medium">Python</th>
              <th className="px-4 py-3 text-slate-400 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {tb.mappings.map((m, i) => (
              <tr
                key={i}
                className="border-t border-navy-800 hover:bg-navy-900/50"
              >
                <td className="px-4 py-2.5 font-[family-name:var(--font-jetbrains)] text-gold-400 text-xs">
                  {m.matlab}
                </td>
                <td className="px-4 py-2.5 font-[family-name:var(--font-jetbrains)] text-green-400 text-xs">
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
        <p className="text-slate-400 mb-4">
          The converter automatically detects {tb.name} functions and adds
          the correct imports.
        </p>
        <a
          href="/convert"
          className="inline-block px-6 py-2.5 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-400 transition-colors"
        >
          Try the converter
        </a>
      </div>
    </div>
  )
}
