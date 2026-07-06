import { EmailCapture } from '@/components/email-capture'
import HeroCanvas from '@/components/hero-canvas'

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
    '8 MATLAB toolboxes auto-converted, 3 migration guides',
    'Deterministic output',
    'Toolbox-aware function substitution',
    'File upload and batch conversion',
    'Compatibility report with honest flags',
    'Runtime compatibility package on PyPI',
  ],
}

// Single source of truth for the FAQ: the visible copy below earns the
// body-keyword value, the JSON-LD (built from the same array) earns the rich
// snippet. Questions are drawn from the GSC query list + buyer objections.
const faqs = [
  {
    q: 'How do I convert MATLAB code to Python?',
    a: 'Paste your MATLAB into the converter and it returns runnable Python (NumPy/SciPy) instantly. The engine is rule-based and deterministic — it maps MATLAB syntax, indexing, and toolbox functions to their Python equivalents and flags anything it can’t translate, rather than guessing.',
  },
  {
    q: 'Does this MATLAB to Python converter use AI?',
    a: 'No. It is a deterministic, rule-based converter: the same MATLAB input always produces the same Python output. Unlike generic AI translators, it never hallucinates code — when a construct is ambiguous or unsupported, it flags it for review instead of producing silently wrong output.',
  },
  {
    q: 'Is the MATLAB to Python converter free?',
    a: 'Yes — you can convert up to 50 lines free, no signup. Paid plans add file upload, batch conversion, and larger limits.',
  },
  {
    q: 'Which MATLAB toolboxes does it support?',
    a: 'It auto-converts functions from eight toolboxes — including Signal Processing (to scipy.signal), Statistics (scipy.stats), Image Processing (scikit-image), Optimization (scipy.optimize), and Wavelets (PyWavelets) — injecting the correct Python imports for you. Three more (Deep Learning, Parallel Computing, Database) have no faithful 1:1 mapping, so the converter flags them and links to a hand-migration guide instead of guessing.',
  },
  {
    q: 'Does it convert MATLAB to NumPy and SciPy?',
    a: 'Yes. Matrix operations, indexing, and math map to NumPy; toolbox functions map to SciPy and other standard libraries, with imports added for you.',
  },
  {
    q: 'Is my MATLAB code uploaded or stored?',
    a: 'Conversion runs server-side and your source is not retained. Determinism means the tool is auditable — you can re-run the same input and get the same, reviewable output.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[#2a2e3a] pt-20 pb-16 min-h-[460px] flex items-center">
        <HeroCanvas />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#15171d] via-[#15171d]/85 to-transparent"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-5 bottom-5 font-[family-name:var(--font-jetbrains)] text-[11px] text-[#e8935f]/60"
        >
          .m
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-5 bottom-5 font-[family-name:var(--font-jetbrains)] text-[11px] text-[#8a97ad]/60"
        >
          .py
        </span>

        <div className="relative z-10 max-w-3xl px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3a2415] border border-[#d9662b]/30 text-[#e8935f] text-xs font-[family-name:var(--font-jetbrains)] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d9662b] animate-pulse" />
            923 real-world scripts tested · 69.8% compile clean first try
          </div>
          <h1 className="font-[family-name:var(--font-syne)] text-4xl lg:text-5xl font-bold text-[#eef0f4] leading-tight mb-3">
            MATLAB&nbsp;to&nbsp;Python Converter
          </h1>
          <p className="font-[family-name:var(--font-syne)] text-xl lg:text-2xl text-[#d9662b] font-semibold mb-5">
            Your code runs the research — now get it off the lease.
          </p>
          <p className="text-lg text-[#9aa1ac] mb-8 max-w-2xl leading-relaxed">
            Deterministic MATLAB to Python conversion. No AI hallucinations — rule-based, toolbox-aware,
            auditable. Flags what it can&apos;t convert instead of guessing wrong.
            Same input, same output, every time.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <a
              href="/convert"
              className="px-6 py-3 bg-[#d9662b] text-white font-medium rounded-lg hover:bg-[#b8541f] transition-colors"
            >
              Convert my first file →
            </a>
            <a
              href="/examples"
              className="px-6 py-3 text-[#9aa1ac] border border-[#2a2e3a] rounded-lg hover:text-[#eef0f4] hover:border-[#3a3f4d] transition-colors"
            >
              See example output
            </a>
          </div>
        </div>
      </section>

      {/* The forcing function — concrete numbers */}
      <section className="py-16 border-t border-[#2a2e3a]">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#eef0f4] mb-8">
          The forcing function
        </h2>
        <div className="grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="text-[#8a97ad] font-[family-name:var(--font-jetbrains)] text-3xl font-bold mb-2 tracking-tight">
              $860+
            </div>
            <div className="text-[#9aa1ac] leading-relaxed">
              Per seat, per year — a commercial MATLAB subscription before toolboxes,
              each of which adds hundreds more. A recurring cost that compounds.
            </div>
          </div>
          <div>
            <div className="text-[#8a97ad] font-[family-name:var(--font-jetbrains)] text-3xl font-bold mb-2 tracking-tight">
              $0
            </div>
            <div className="text-[#9aa1ac] leading-relaxed">
              Python with NumPy, SciPy, and matplotlib. The same computational
              power, no license fees, open source, runs everywhere.
            </div>
          </div>
          <div>
            <div className="text-[#8a97ad] font-[family-name:var(--font-jetbrains)] text-3xl font-bold mb-2 tracking-tight">
              69.8%
            </div>
            <div className="text-[#9aa1ac] leading-relaxed">
              Of real-world MATLAB scripts compile to valid, flag-free Python on
              the first conversion. Measured against 923 scripts from public research
              repos. The rest gets flagged — never silently broken.
            </div>
          </div>
        </div>
      </section>

      {/* What makes it different — lead with pain, show before/after */}
      <section className="py-16 border-t border-[#2a2e3a]">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#eef0f4] mb-2">
          Not another AI wrapper
        </h2>
        <p className="text-[#9aa1ac] text-sm mb-8 max-w-xl">
          Every other converter pastes your proprietary code into a language model and hopes.
          This one doesn&apos;t.
        </p>
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 text-sm">
          <div className="border-l-2 border-[#d9662b] pl-5">
            <h3 className="text-[#eef0f4] font-medium mb-1.5">Deterministic engine</h3>
            <p className="text-[#9aa1ac] leading-relaxed">
              Rule-based, no LLM in the loop. Same MATLAB input produces the
              exact same Python output every time. Auditable, reproducible,
              testable — we test it against 923 real-world scripts.
            </p>
          </div>
          <div className="border-l-2 border-[#d9662b] pl-5">
            <h3 className="text-[#eef0f4] font-medium mb-1.5">Toolbox-aware</h3>
            <p className="text-[#9aa1ac] leading-relaxed">
              Eight toolboxes are auto-converted — Signal Processing, Statistics,
              Image Processing, Optimization, Control Systems, Symbolic Math, Curve
              Fitting, and Wavelets — each mapped to the right SciPy, scikit-image,
              or python-control equivalent with imports added. Deep Learning, Parallel
              Computing, and Database ship as hand-migration guides, where no
              faithful 1:1 mapping exists.
            </p>
          </div>
          <div className="border-l-2 border-[#d9662b] pl-5">
            <h3 className="text-[#eef0f4] font-medium mb-1.5">Flag, don&apos;t guess</h3>
            <p className="text-[#9aa1ac] leading-relaxed">
              When a construct can&apos;t be converted with certainty — OOP patterns,
              eval(), ambiguous matrix multiply — it gets a clear <code className="text-[#e8935f] text-xs"># TODO:</code> annotation
              instead of silently wrong code. The compatibility report tells you
              exactly what needs review.
            </p>
          </div>
          <div className="border-l-2 border-[#d9662b] pl-5">
            <h3 className="text-[#eef0f4] font-medium mb-1.5">Your code stays private</h3>
            <p className="text-[#9aa1ac] leading-relaxed">
              No code is sent to any external AI service. The engine runs entirely
              on our servers. Proprietary algorithms, research code, trade
              secrets — none of it leaves your conversion session.
            </p>
          </div>
        </div>
      </section>

      {/* Toolbox coverage grid */}
      <section className="py-16 border-t border-[#2a2e3a]">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#eef0f4] mb-2">
          Toolbox coverage
        </h2>
        <p className="text-[#9aa1ac] text-sm mb-6">
          Each page maps the most-used functions to their Python equivalents.
          <span className="text-[#34d399]"> Auto-converted</span> toolboxes are transformed by the
          engine;<span className="text-[#fbbf24]"> migration-guide</span> toolboxes have no 1:1 mapping,
          so the converter flags them instead of guessing.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          {[
            { slug: 'signal-processing', name: 'Signal Processing', lib: 'scipy.signal', auto: true },
            { slug: 'statistics', name: 'Statistics', lib: 'scipy.stats', auto: true },
            { slug: 'image-processing', name: 'Image Processing', lib: 'scikit-image', auto: true },
            { slug: 'optimization', name: 'Optimization', lib: 'scipy.optimize', auto: true },
            { slug: 'control-systems', name: 'Control Systems', lib: 'python-control', auto: true },
            { slug: 'deep-learning', name: 'Deep Learning', lib: 'PyTorch / Keras', auto: false },
            { slug: 'curve-fitting', name: 'Curve Fitting', lib: 'scipy.optimize', auto: true },
            { slug: 'wavelet', name: 'Wavelet', lib: 'pywt', auto: true },
            { slug: 'parallel-computing', name: 'Parallel Computing', lib: 'joblib / dask', auto: false },
            { slug: 'symbolic-math', name: 'Symbolic Math', lib: 'sympy', auto: true },
            { slug: 'database', name: 'Database', lib: 'SQLAlchemy', auto: false },
          ].map(tb => (
            <a
              key={tb.slug}
              href={`/toolboxes/${tb.slug}`}
              className="p-3.5 bg-[#1b1e26] border border-[#2a2e3a] rounded-lg hover:border-[#d9662b]/50 hover:bg-[#232733] transition-colors group"
            >
              <div className="flex items-start justify-between gap-1.5 mb-1">
                <div className="text-[#eef0f4] font-medium text-xs group-hover:text-[#e8935f] transition-colors">
                  {tb.name}
                </div>
                <span
                  title={tb.auto ? 'Auto-converted by the engine' : 'Migration guide — flagged, not auto-converted'}
                  className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${tb.auto ? 'bg-[#34d399]' : 'bg-[#fbbf24]'}`}
                />
              </div>
              <div className="text-[#5a5f6b] text-xs font-[family-name:var(--font-jetbrains)]">
                {tb.lib}
              </div>
            </a>
          ))}
        </div>
        <p className="text-[10px] text-[#5a5f6b] mt-3 flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" /> Auto-converted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" /> Migration guide
          </span>
        </p>
        <p className="text-xs text-[#5a5f6b] mt-4">
          <a href="/toolboxes" className="text-[#d9662b] hover:text-[#e8935f] transition-colors">
            See all toolbox pages →
          </a>
        </p>
      </section>

      {/* FAQ */}
      <section className="py-16 border-t border-[#2a2e3a]">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#eef0f4] mb-8">
          MATLAB to Python converter — FAQ
        </h2>
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 max-w-4xl">
          {faqs.map(f => (
            <div key={f.q}>
              <h3 className="text-[#eef0f4] font-medium mb-1.5 text-[15px]">{f.q}</h3>
              <p className="text-[#9aa1ac] text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-[#2a2e3a]">
        <div className="max-w-xl">
          <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#eef0f4] mb-3">
            Ready to start?
          </h2>
          <p className="text-[#9aa1ac] mb-6 text-sm leading-relaxed">
            Free for up to 50 lines. No account required. Paste your MATLAB,
            get Python with a full compatibility report in under a second.
          </p>
          <a
            href="/convert"
            className="inline-block px-8 py-3 bg-[#d9662b] text-white font-medium rounded-lg hover:bg-[#b8541f] transition-colors"
          >
            Convert my first file →
          </a>
        </div>
      </section>

      {/* Email capture */}
      <section className="py-16 border-t border-[#2a2e3a]">
        <div className="max-w-xl">
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
