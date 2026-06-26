export const article = {
  slug: 'matlab-findpeaks-python',
  title: 'MATLAB findpeaks to Python: scipy.signal.find_peaks',
  description:
    'Convert MATLAB findpeaks to Python with scipy.signal.find_peaks. Maps MinPeakHeight, MinPeakDistance, and prominence, plus the 0-based location gotcha and when results differ from MATLAB.',
  publishedAt: '2026-06-26',
  keyword: 'matlab findpeaks python',
  sections: [
    {
      heading: 'The direct replacement: scipy.signal.find_peaks',
      body: `MATLAB's \`findpeaks\` lives in the Signal Processing Toolbox. The Python equivalent is \`scipy.signal.find_peaks\`, added in SciPy 1.1.0 — it finds local maxima by the same neighbor-comparison approach, so for well-separated peaks the two agree.

The one thing to internalize up front: **the two functions return different things.** MATLAB returns *values then locations*; SciPy returns *indices then a properties dict*.

\`\`\`matlab
% MATLAB
x = [0 2 0 4 0 6 0 3 0];
[pks, locs] = findpeaks(x);
% pks  = [2 4 6 3]   (peak values)
% locs = [2 4 6 8]   (1-based positions)
\`\`\`

\`\`\`python
# Python — scipy.signal.find_peaks
import numpy as np
import scipy.signal as signal

x = np.array([0, 2, 0, 4, 0, 6, 0, 3, 0])
locs = signal.find_peaks(x)[0]   # [1 3 5 7] — 0-based indices
pks = x[locs]                    # [2 4 6 3] — values
\`\`\`

\`find_peaks\` returns a tuple \`(peaks, properties)\`. The first element is an array of **0-based indices**, not the peak values — so you take \`x[locs]\` to get the values. That is exactly what a faithful conversion produces.`,
    },
    {
      heading: 'The locations are 0-based — the #1 gotcha',
      body: `MATLAB's \`locs\` are **1-based positions**; SciPy's are **0-based indices**. In the example above, MATLAB reports the peak at \`6\` as position \`6\`, while SciPy reports it as index \`5\`.

This matters only depending on how you *use* the result:

- **Indexing back into the signal** — \`pks = x(locs)\` → \`pks = x[locs]\` — is **correct as-is.** A 0-based index used to subscript a 0-based array gives the right value.
- **Reporting or plotting the position** — \`fprintf('peak at %d', locs(1))\` — is **off by one.** MATLAB prints \`2\`, Python prints \`1\` for the same peak.

If you need MATLAB's 1-based numbers (for a table, a label, or time alignment), add one: \`positions = locs + 1\`. If you are only slicing the array, leave them as they are.`,
    },
    {
      heading: 'Name/Value options become keyword arguments',
      body: `MATLAB's \`'Name', value\` pairs map cleanly to SciPy keyword arguments:

| MATLAB | scipy.signal.find_peaks |
|---|---|
| \`'MinPeakHeight', h\` | \`height=h\` |
| \`'MinPeakDistance', d\` | \`distance=d\` |
| \`'MinPeakProminence', p\` | \`prominence=p\` |
| \`'MinPeakWidth', w\` | \`width=w\` |
| \`'Threshold', t\` | \`threshold=t\` |

\`\`\`matlab
% MATLAB
[tall, tallLoc] = findpeaks(x, 'MinPeakHeight', 3, 'MinPeakDistance', 2);
\`\`\`

\`\`\`python
# Python
tallLoc = signal.find_peaks(x, height=3, distance=2)[0]
tall = x[tallLoc]
\`\`\`

One subtlety: \`distance\` in SciPy must be an integer **number of samples** ≥ 1. MATLAB's \`MinPeakDistance\` can be given in the signal's x-units when you pass an x vector — convert it to a sample count first if your spacing isn't 1.`,
    },
    {
      heading: 'Getting widths and prominences',
      body: `MATLAB returns extra outputs from the same call:

\`\`\`matlab
% MATLAB — [pks, locs, widths, proms]
[pks, locs, w, p] = findpeaks(x, 'Annotate', 'extents');
\`\`\`

In SciPy those live in the **properties dict** (the second return value), and you must *request* them by passing the matching keyword — otherwise they aren't computed:

\`\`\`python
# Python — widths/prominences come back in the properties dict
peaks, props = signal.find_peaks(x, prominence=0, width=0)
widths      = props['widths']
prominences = props['prominences']
left_bases  = props['left_bases']
right_bases = props['right_bases']
\`\`\`

Passing \`prominence=0\`/\`width=0\` means "no minimum, but compute the value for every peak." It's a common surprise that \`props['widths']\` is missing until you pass \`width=...\`.`,
    },
    {
      heading: 'When the results will not match MATLAB exactly',
      body: `For clean, well-separated peaks the two functions agree. They can diverge on dense or noisy signals — worth knowing before you trust a one-to-one port:

- **Distance tie-breaking.** Both remove smaller peaks within \`distance\`, but the order of elimination differs. MATLAB starts from the tallest peak; SciPy removes lowest-priority peaks iteratively. On clusters of similar-height peaks the surviving set can differ.
- **Width is measured differently by default.** MATLAB's width defaults to the half-prominence reference; SciPy's \`width\` is measured at \`rel_height=0.5\` of prominence too, but the interpolation at the edges can shift values slightly.
- **Endpoints.** Neither reports the first or last sample as a peak, so a monotonic ramp yields no peaks in both — good news for parity.

If exact MATLAB parity matters (e.g., reproducing a paper), filter the signal first and verify a handful of peaks by hand. For most migrations — detect peaks, grab their values — \`find_peaks\` is a drop-in.`,
    },
    {
      heading: 'Convert your findpeaks code automatically',
      body: `The examples above are exactly what the [MATLABtoPython converter](/convert) produces — it maps \`findpeaks\` to \`signal.find_peaks\`, rewrites the \`'Name', value\` options to keyword arguments, adds \`pks = x[locs]\` for the values, and flags the 0-based-location difference so you don't get caught by it.

Paste your MATLAB signal-processing code into the [converter](/convert) and get runnable, scipy-backed Python in seconds — \`fft\`, \`butter\`, \`filter\`, and \`findpeaks\` all map to their SciPy equivalents.`,
    },
  ],
}
