import type { Metadata } from 'next'
import { TOOLBOXES } from './toolbox-data'

export const metadata: Metadata = {
  title: 'MATLAB Toolbox to Python Mapping',
  description:
    'Function mapping tables for 11 MATLAB toolboxes: Signal Processing, Statistics, Image Processing, Optimization, Control Systems, Symbolic Math, Curve Fitting, Wavelets, Deep Learning, Parallel Computing, and Database. Eight are auto-converted; three are hand-migration guides.',
}

export default function ToolboxesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-[#eef0f4] mb-3">
          MATLAB Toolbox to Python Mapping
        </h1>
        <p className="text-[#9aa1ac] max-w-2xl leading-relaxed">
          Each MATLAB toolbox has a Python equivalent. These pages map the most-used
          functions to their Python counterparts with the correct import statement and
          usage notes. Toolboxes marked <span className="text-[#34d399]">Auto-converted</span> are
          transformed by the engine; those marked <span className="text-[#fbbf24]">Migration guide</span> have
          no 1:1 mapping — the converter flags them and points you here.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLBOXES.map((tb) => (
          <a
            key={tb.slug}
            href={`/toolboxes/${tb.slug}`}
            className="group p-6 bg-[#1b1e26] border border-[#2a2e3a] rounded-lg hover:border-[#d9662b]/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-[#eef0f4] font-semibold text-base group-hover:text-[#e8935f] transition-colors">
                {tb.name}
              </h2>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  tb.autoConverted
                    ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/30'
                    : 'bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30'
                }`}
              >
                {tb.autoConverted ? 'Auto-converted' : 'Migration guide'}
              </span>
            </div>
            <div className="text-[#d9662b] text-xs font-[family-name:var(--font-jetbrains)] mb-3">
              {tb.pythonLib}
            </div>
            <p className="text-[#9aa1ac] text-sm mb-3">{tb.description}</p>
            <div className="text-[#5a5f6b] text-xs">
              {tb.autoConverted
                ? `${tb.mappings.length} functions mapped`
                : `${tb.mappings.length} equivalents documented — not auto-converted`}
            </div>
          </a>
        ))}
      </div>

      <div className="mt-10 p-5 bg-[#1b1e26] border border-[#2a2e3a] rounded-lg">
        <h2 className="text-[#eef0f4] font-semibold mb-2 text-sm">Not seeing your toolbox?</h2>
        <p className="text-[#9aa1ac] text-sm leading-relaxed">
          The converter also detects Wavelets (PyWavelets), Bioinformatics (Biopython),
          and many less-common toolbox functions. If your code uses an unmapped function,
          the converter flags it with a <code className="text-[#e8935f] text-xs"># TODO:</code> comment
          pointing to the right Python library — you&apos;ll never get silently broken code.
        </p>
      </div>
    </div>
  )
}
