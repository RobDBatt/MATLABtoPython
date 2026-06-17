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
    a: 'It maps functions from 10 common toolboxes — including Signal Processing (to scipy.signal), Statistics (scipy.stats), Image Processing (scikit-image), and Optimization (scipy.optimize) — and injects the correct Python imports automatically.',
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
      <section className="pt-20 pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3b1f6e] border border-[#7c3aed]/30 text-[#a78bfa] text-xs font-[family-name:var(--font-jetbrains)] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed] animate-pulse" />
            923 real-world scripts tested · 69.8% compile clean first try
          </div>
          <h1 className="font-[family-name:var(--font-syne)] text-4xl lg:text-5xl font-bold text-[#f0f0f8] leading-tight mb-3">
            MATLAB&nbsp;to&nbsp;Python Converter
          </h1>
          <p className="font-[family-name:var(--font-syne)] text-xl lg:text-2xl text-[#7c3aed] font-semibold mb-5">
            Your code runs the research — now get it off the lease.
          </p>
          <p className="text-lg text-[#9ba3c4] mb-8 max-w-2xl leading-relaxed">
            Deterministic MATLAB to Python conversion. No AI hallucinations — rule-based, toolbox-aware,
            auditable. Flags what it can&apos;t convert instead of guessing wrong.
            Same input, same output, every time.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <a
              href="/convert"
              className="px-6 py-3 bg-[#7c3aed] text-white font-medium rounded-lg hover:bg-[#6d28d9] transition-colors"
            >
              Convert my first file →
            </a>
            <a
              href="/examples"
              className="px-6 py-3 text-[#9ba3c4] border border-[#1e2547] rounded-lg hover:text-[#f0f0f8] hover:border-[#2d3561] transition-colors"
            >
              See example output
            </a>
          </div>
        </div>
      </section>

      {/* The forcing function — concrete numbers */}
      <section className="py-16 border-t border-[#1e2547]">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#f0f0f8] mb-8">
          The forcing function
        </h2>
        <div className="grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="text-[#f59e0b] font-[family-name:var(--font-jetbrains)] text-3xl font-bold mb-2 tracking-tight">
              $2,190+
            </div>
            <div className="text-[#9ba3c4] leading-relaxed">
              Per seat, per year — MathWorks ended perpetual licenses in January 2026.
              Every MATLAB installation is now a recurring cost that compounds.
            </div>
          </div>
          <div>
            <div className="text-[#f59e0b] font-[family-name:var(--font-jetbrains)] text-3xl font-bold mb-2 tracking-tight">
              $0
            </div>
            <div className="text-[#9ba3c4] leading-relaxed">
              Python with NumPy, SciPy, and matplotlib. The same computational
              power, no license fees, open source, runs everywhere.
            </div>
          </div>
          <div>
            <div className="text-[#f59e0b] font-[family-name:var(--font-jetbrains)] text-3xl font-bold mb-2 tracking-tight">
              69.8%
            </div>
            <div className="text-[#9ba3c4] leading-relaxed">
              Of real-world MATLAB scripts compile to valid, flag-free Python on
              the first conversion. Measured against 923 scripts from public research
              repos. The rest gets flagged — never silently broken.
            </div>
          </div>
        </div>
      </section>

      {/* What makes it different — lead with pain, show before/after */}
      <section className="py-16 border-t border-[#1e2547]">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#f0f0f8] mb-2">
          Not another AI wrapper
        </h2>
        <p className="text-[#9ba3c4] text-sm mb-8 max-w-xl">
          Every other converter pastes your proprietary code into a language model and hopes.
          This one doesn&apos;t.
        </p>
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 text-sm">
          <div className="border-l-2 border-[#7c3aed] pl-5">
            <h3 className="text-[#f0f0f8] font-medium mb-1.5">Deterministic engine</h3>
            <p className="text-[#9ba3c4] leading-relaxed">
              Rule-based, no LLM in the loop. Same MATLAB input produces the
              exact same Python output every time. Auditable, reproducible,
              testable — we run it against 923 real-world scripts on every release.
            </p>
          </div>
          <div className="border-l-2 border-[#7c3aed] pl-5">
            <h3 className="text-[#f0f0f8] font-medium mb-1.5">Toolbox-aware</h3>
            <p className="text-[#9ba3c4] leading-relaxed">
              10 toolboxes mapped: Signal Processing, Statistics, Image Processing,
              Optimization, Control Systems, Deep Learning, Curve Fitting, Parallel
              Computing, Symbolic Math, and Database. Each maps to the right
              SciPy, PyTorch, or scikit-image equivalent with correct imports.
            </p>
          </div>
          <div className="border-l-2 border-[#7c3aed] pl-5">
            <h3 className="text-[#f0f0f8] font-medium mb-1.5">Flag, don&apos;t guess</h3>
            <p className="text-[#9ba3c4] leading-relaxed">
              When a construct can&apos;t be converted with certainty — OOP patterns,
              eval(), ambiguous matrix multiply — it gets a clear <code className="text-[#a78bfa] text-xs"># TODO:</code> annotation
              instead of silently wrong code. The compatibility report tells you
              exactly what needs review.
            </p>
          </div>
          <div className="border-l-2 border-[#7c3aed] pl-5">
            <h3 className="text-[#f0f0f8] font-medium mb-1.5">Your code stays private</h3>
            <p className="text-[#9ba3c4] leading-relaxed">
              No code is sent to any external AI service. The engine runs entirely
              on our servers. Proprietary algorithms, research code, trade
              secrets — none of it leaves your conversion session.
            </p>
          </div>
        </div>
      </section>

      {/* Toolbox coverage grid */}
      <section className="py-16 border-t border-[#1e2547]">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#f0f0f8] mb-2">
          Toolbox coverage
        </h2>
        <p className="text-[#9ba3c4] text-sm mb-6">
          Each page maps every function. Not a best-effort list — an auditable lookup table.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
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
              className="p-3.5 bg-[#0e1228] border border-[#1e2547] rounded-lg hover:border-[#7c3aed]/50 hover:bg-[#151a35] transition-colors group"
            >
              <div className="text-[#f0f0f8] font-medium text-xs mb-1 group-hover:text-[#a78bfa] transition-colors">
                {tb.name}
              </div>
              <div className="text-[#4d5580] text-xs font-[family-name:var(--font-jetbrains)]">
                {tb.lib}
              </div>
            </a>
          ))}
        </div>
        <p className="text-xs text-[#4d5580] mt-4">
          <a href="/toolboxes" className="text-[#7c3aed] hover:text-[#a78bfa] transition-colors">
            See all toolbox pages →
          </a>
        </p>
      </section>

      {/* FAQ */}
      <section className="py-16 border-t border-[#1e2547]">
        <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#f0f0f8] mb-8">
          MATLAB to Python converter — FAQ
        </h2>
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 max-w-4xl">
          {faqs.map(f => (
            <div key={f.q}>
              <h3 className="text-[#f0f0f8] font-medium mb-1.5 text-[15px]">{f.q}</h3>
              <p className="text-[#9ba3c4] text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-[#1e2547]">
        <div className="max-w-xl">
          <h2 className="font-[family-name:var(--font-syne)] text-2xl font-semibold text-[#f0f0f8] mb-3">
            Ready to start?
          </h2>
          <p className="text-[#9ba3c4] mb-6 text-sm leading-relaxed">
            Free for up to 50 lines. No account required. Paste your MATLAB,
            get Python with a full compatibility report in under a second.
          </p>
          <a
            href="/convert"
            className="inline-block px-8 py-3 bg-[#7c3aed] text-white font-medium rounded-lg hover:bg-[#6d28d9] transition-colors"
          >
            Convert my first file →
          </a>
        </div>
      </section>

      {/* Email capture */}
      <section className="py-16 border-t border-[#1e2547]">
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
