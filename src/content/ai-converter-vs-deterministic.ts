export const article = {
  slug: 'ai-converter-vs-deterministic',
  title: 'We Ran the Same MATLAB File Through an AI Converter and a Deterministic One. Here\'s What Happened.',
  description: 'A real head-to-head comparison: CodeConvert.ai silently dropped 30% of the code. Our deterministic converter kept everything and flagged what needed review.',
  publishedAt: '2026-04-13',
  keyword: 'matlab to python converter comparison',
  sections: [
    {
      heading: 'The test',
      body: `We took a real MATLAB file from GitHub — optimviz.m, an optimization visualization tool by Luigi Acerbi — and ran it through two converters. One is an AI-based tool (CodeConvert.ai, which uses a large language model). The other is our deterministic, rule-based converter at mtopython.com.

The file is 50 lines of real engineering code: function definitions, nargin checks, struct field access, anonymous functions, for/while loops, switch/case, plotting commands, and animated GIF creation. It is the kind of file an engineer pastes into a converter when they want working Python, not a toy example.

Here is what each tool produced.`,
    },
    {
      heading: 'What the AI converter produced',
      body: `CodeConvert.ai returned 39 lines of Python. Some of it was good:

It correctly converted the function signature to use Python default parameters: \`def optimviz(fun=None, x0=None, noise=0, MaxFunEvals=100)\`. That is a smart choice — using Python defaults instead of nargin checks.

It converted the struct to a Python dictionary with bracket access: \`table = {}\` and \`table['fun'] = fun\`. Also a reasonable approach.

It handled the for loop and while loop correctly.

But then it did something that should concern any engineer relying on converted code: **it silently dropped the entire second half of the file.**

The original MATLAB has plotting commands (figure, axis off), a switch/case block for grid layout, a loop that generates frames, and GIF creation with imwrite. CodeConvert.ai replaced all of this with a single comment:

\`# Plotting and other logic omitted as no direct translation was requested\`

That is 30% of the code, gone, with no indication of what was removed or why. If you ran this output, your optimization would compute correctly but never produce the visualization — which is the entire point of a tool called "optimviz."

The AI made a judgment call that the plotting code was not important. It was wrong.`,
    },
    {
      heading: 'What the deterministic converter produced',
      body: `Our converter returned 85 lines of Python — every line of the original MATLAB accounted for. The plotting commands converted to matplotlib (\`plt.figure()\`, \`plt.axis('off')\`). The switch/case converted to an if/elif chain with the switch variable preserved (\`if len(optims) == 1\`). The for loops, anonymous functions, and struct access all converted with deterministic rules.

It flagged 9 items for review:

The nargin checks were converted but flagged with guidance to use Python default parameters. The switch/case got a note about if/elif compatibility. A few MATLAB-specific runtime functions (rng, getframe, combvec) were left as-is with flags because they have no direct Python equivalent — they need manual replacement with specific libraries.

Nothing was silently dropped. Nothing was summarized. Every line of the original exists in the output, either converted or flagged.`,
    },
    {
      heading: 'The fundamental difference',
      body: `An AI converter decides what it thinks you want. A deterministic converter gives you what you asked for.

When CodeConvert.ai encounters code it cannot confidently translate — MATLAB plotting, switch/case with cell arrays, GIF frame capture — it makes a judgment call. Sometimes that call is to skip the code entirely. You have no way of knowing what was skipped without reading the original line by line and comparing.

A deterministic converter does not make judgment calls. It applies the same rules every time. If a construct has a known Python equivalent, it converts it. If it does not, it flags it with a specific explanation. The output is predictable, auditable, and complete.

This matters for three reasons:

**Reproducibility.** Run the same MATLAB file through our converter today and next month — you get identical output. Run it through an AI converter twice in a row and you may get different results. One version might include the plotting code. Another might drop it. You cannot build a reliable migration process on output that changes randomly.

**Auditability.** When an engineer reviews the converted code, they need to know what changed. Our compatibility report lists every flag with the line number and a specific explanation. An AI gives you a blob of Python with no changelog. You have to manually diff the input and output to find what was altered or removed.

**Trust.** The worst outcome in code conversion is not an error message — it is silently wrong code that appears to work. An AI that drops 30% of a file without telling you is more dangerous than a converter that flags 9 items for manual review. The flags are a feature, not a limitation.`,
    },
    {
      heading: 'Where the AI was better',
      body: `Honest comparison means acknowledging where the AI did better.

CodeConvert.ai handled the struct-to-dictionary conversion more idiomatically. It used \`table = {}\` with bracket access \`table['fun']\`, while our converter kept dot notation \`table.fun\` which works in Python for objects but not for plain dicts. The AI made a smarter architectural choice here.

It also used Python default parameters in the function signature directly, which is cleaner than our approach of converting nargin checks to None comparisons.

These are real advantages of AI-based conversion — it can make higher-level structural decisions that a rule-based converter cannot. The tradeoff is that those same judgment calls lead to dropped code, hallucinated function names, and non-deterministic output.

For a quick prototype or learning exercise, an AI converter can be useful. For migrating production code that needs to work correctly, a deterministic converter with clear flagging is the safer choice.`,
    },
    {
      heading: 'The numbers',
      body: `Here is the side-by-side comparison on the same 50-line MATLAB file:

**CodeConvert.ai (AI-based):**
39 lines of Python output. 30% of the original code silently dropped. No flags, no warnings, no indication of what was removed. Different output if you run it again tomorrow. Processing time: approximately 8 seconds.

**mtopython.com (deterministic):**
85 lines of Python output. 100% of the original code accounted for. 9 items flagged with specific review guidance. Identical output every time. Processing time: 35 milliseconds.

The AI produced cleaner code for the parts it kept. But it kept less than 70% of the file. For a tool whose purpose is visualization, the missing 30% — the part that actually draws the plots — is the part that matters most.`,
    },
    {
      heading: 'When to use which',
      body: `Use an AI converter when you want a rough starting point and plan to rewrite significant portions anyway. It can give you structural ideas and handle simple scripts well.

Use a deterministic converter when you need to migrate real code and need to know exactly what was converted, what needs review, and what was left untouched. This is the case for most engineering teams migrating MATLAB codebases — they need complete, auditable output, not a best-effort summary.

The 9 flags in our output are not a failure. They are the converter being honest about what requires human judgment. An engineer who spends 5 minutes per flag has working Python in under an hour. An engineer who trusts the AI output discovers the missing plotting code when their colleague asks why the visualization tool no longer visualizes anything.`,
    },
    {
      heading: 'Try it yourself',
      body: `Paste any MATLAB file into our converter and see the full output with flags. Then paste the same file into CodeConvert.ai and compare. The free tier converts 50 lines — enough to see the difference on a real function.`,
    },
  ],
}
