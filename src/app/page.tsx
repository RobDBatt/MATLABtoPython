export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="pt-20 pb-16">
        <div className="max-w-3xl">
          <h1 className="font-[family-name:var(--font-syne)] text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Your MATLAB code runs the research.
            <br />
            <span className="text-purple-400">Now modernize it.</span>
          </h1>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl">
            Deterministic MATLAB to Python converter. No AI hallucinations.
            Toolbox-aware. Flags what it can&apos;t convert instead of guessing wrong.
            Same input, same output, every time.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="/convert"
              className="px-6 py-3 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-400 transition-colors"
            >
              Convert my first file
            </a>
            <a
              href="#how-it-works"
              className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
            >
              See example output
            </a>
          </div>
        </div>
      </section>

      {/* Why now */}
      <section className="py-16 border-t border-navy-800">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-white mb-6">
          The forcing function
        </h2>
        <div className="grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="text-gold-400 font-[family-name:var(--font-jetbrains)] text-2xl font-bold mb-2">$2,000+</div>
            <div className="text-slate-400">
              Per seat, per year. MathWorks ended perpetual licenses in January 2026.
              Every MATLAB seat is now a recurring cost.
            </div>
          </div>
          <div>
            <div className="text-gold-400 font-[family-name:var(--font-jetbrains)] text-2xl font-bold mb-2">$0</div>
            <div className="text-slate-400">
              Python with NumPy, SciPy, and matplotlib. The same computational
              power, no license fees, ever.
            </div>
          </div>
          <div>
            <div className="text-gold-400 font-[family-name:var(--font-jetbrains)] text-2xl font-bold mb-2">85%+</div>
            <div className="text-slate-400">
              Of MATLAB constructs convert cleanly with deterministic rules.
              The rest gets flagged for your review, never silently broken.
            </div>
          </div>
        </div>
      </section>

      {/* What makes it different */}
      <section className="py-16 border-t border-navy-800">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-white mb-6">
          Not another AI wrapper
        </h2>
        <div className="grid md:grid-cols-2 gap-12 text-sm">
          <div>
            <h3 className="text-white font-medium mb-2">Deterministic engine</h3>
            <p className="text-slate-400">
              Every conversion is rule-based. No large language model in the loop.
              The same MATLAB input produces the exact same Python output every time
              you run it. Auditable, reproducible, trustworthy.
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-2">Toolbox aware</h3>
            <p className="text-slate-400">
              Detects Signal Processing, Statistics, Image Processing, Optimization,
              and Control Systems toolbox functions. Maps them to their SciPy,
              scikit-image, and python-control equivalents with the right imports.
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-2">Flag, don&apos;t guess</h3>
            <p className="text-slate-400">
              When a construct can&apos;t be converted with 100% confidence, we flag it
              with a clear annotation instead of producing silently broken code.
              The compatibility report tells you exactly what to review.
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-2">Your code stays private</h3>
            <p className="text-slate-400">
              No code is sent to any external AI service. The conversion engine
              runs entirely on our server. Your proprietary algorithms, research
              code, and trade secrets stay private.
            </p>
          </div>
        </div>
      </section>

      {/* Toolbox coverage */}
      <section className="py-16 border-t border-navy-800">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-white mb-6">
          Toolbox coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {[
            { name: 'Signal Processing', lib: 'scipy.signal', count: 17 },
            { name: 'Statistics', lib: 'scipy.stats', count: 15 },
            { name: 'Image Processing', lib: 'scikit-image', count: 13 },
            { name: 'Optimization', lib: 'scipy.optimize', count: 8 },
            { name: 'Control Systems', lib: 'python-control', count: 13 },
          ].map(tb => (
            <div key={tb.name} className="p-4 bg-navy-900 border border-navy-800 rounded-lg">
              <div className="text-white font-medium mb-1">{tb.name}</div>
              <div className="text-slate-500 text-xs font-[family-name:var(--font-jetbrains)]">{tb.lib}</div>
              <div className="text-slate-500 text-xs mt-2">{tb.count} functions mapped</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-navy-800 text-center">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-white mb-4">
          Ready to migrate?
        </h2>
        <p className="text-slate-400 mb-6">
          Free for up to 50 lines. No account required.
        </p>
        <a
          href="/convert"
          className="inline-block px-8 py-3 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-400 transition-colors"
        >
          Start converting
        </a>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-navy-800 text-center text-xs text-slate-500">
        MATLABtoPython.com
      </footer>
    </div>
  )
}
