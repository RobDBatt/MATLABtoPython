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
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-[#f0f0f8] mb-3">
          Learn
        </h1>
        <p className="text-[#9ba3c4] max-w-xl leading-relaxed">
          Practical guides for engineers migrating from MATLAB to Python.
          No filler, no theory — just the mapping you need to get your code running.
        </p>
      </div>

      {/* Published articles */}
      {articles.length > 0 && (
        <div className="mb-12 space-y-3">
          {articles.map((article) => (
            <a
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="block border border-[#1e2547] rounded-lg px-5 py-4 hover:border-[#7c3aed]/50 hover:bg-[#0e1228] transition-colors group"
            >
              <h2 className="text-[#f0f0f8] font-medium mb-1 group-hover:text-[#a78bfa] transition-colors">
                {article.title}
              </h2>
              <p className="text-[#9ba3c4] text-sm">{article.description}</p>
              <span className="text-[#7c3aed] text-xs mt-2 inline-block group-hover:text-[#a78bfa] transition-colors">
                Read →
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Upcoming topics */}
      <div className="mb-6">
        <h2 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-[#f0f0f8] mb-4">
          Coming soon
        </h2>
        <p className="text-sm text-[#9ba3c4] border border-[#1e2547] rounded-lg px-4 py-3 bg-[#0e1228] mb-6">
          More guides are being published. Check back soon, or{' '}
          <a href="/convert" className="text-[#7c3aed] hover:text-[#a78bfa] transition-colors">
            try the converter
          </a>{' '}
          in the meantime.
        </p>
      </div>

      <div className="space-y-3">
        {upcomingTopics.map((topic) => (
          <div
            key={topic.title}
            className="border border-[#1e2547] rounded-lg px-5 py-4 opacity-50"
          >
            <h3 className="text-[#f0f0f8] font-medium mb-1">{topic.title}</h3>
            <p className="text-[#9ba3c4] text-sm">{topic.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <a
          href="/convert"
          className="inline-block px-6 py-3 bg-[#7c3aed] text-white text-sm font-medium rounded-lg hover:bg-[#6d28d9] transition-colors"
        >
          Try the converter now
        </a>
      </div>
    </div>
  )
}
