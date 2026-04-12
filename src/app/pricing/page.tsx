import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free for 50 lines. Migration Pass for one-time projects. Pro and Team plans for ongoing work.',
}

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: 'Try the converter',
    features: [
      '50 lines per conversion',
      'Compatibility report',
      'Toolbox detection',
      'No account required',
    ],
    limits: ['No file upload', 'No batch conversion'],
    cta: 'Start converting',
    ctaHref: '/convert',
    highlight: false,
  },
  {
    name: 'Migration Pass',
    price: '$49',
    period: 'one-time / 30 days',
    description: 'For one-time migration projects',
    features: [
      '5,000 lines per conversion',
      'Single .m file upload',
      'Compatibility report',
      'Toolbox detection',
      '30 days of full access',
    ],
    limits: ['No batch conversion'],
    cta: 'Get Migration Pass',
    ctaHref: '/sign-up',
    highlight: false,
  },
  {
    name: 'Individual Pro',
    price: '$19.99',
    period: '/month',
    description: 'For researchers with ongoing work',
    features: [
      '5,000 lines per conversion',
      'Single .m file upload',
      'Compatibility report',
      'Toolbox detection',
      'Unlimited conversions',
    ],
    limits: ['No batch conversion'],
    cta: 'Start Pro',
    ctaHref: '/sign-up',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$79',
    period: '/month',
    description: 'For research groups and engineering teams',
    features: [
      '10,000 lines per conversion',
      'Batch folder upload',
      '100,000 lines/month',
      'Compatibility report',
      'Toolbox detection',
      'Up to 5 seats',
    ],
    limits: [],
    cta: 'Start Team',
    ctaHref: '/sign-up',
    highlight: false,
  },
]

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-white mb-3">
          Simple, honest pricing
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Free for small conversions. Pay only when you need more lines
          or file upload. No surprise fees.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col p-6 rounded-lg border ${
              tier.highlight
                ? 'border-purple-500/50 bg-navy-900'
                : 'border-navy-800 bg-navy-900/50'
            }`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-6 px-3 py-0.5 bg-purple-500 text-white text-xs font-medium rounded-full">
                Recommended
              </div>
            )}

            <div className="mb-4">
              <h2 className="text-white font-semibold text-lg">{tier.name}</h2>
              <p className="text-slate-500 text-sm mt-1">{tier.description}</p>
            </div>

            <div className="mb-6">
              <span className="text-3xl font-bold text-white">{tier.price}</span>
              {tier.period && (
                <span className="text-slate-500 text-sm ml-1">{tier.period}</span>
              )}
            </div>

            <ul className="space-y-2 mb-6 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-green-400 mt-0.5">+</span>
                  {f}
                </li>
              ))}
              {tier.limits.map((l) => (
                <li key={l} className="flex items-start gap-2 text-sm text-slate-500">
                  <span className="text-slate-600 mt-0.5">-</span>
                  {l}
                </li>
              ))}
            </ul>

            <a
              href={tier.ctaHref}
              className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tier.highlight
                  ? 'bg-purple-500 text-white hover:bg-purple-400'
                  : 'border border-navy-700 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {tier.cta}
            </a>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="mt-20 max-w-2xl mx-auto">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-semibold text-white mb-6 text-center">
          Common questions
        </h2>
        <div className="space-y-6 text-sm">
          <div>
            <h3 className="text-white font-medium mb-1">How are lines counted?</h3>
            <p className="text-slate-400">
              Only non-empty lines of MATLAB code are counted. Comments count as lines.
              Blank lines don&apos;t. A typical MATLAB function is 50-200 lines.
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">What happens when I hit the line limit?</h3>
            <p className="text-slate-400">
              The converter will tell you exactly how many lines your code has and
              which plan covers it. You can upgrade instantly without losing your work.
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Is my code sent to an AI service?</h3>
            <p className="text-slate-400">
              No. The converter is 100% deterministic and rule-based. Your code is
              processed entirely on our server and never sent to any third-party AI
              API. Same input, same output, every time.
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">What&apos;s the difference between Migration Pass and Pro?</h3>
            <p className="text-slate-400">
              Migration Pass is a one-time 30-day purchase for engineers doing a
              single migration project. Pro is a monthly subscription for researchers
              who regularly convert MATLAB scripts as part of ongoing work.
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Which toolboxes are supported?</h3>
            <p className="text-slate-400">
              Signal Processing (scipy.signal), Statistics (scipy.stats), Image Processing
              (scikit-image), Optimization (scipy.optimize), Control Systems (python-control),
              Symbolic Math (SymPy), Wavelets (PyWavelets), and Curve Fitting (scipy.interpolate).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
