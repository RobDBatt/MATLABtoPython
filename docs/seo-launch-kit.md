# SEO + launch kit — mtopython.com

Goal: move the head queries (`matlab to python converter`, `matlab to python`)
from avg position ~22 (page 2–3, ~0% clicks) toward page 1. GSC confirms Google
already serves the site for the right terms — the gap is **rank**, driven by
on-page signals + authority, not the engine.

---

## PART A — On-page SEO rewrite (paste-ready)

### A1. The single biggest win: the H1

The homepage H1 is currently a pun and contains **none** of the target keyword:

```
Your MATLAB code runs the research. Now get it off the lease.
```

H1 is the strongest on-page ranking signal. Make it the exact query, and demote
the clever line to a tagline (keeps the brand voice, loses no personality).

In `src/app/page.tsx`, replace the `<h1>` block:

```tsx
<h1 className="font-[family-name:var(--font-syne)] text-4xl lg:text-5xl font-bold text-[#f0f0f8] leading-tight mb-3">
  MATLAB&nbsp;to&nbsp;Python Converter
</h1>
<p className="font-[family-name:var(--font-syne)] text-xl lg:text-2xl text-[#7c3aed] font-semibold mb-4">
  Your code runs the research — now get it off the lease.
</p>
```

### A2. Title tag

In `src/app/layout.tsx`, change the default title to lead with the exact query:

```ts
title: {
  default: "MATLAB to Python Converter — Deterministic, No AI Guessing",
  template: "%s | MATLABtoPython",
},
```
(~57 chars; leads with the query, adds the differentiator.)

### A3. Meta description (~155 chars)

```ts
description:
  "Convert MATLAB to Python instantly with a deterministic, toolbox-aware converter — not generic AI. Same input, same output, with honest flags. Free for 50 lines.",
```

### A4. Intro paragraph

Keep it, but make sure the first sentence contains "MATLAB to Python" and the
differentiator (it mostly does). Current copy is good; just ensure the phrase
"MATLAB to Python converter" appears verbatim once in the body near the top.

### A5. Add an FAQ section + FAQPage schema (new, high-value)

FAQ content adds keyword-rich body text targeting the long-tail GSC queries AND
can win a rich snippet. Add this section to the homepage (below the hero), and
the matching JSON-LD. Questions are built from the actual GSC query list +
buyer objections (especially "does it use AI" — your wedge vs CodeConvert/ChatGPT).

JSON-LD (add alongside the existing `homeJsonLd` script in `page.tsx`):

```ts
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I convert MATLAB code to Python?",
      acceptedAnswer: { "@type": "Answer", text:
        "Paste your MATLAB into the converter and it returns runnable Python (NumPy/SciPy) instantly. The engine is rule-based and deterministic — it maps MATLAB syntax, indexing, and toolbox functions to their Python equivalents and flags anything it can't translate, rather than guessing." },
    },
    {
      "@type": "Question",
      name: "Does this MATLAB to Python converter use AI?",
      acceptedAnswer: { "@type": "Answer", text:
        "No. It is a deterministic, rule-based converter: the same MATLAB input always produces the same Python output. Unlike generic AI translators, it never hallucinates code — when a construct is ambiguous or unsupported, it flags it for review instead of producing silently wrong output." },
    },
    {
      "@type": "Question",
      name: "Is the MATLAB to Python converter free?",
      acceptedAnswer: { "@type": "Answer", text:
        "Yes — you can convert up to 50 lines free, no signup. Paid plans add file upload, batch conversion, and larger limits." },
    },
    {
      "@type": "Question",
      name: "Which MATLAB toolboxes does it support?",
      acceptedAnswer: { "@type": "Answer", text:
        "It maps functions from 10 common toolboxes — including Signal Processing (to scipy.signal), Statistics (scipy.stats), Image Processing (scikit-image), and Optimization (scipy.optimize) — and injects the correct Python imports automatically." },
    },
    {
      "@type": "Question",
      name: "Does it convert MATLAB to NumPy and SciPy?",
      acceptedAnswer: { "@type": "Answer", text:
        "Yes. Matrix operations, indexing, and math map to NumPy; toolbox functions map to SciPy and other standard libraries, with imports added for you." },
    },
    {
      "@type": "Question",
      name: "Is my MATLAB code uploaded or stored?",
      acceptedAnswer: { "@type": "Answer", text:
        "Conversion runs server-side and your source is not retained. Determinism means the tool is auditable — you can re-run the same input and get the same, reviewable output." },
    },
  ],
};
```
Render it the same way as `homeJsonLd` (a second `<script type="application/ld+json">`),
and add a visible FAQ section on the page using the same Q&A text (the visible
copy is what earns the body-keyword value; the JSON-LD earns the rich snippet).

