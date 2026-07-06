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
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-[#eef0f4] mb-3">
          Conversion examples
        </h1>
        <p className="text-[#9aa1ac] max-w-2xl leading-relaxed">
          Real MATLAB snippets converted to Python by the same engine that powers
          the <a href="/convert" className="text-[#d9662b] hover:text-[#e8935f] transition-colors">live converter</a>.
          Each example shows the MATLAB source, the converter&apos;s Python output,
          and notes on what changed and why.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {EXAMPLES.map(ex => (
          <a
            key={ex.slug}
            href={`/examples/${ex.slug}`}
            className="group block p-6 bg-[#1b1e26] border border-[#2a2e3a] rounded-lg hover:border-[#d9662b]/50 transition-colors"
          >
            <h2 className="text-[#eef0f4] font-semibold text-base mb-2 group-hover:text-[#e8935f] transition-colors">
              {ex.title}
            </h2>
            <p className="text-[#9aa1ac] text-sm mb-3">{ex.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {ex.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-[#15171d] border border-[#3a3f4d] rounded text-xs text-[#5a5f6b] font-[family-name:var(--font-jetbrains)]"
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
          className="inline-block px-6 py-3 bg-[#d9662b] text-white font-medium rounded-lg hover:bg-[#b8541f] transition-colors"
        >
          Convert your own code
        </a>
        <p className="text-[#5a5f6b] text-xs mt-2">
          Free for 50 lines. No account required.
        </p>
      </div>
    </div>
  )
}
