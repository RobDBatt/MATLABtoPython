import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Anonymous usage telemetry — MATLABtoPython',
  description:
    'What the optional "help improve coverage" toggle shares, and what it never does. No source code is ever stored.',
  robots: { index: false },
}

export default function TelemetryPrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[#cbd5e1]">
      <h1 className="text-2xl font-semibold text-[#f0f0f8]">Anonymous usage telemetry</h1>
      <p className="mt-4 text-sm leading-relaxed text-[#9ba3c4]">
        The converter has an optional toggle: <em>&ldquo;Help improve coverage by sharing
        which MATLAB functions and toolboxes your code uses.&rdquo;</em> This page explains
        exactly what that does. It is off for signed-in users by default and on for
        anonymous visitors; you can change it any time, and the choice is remembered
        on your device.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-[#f0f0f8]">What is shared</h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#9ba3c4]">
        <li>
          The <strong>names of recognized MATLAB functions and toolboxes</strong> your
          code uses (for example <code className="text-[#a78bfa]">fft</code>,{' '}
          <code className="text-[#a78bfa]">butter</code>, Signal Processing) — only words
          already in our converter&rsquo;s known vocabulary.
        </li>
        <li>
          A count of the <strong>flag categories</strong> the conversion produced
          (converted-with-warning, index offset, toolbox, manual-TODO, unsupported).
        </li>
        <li>A coarse size bucket (e.g. &ldquo;101&ndash;500 lines&rdquo;) and the mode (paste / upload / batch).</li>
        <li>
          A random, anonymous session id that rotates every month — enough to group a
          single visit, never to identify you.
        </li>
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-[#f0f0f8]">What is never shared</h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#9ba3c4]">
        <li>
          <strong>Your source code.</strong> It is never transmitted or stored for
          telemetry. Only known vocabulary words are recorded — anything we don&rsquo;t
          already recognize, including the names of unsupported functions and your own
          variable names, is dropped before anything is written.
        </li>
        <li>Your name, email, IP address, or any account identifier.</li>
        <li>Raw line counts, file names, or comments.</li>
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-[#f0f0f8]">Why we ask</h2>
      <p className="mt-3 text-sm leading-relaxed text-[#9ba3c4]">
        It tells us which MATLAB features real users actually paste, so we prioritize
        converter coverage by evidence instead of guesswork. Raw events are retained for
        90 days; only aggregate counts are kept after that.
      </p>

      <p className="mt-10 text-sm">
        <Link href="/convert" className="text-[#7c3aed] underline underline-offset-2 hover:text-[#a78bfa]">
          ← Back to the converter
        </Link>
      </p>
    </main>
  )
}
