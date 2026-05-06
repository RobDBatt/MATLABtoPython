import type { Metadata } from 'next'
import { articles } from '@/content'

export const metadata: Metadata = {
  title: 'Learn — MATLAB to Python Guides',
  description:
    'Practical guides for engineers migrating from MATLAB to Python. Syntax mapping, toolbox equivalents, and real conversion examples.',
}

const upcomingTopics = [
  {
    title: 'Deep Learning Toolbox to PyTorch: Full Migration Guide',
    description: 'Layer-by-layer translation from trainNetwork/layerGraph to PyTorch nn.Module. Data loaders, pretrained models, and the training-loop rewrite.',
  },
  {
    title: 'MATLAB Coder to Python: Shipping Standalone Scientific Apps',
    description: 'MATLAB Coder builds C/C++ binaries from .m files. The Python equivalents — PyInstaller, Nuitka, Cython — compared honestly, with real benchmarks.',
  },
  {
    title: 'MATLAB classdef to Python Class: Handle vs Value Semantics',
    description: 'Handle classes, value classes, events, and listeners — what translates cleanly, what needs a rewrite, and when to use dataclasses.',
  },
  {
    title: 'Parallel Computing Toolbox to joblib and dask',
    description: 'parfor, spmd, distributed arrays — when to use joblib (parfor drop-in), multiprocessing (explicit), or dask (out-of-core).',
  },
  {
    title: 'Bioinformatics Toolbox to Biopython and scikit-bio',
    description: 'Sequence analysis, genomics workflows, and phylogenetic trees. The migration guide for biologists leaving MATLAB.',
  },
]

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-slate-900 mb-3">
          Learn
        </h1>
        <p className="text-slate-600 max-w-xl">
          Practical guides for engineers migrating from MATLAB to Python.
          No filler, no theory — just the mapping you need to get your code running.
        </p>
      </div>

      {/* Published articles */}
      {articles.length > 0 && (
        <div className="mb-12 space-y-4">
          {articles.map((article) => (
            <a
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="block border border-gray-200 rounded-lg px-5 py-4 hover:border-purple-400 transition-colors"
            >
              <h2 className="text-slate-900 font-medium mb-1">{article.title}</h2>
              <p className="text-slate-500 text-sm">{article.description}</p>
              <span className="text-purple-600 text-xs mt-2 inline-block">Read →</span>
            </a>
          ))}
        </div>
      )}

      {/* Upcoming topics */}
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-slate-900 mb-4">
          Coming soon
        </h2>
        <p className="text-sm text-slate-500 border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 mb-6">
          More guides are being published. Check back soon, or{' '}
          <a href="/convert" className="text-purple-600 hover:text-purple-500 transition-colors">
            try the converter
          </a>{' '}
          in the meantime.
        </p>
      </div>

      <div className="space-y-4">
        {upcomingTopics.map((topic) => (
          <div
            key={topic.title}
            className="border border-gray-200 rounded-lg px-5 py-4 opacity-60"
          >
            <h3 className="text-slate-900 font-medium mb-1">{topic.title}</h3>
            <p className="text-slate-500 text-sm">{topic.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <a
          href="/convert"
          className="inline-block px-6 py-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 transition-colors"
        >
          Try the converter now
        </a>
      </div>
    </div>
  )
}