### A6. Quick technical checks
- Confirm the homepage `<title>` and `<h1>` differ from `/convert` (avoid dupes).
- Make sure `/` and `/convert` are both in the sitemap and indexed (GSC → Pages).
- Keep the real credibility numbers (e.g. "X real-world scripts tested") — honest
  metrics help conversion and are link-worthy.

**Expected impact:** on-page changes to a page already ranking at ~22 commonly
move it several positions within 1–3 weeks of re-crawl. It won't crack the top 3
alone (that needs links — Part B), but it should start earning real clicks.

---

## PART B — Launch posts (the authority lever)

Positioning everywhere: **the MATLAB *specialist*, deterministic converter — not
a generic AI translator.** That's the one thing no page-1 competitor
(CodeConvert, CodingFleet, ChatGPT) claims.

### B1. Show HN

**Title:**
`Show HN: A deterministic MATLAB→Python converter (no AI, no hallucinations)`

**Body:**

> I built a MATLAB→Python converter that's deliberately *not* AI-based. Every
> other tool (and ChatGPT) translates by guessing; the problem is you can't
> trust the output — it changes between runs and fails silently on the lines
> that matter.
>
> This one is a rule-based pipeline: tokenize → structure → transform →
> index-shift (MATLAB is 1-based, NumPy 0-based) → cleanup. Same input always
> produces the same Python. When it hits something it can't safely convert, it
> emits a flagged comment instead of inventing code. It maps 10 toolboxes to
> their SciPy/scikit-image/etc. equivalents and injects the imports.
>
> The part I found most interesting to build: testing it honestly. "Does it
> compile" is a useless bar — most converters pass that and still crash at
> runtime. So I added an execution oracle that converts a corpus of real .m
> files, actually *runs* the Python against NumPy/SciPy, and buckets the
> failures by error class. That turned quality from a guess into a number, and
> it gates CI — a change can't merge if it drops the runnable rate.
>
> Free for 50 lines, no signup: https://mtopython.com
>
> It's not magic — it won't convert Simulink, GUIs, or deeply OOP code, and
> it tells you so. Genuinely interested in failure cases: paste something
> gnarly and tell me where it breaks.

Notes: post Tue–Thu ~8–10am ET. Reply fast to every comment. HN rewards honesty
about limitations and the "here's the hard engineering part" angle (the oracle).

### B2. r/MATLAB (and/or r/Python)

**Read the subreddit rules first** — r/MATLAB allows tool shares but hates
drive-by ads. Lead with usefulness, disclose it's yours, ask for feedback.

**Title:**
`I built a free, deterministic MATLAB→Python converter — looking for test cases that break it`

**Body:**

> Like a lot of people here, I've watched MATLAB license costs climb and wanted
> a reliable way to get code into Python without rewriting it by hand or trusting
> ChatGPT to not quietly change the math.
>
> So I built a converter that's rule-based and deterministic — same input, same
> output, every time. It handles the annoying stuff (1-based→0-based indexing,
> `end`, matrix literals, `(:)`, common toolbox functions → SciPy/NumPy) and,
> importantly, *flags* what it can't convert instead of guessing. No AI in the
> conversion path.
>
> Free for 50 lines, no signup: https://mtopython.com
>
> Full disclosure, it's mine. It won't do Simulink/GUIs and there are edge cases
> in heavy OOP/cell code. I'm specifically looking for MATLAB snippets that
> produce wrong or broken Python — if you paste something it mangles, that's
> exactly the feedback that makes it better. What would you throw at it?

Notes: every "it broke on X" reply is gold — it feeds the corpus/telemetry loop
you already built. Engage genuinely; don't repost the link in every comment.

### B3. Other low-effort link sources (after the above)
- A short `dev.to` / personal-blog post: "Why I made my MATLAB→Python converter
  deterministic instead of AI" (links home, ranks long-tail, link-worthy).
- The GitHub repos ranking on page 1 (smop, matlab2python) — a genuinely useful
  comparison/cheat-sheet page that references them can earn mentions.
- Outreach to any "best MATLAB to Python tools" listicles (ask to be added).

---

## Measurement
The telemetry (`site='matlab'`) already logs real conversions. After the on-page
push + a launch, watch: (1) GSC impressions/clicks/position for the head queries,
(2) telemetry events from non-you sessions. That tells you whether traffic is
arriving AND whether the funnel converts — the two unknowns we couldn't answer
before.
