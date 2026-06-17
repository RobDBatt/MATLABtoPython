import type { Metadata } from 'next'
import { TOOLBOXES } from './toolbox-data'

export const metadata: Metadata = {
  title: 'MATLAB Toolbox to Python Mapping',
  description:
    'Complete function mapping tables for 10 MATLAB toolboxes: Signal Processing, Statistics, Image Processing, Optimization, Control Systems, Deep Learning, Curve Fitting, Parallel Computing, Symbolic Math, and Database.',
}

export default function ToolboxesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-[#f0f0f8] mb-3">
          MATLAB Toolbox to Python Mapping
        </h1>
        <p className="text-[#9ba3c4] max-w-2xl leading-relaxed">
          Each MATLAB toolbox has a Python equivalent. These pages map every function
          to its Python counterpart with the correct import statement and usage notes.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLBOXES.map((tb) => (
          <a
            key={tb.slug}
            href={`/toolboxes/${tb.slug}`}
            className="group p-6 bg-[#0e1228] border border-[#1e2547] rounded-lg hover:border-[#7c3aed]/50 transition-colors"
          >
            <h2 className="text-[#f0f0f8] font-semibold text-base mb-1 group-hover:text-[#a78bfa] transition-colors">
              {tb.name}
            </h2>
            <div className="text-[#7c3aed] text-xs font-[family-name:var(--font-jetbrains)] mb-3">
              {tb.pythonLib}
            </div>
            <p className="text-[#9ba3c4] text-sm mb-3">{tb.description}</p>
            <div className="text-[#4d5580] text-xs">
              {tb.mappings.length} functions mapped
            </div>
          </a>
        ))}
      </div>

      <div className="mt-10 p-5 bg-[#0e1228] border border-[#1e2547] rounded-lg">
        <h2 className="text-[#f0f0f8] font-semibold mb-2 text-sm">Not seeing your toolbox?</h2>
        <p className="text-[#9ba3c4] text-sm leading-relaxed">
          The converter also detects Wavelets (PyWavelets), Bioinformatics (Biopython),
          and many less-common toolbox functions. If your code uses an unmapped function,
          the converter flags it with a <code className="text-[#a78bfa] text-xs"># TODO:</code> comment
          pointing to the right Python library — you&apos;ll never get silently broken code.
        </p>
      </div>
    </div>
  )
}
