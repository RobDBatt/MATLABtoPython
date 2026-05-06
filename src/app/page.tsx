import { EmailCapture } from '@/components/email-capture'

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'MATLABtoPython',
  description:
    'Deterministic MATLAB to Python converter. Rule-based, no AI, toolbox-aware. Flags ambiguous constructs instead of silently producing wrong output.',
  url: 'https://mtopython.com',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Individual Pro', price: '19.99', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Migration Pass', price: '49', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Team', price: '79', priceCurrency: 'USD' },
  ],
  featureList: [
    '10 MATLAB toolboxes mapped',
    'Deterministic output',
    'Toolbox-aware function substitution',
    'File upload and batch conversion',
    'Compatibility report with honest flags',
    'Runtime compatibility package on PyPI',
  ],
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      {/* Hero */}
      <section className="pt-20 pb-16">
        <div className="max-w-3xl">
          <h1 className="font-[family-name:var(--font-syne)] text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-4">
            Your MATLAB code runs the research.
            <br />
            <span className="text-purple-600">Now modernize it.</span>
          </h1>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl">
            Deterministic MATLAB to Python converter. No AI hallucinations.
            Toolbox-aware. Flags what it can&apos;t convert instead of guessing wrong.
            Same input, same output, every time.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="/convert"
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-500 transition-colors"
            >
              Start converting
            </a>
            <a
              href="#how-it-works"
              className="px-6 py-3 text-slate-600 hover:text-slate-900 transition-colors"
            >
              See example output
            </a>
          </div>
        </div>
      </section>

      {/* Why now */}
      <section className="py-16 border-t border-gray-200">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-slate-900 mb-6">
          The forcing function
        </h2>
        <div className="grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="text-amber-600 font-[family-name:var(--font-jetbrains)] text-2xl font-bold mb-2">$2,000+</div>
            <div className="text-slate-600">
              Per seat, per year. MathWorks ended perpetual licenses in January 2026.
              Every MATLAB seat is now a recurring cost.
            </div>
          </div>
          <div>
            <div className="text-amber-600 font-[family-name:var(--font-jetbrains)] text-2xl font-bold mb-2">$0</div>
            <div className="text-slate-600">
              Python with NumPy, SciPy, and matplotlib. The same computational
              power, no license fees, ever.
            </div>
          </div>
          <div>
            <div className="text-amber-600 font-[family-name:var(--font-jetbrains)] text-2xl font-bold mb-2">72%</div>
            <div className="text-slate-600">
              Of real-world MATLAB scripts compile to valid Python first try.
              Higher on shorter code. The rest gets flagged — never silently broken.
            </div>
          </div>
        </div>
      </section>

      {/* What makes it different */}
      <section className="py-16 border-t border-gray-200">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-slate-900 mb-6">
          Not another AI wrapper
        </h2>
        <div className="grid md:grid-cols-2 gap-12 text-sm">
          <div>
            <h3 className="text-slate-900 font-medium mb-2">Deterministic engine</h3>
            <p className="text-slate-600">
              Every conversion is rule-based. No large language model in the loop.
              The same MATLAB input produces the exact same Python output every time
              you run it. Auditable, reproducible, trustworthy.
            </p>
          </div>
          <div>
            <h3 className="text-slate-900 font-medium mb-2">Toolbox aware</h3>
            <p className="text-slate-600">
              10 toolboxes mapped: Signal Processing, Statistics, Image Processing,
              Optimization, Control Systems, Deep Learning, Curve Fitting, Parallel
              Computing, Symbolic Math, and Database. Each detected and mapped to
              its SciPy, PyTorch, scikit-image, or SQLAlchemy equivalent with the
              right imports.
            </p>
          </div>
          <div>
            <h3 className="text-slate-900 font-medium mb-2">Flag, don&apos;t guess</h3>
            <p className="text-slate-600">
              When a construct can&apos;t be converted with 100% confidence, we flag it
              with a clear annotation instead of producing silently broken code.
              The compatibility report tells you exactly what to review.
            </p>
          </div>
          <div>
            <h3 className="text-slate-900 font-medium mb-2">Your code stays private</h3>
            <p className="text-slate-600">
              No code is sent to any external AI service. The conversion engine
              runs entirely on our server. Your proprietary algorithms, research
              code, and trade secrets stay private.
            </p>
          </div>
        </div>
      </section>

      {/* Toolbox coverage */}
      <section className="py-16 border-t border-gray-200">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-slate-900 mb-6">
          Toolbox coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {[
            { slug: 'signal-processing', name: 'Signal Processing', lib: 'scipy.signal' },
            { slug: 'statistics', name: 'Statistics', lib: 'scipy.stats' },
            { slug: 'image-processing', name: 'Image Processing', lib: 'scikit-image' },
            { slug: 'optimization', name: 'Optimization', lib: 'scipy.optimize' },
            { slug: 'control-systems', name: 'Control Systems', lib: 'python-control' },
            { slug: 'deep-learning', name: 'Deep Learning', lib: 'PyTorch / Keras' },
            { slug: 'curve-fitting', name: 'Curve Fitting', lib: 'scipy.optimize' },
            { slug: 'parallel-computing', name: 'Parallel Computing', lib: 'joblib / dask' },
            { slug: 'symbolic-math', name: 'Symbolic Math', lib: 'sympy' },
            { slug: 'database', name: 'Database', lib: 'SQLAlchemy' },
          ].map(tb => (
            <a
              key={tb.slug}
              href={`/toolboxes/${tb.slug}`}
              className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-white transition-colors"
            >
              <div className="text-slate-900 font-medium mb-1">{tb.name}</div>
              <div className="text-slate-500 text-xs font-[family-name:var(--font-jetbrains)]">{tb.lib}</div>
            </a>
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center mt-4">
          Each toolbox page shows every MATLAB function and its Python equivalent.
          <a href="/toolboxes" className="text-purple-600 hover:underline ml-1">See all →</a>
        </p>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-gray-200 text-center">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-slate-900 mb-4">
          Ready to migrate?
        </h2>
        <p className="text-slate-600 mb-6">
          Free for up to 50 lines. No account required.
        </p>
        <a
          href="/convert"
          className="inline-block px-8 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-500 transition-colors"
        >
          Start converting
        </a>
      </section>

      {/* Email capture */}
      <section className="py-16 border-t border-gray-200">
        <div className="max-w-xl mx-auto">
          <EmailCapture
            source="homepage-cta"
            headline="MATLAB-to-Python tips, once a week"
            sub="New toolbox mappings, migration gotchas, and release notes. No spam; one short email on Fridays."
          />
        </div>
      </section>

    </div>
  )
}
