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
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-[#f0f0f8] mb-3">
          Conversion examples
        </h1>
        <p className="text-[#9ba3c4] max-w-2xl leading-relaxed">
          Real MATLAB snippets converted to Python by the same engine that powers
          the <a href="/convert" className="text-[#7c3aed] hover:text-[#a78bfa] transition-colors">live converter</a>.
          Each example shows the MATLAB source, the converter&apos;s Python output,
          and notes on what changed and why.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {EXAMPLES.map(ex => (
          <a
            key={ex.slug}
            href={`/examples/${ex.slug}`}
            className="group block p-6 bg-[#0e1228] border border-[#1e2547] rounded-lg hover:border-[#7c3aed]/50 transition-colors"
          >
            <h2 className="text-[#f0f0f8] font-semibold text-base mb-2 group-hover:text-[#a78bfa] transition-colors">
              {ex.title}
            </h2>
            <p className="text-[#9ba3c4] text-sm mb-3">{ex.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {ex.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-[#07091a] border border-[#2d3561] rounded text-xs text-[#4d5580] font-[family-name:var(--font-jetbrains)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>

      <div className="mt-12">
        <a
          href="/convert"
          className="inline-block px-6 py-3 bg-[#7c3aed] text-white font-medium rounded-lg hover:bg-[#6d28d9] transition-colors"
        >
          Convert your own code
        </a>
        <p className="text-[#4d5580] text-xs mt-2">
          Free for 50 lines. No account required.
        </p>
      </div>
    </div>
  )
}
