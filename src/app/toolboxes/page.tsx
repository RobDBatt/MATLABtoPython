import type { Metadata } from 'next'
import { TOOLBOXES } from './toolbox-data'

export const metadata: Metadata = {
  title: 'MATLAB Toolbox to Python Mapping',
  description:
    'Complete function mapping tables for MATLAB toolboxes to their Python equivalents: scipy.signal, scipy.stats, scikit-image, scipy.optimize, python-control.',
}

export default function ToolboxesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-white mb-3">
          MATLAB Toolbox to Python Mapping
        </h1>
        <p className="text-slate-400 max-w-2xl">
          Each MATLAB toolbox has a Python equivalent. These pages map every function
          to its Python counterpart with the correct import statement and usage notes.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TOOLBOXES.map((tb) => (
          <a
            key={tb.slug}
            href={`/toolboxes/${tb.slug}`}
            className="group p-6 bg-navy-900 border border-navy-800 rounded-lg hover:border-purple-500/30 transition-colors"
          >
            <h2 className="text-white font-semibold text-lg mb-1 group-hover:text-purple-400 transition-colors">
              {tb.name}
            </h2>
            <div className="text-purple-400 text-sm font-[family-name:var(--font-jetbrains)] mb-3">
              {tb.pythonLib}
            </div>
            <p className="text-slate-400 text-sm mb-3">{tb.description}</p>
            <div className="text-slate-500 text-xs">
              {tb.mappings.length} functions mapped
            </div>
          </a>
        ))}
      </div>

      <div className="mt-12 p-6 bg-navy-900/50 border border-navy-800 rounded-lg">
        <h2 className="text-white font-semibold mb-2">Not seeing your toolbox?</h2>
        <p className="text-slate-400 text-sm">
          The converter also detects Symbolic Math (SymPy), Wavelets (PyWavelets), and
          Curve Fitting (scipy.interpolate) functions. If your code uses an unmapped
          toolbox function, the converter flags it with a TODO comment pointing you to
          the right Python library.
        </p>
      </div>
    </div>
  )
}
