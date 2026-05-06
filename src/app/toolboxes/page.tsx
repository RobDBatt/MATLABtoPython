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
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-slate-900 mb-3">
          MATLAB Toolbox to Python Mapping
        </h1>
        <p className="text-slate-600 max-w-2xl">
          Each MATLAB toolbox has a Python equivalent. These pages map every function
          to its Python counterpart with the correct import statement and usage notes.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TOOLBOXES.map((tb) => (
          <a
            key={tb.slug}
            href={`/toolboxes/${tb.slug}`}
            className="group p-6 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-400 transition-colors"
          >
            <h2 className="text-slate-900 font-semibold text-lg mb-1 group-hover:text-purple-600 transition-colors">
              {tb.name}
            </h2>
            <div className="text-purple-600 text-sm font-[family-name:var(--font-jetbrains)] mb-3">
              {tb.pythonLib}
            </div>
            <p className="text-slate-600 text-sm mb-3">{tb.description}</p>
            <div className="text-slate-500 text-xs">
              {tb.mappings.length} functions mapped
            </div>
          </a>
        ))}
      </div>

      <div className="mt-12 p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <h2 className="text-slate-900 font-semibold mb-2">Not seeing your toolbox?</h2>
        <p className="text-slate-600 text-sm">
          The converter also detects Wavelets (PyWavelets), Bioinformatics (Biopython),
          and many less-common toolbox functions. If your code uses an unmapped function,
          the converter flags it with a TODO comment pointing to the right Python library
          — you&apos;ll never get silently broken code. Request a new toolbox page via the
          contact form and we&apos;ll prioritize it.
        </p>
      </div>
    </div>
  )
}
