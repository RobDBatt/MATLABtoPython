import type { Metadata } from 'next'
import { EXAMPLES } from '@/content/examples'

export const metadata: Metadata = {
  title: 'MATLAB to Python Conversion Examples',
  description:
    'Real MATLAB snippets — Butterworth filter, FFT, peak detection, ODE45, Monte Carlo, K-means, linear solve — converted to Python by the deterministic engine at mtopython.com. Side-by-side with explanations.',
}

export default function ExamplesPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-slate-900 mb-3">
          Conversion examples
        </h1>
        <p className="text-slate-600 max-w-2xl">
          Real MATLAB snippets converted to Python by the same engine that powers
          the <a href="/convert" className="text-purple-600 hover:underline">live converter</a>.
          Each example shows the MATLAB source, the converter&apos;s Python output,
          and notes on what changed and why. The outputs regenerate automatically
          every time the converter improves.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {EXAMPLES.map(ex => (
          <a
            key={ex.slug}
            href={`/examples/${ex.slug}`}
            className="group block p-6 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-400 transition-colors"
          >
            <h2 className="text-slate-900 font-semibold text-lg mb-2 group-hover:text-purple-600 transition-colors">
              {ex.title}
            </h2>
            <p className="text-slate-600 text-sm mb-3">{ex.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {ex.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-slate-500 font-[family-name:var(--font-jetbrains)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>

      <div className="mt-12 text-center">
        <a
          href="/convert"
          className="inline-block px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-500 transition-colors"
        >
          Convert your own code
        </a>
        <p className="text-slate-500 text-xs mt-2">
          Free for 50 lines. No account required.
        </p>
      </div>
    </div>
  )
}
