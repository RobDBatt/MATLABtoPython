# MATLAB → Python coverage matrix

A living "what we cover / what we don't" map for the deterministic converter,
plus a **fixability grade** for every gap so the fix queue is prioritised by
effort × impact rather than by whoever hit it last.

Sources: `REVIEW_PUNCHLIST.md` (the executed numeric-oracle review, Root Causes
A–F), `docs/converter-fix-queue.md` (per-bucket fix history), and an empirical
batch of **375 fresh real-world files** (spatialmath-matlab 103, lightspeed 101,
dpwiese/eae-126 44, + corpus) run through the converter and `ast.parse`-checked.

## How to read this

**Behavior if unfixed** — the worst part of a gap is *how* it fails:
- 🟥 **silent-wrong** — runs, no error, wrong answer. The dangerous class; only a
  numeric oracle (or a flag) catches it.
- 🟧 **crash** — `NameError`/`TypeError` at runtime. Loud, easy to spot.
- 🟨 **invalid Python** — `SyntaxError` at convert time. Loudest, cheapest to find.

**Fixability** — effort + risk + where it lives:
- 🟢 **easy** — a registry entry or a localized Stage-3 transform; low blast radius.
- 🟡 **medium** — a new transform / parser tweak with some ambiguity to handle.
- 🔴 **hard** — needs type/shape awareness the regex front-end doesn't have; the
  right move is usually to **flag** (emit `# TODO:`) rather than guess.

## Empirical health (375 fresh files, current `master`)
- Convert-crashes (converter threw): **0 / 375**.
- `ast.parse`-clean: spatialmath+lightspeed **89.4%**, eae-126 (aerodynamics) **82%**.
- The dominant syntax-fail buckets below are real and cross-toolbox.

---

## Priority queue (highest value first)

| Rank | Item | Why | Fixability |
|------|------|-----|------------|
| **0** | **Flag net (Root Cause E)** — ✅ **DONE** | The systemic gap: *nothing warns* on silent-wrong/crash output. Closing it makes every other gap safe-to-ship (TODO instead of garbage). | 🟡 Stage-5 pass |
| **1** | **`*` matmul vs elementwise** — ✅ **DONE** | Most common silent-wrong in linear-algebra code; flags ambiguous matrix×unknown; arguments-block params feed shape table | 🔴→flag |
| **2** | **Name-value pairs** (generic, not allowlist) — ✅ **DONE** | Cross-toolbox `SyntaxError`; unknown prop following a kwarg now promotes to a kwarg (anchored), `set(...)`→`plt.setp(...)` | 🟡 |
| **3** | **Function arg-reorder** (`interp1`, `regexprep`) — ✅ **DONE** | silent-wrong garbage; registry `argReorder` field + custom `regexprep` rewriter (reorder + raw-string pattern) | 🟡 |
| **4** | **Command syntax** — ✅ **DONE** | `box on/off`→`plt.box`, `shading`→note; `axis`/`disp`/`close`/`drawnow` already handled | 🟢 |
| **5** | **`rem`→`np.fmod`, `reshape order='F'`** — ✅ **DONE** | trivial registry fixes, both silent-wrong | 🟢 |

**The ranked queue is cleared.** Remaining work is the lower-priority tail in
the matrix below (bracket horizontal-concat, cell-content splat, cell-array
literals, struct-arrays) plus the deeper-inference frontier (inter-procedural
return-shape propagation).

---

## Coverage matrix

### A. Syntax-level gaps (🟨 invalid Python)
| Construct | Example | Behavior | Fixability | Notes / approach |
|---|---|---|---|---|
| Name-value pairs — **FIXED** | `'FontSize',12`→`fontsize=12`; `…,'FontUnits','points'` → `fontunits='points'` | 🟨 | 🟡 | allowlist maps known props; an **unknown** `'Name',value` pair anchored to a preceding `kwarg=` is now promoted to a lowercased kwarg (kills `positional-after-keyword`, the eae-126 bucket). A purely-positional call with no known prop is left alone (no invented kwargs → no new `TypeError`). `set(h,'Prop',v,…)` → `plt.setp(h, prop=v, …)` |
| Command syntax — **FIXED** | `axis ij`, `disp hello`, `box on`, `close all`, `drawnow`, `shading flat` | 🟨 | 🟢 | command-form registry covers the plot/figure command set; `box on/off`→`plt.box(True/False)`, `shading X`→commented note (it's a surface-call kwarg). `hold`/`grid`/`figure` handled by transformSpecialConstructs |
| Bracket horizontal concat — **PARTIAL** | `[1:100 1:100]`, `[v1 v2]`, `x([2:end 1], :)` | 🟨 | 🟡 | `[a b]`/`[1 2 3]` literals → comma-inserted; **range-vectors → `np.r_`** (value: `[2:N 1]`→`np.r_[2:N + 1, 1]`; index with proof (`end`/`:`-sibling): `x([2:end 1], :)`→`x[np.r_[1:len(x), 0], :]` — the circular-shift idiom, matGeom's #1 bucket). Still open: space-sep expression rows in append idioms, multi-line destructure continuations |
| Bracket colon-range | `[0:(n-1)]` | 🟨 | 🟢 | **fix in flight (PR #18)** — `[a:b]`→`np.arange` |
| Cell-content splat | `f(c{:})` | 🟨 | 🟡 | `c{:}` in arg position → `*c` |
| One-line `for` body | `for i=1:n max(x); end` | 🟨 | — | **FIXED (PR #19)** |

### B. Semantic gaps (🟥 silent-wrong — the dangerous half)
| Construct | Example | Behavior | Fixability | Notes |
|---|---|---|---|---|
| `*` matmul vs elementwise — **PARTIAL** | `A*B` (matmul) vs `A.*B` | 🟥 | 🔴→flag | both-known-matrix → rewritten to `@`; **`matrix * unknown` now flags** (shape-aware, ~6% of files); `unknown*unknown` left quiet (noise). Shape sources now include **`arguments`-block size specs** (`A (3,3) double` → matrix, `(1,1)` → scalar; vectors/`:`/symbolic stay unknown). Remaining: inter-procedural return-shape propagation |
| `rem` vs `mod` | `rem(-7,3)` | 🟥 | 🟢 | map `rem`→`np.fmod` (currently `np.remainder`, wrong sign) |
| `reshape` order | `reshape(v,2,3)` | 🟥 | 🟢 | MATLAB is column-major → add `order='F'` |
| Column iteration — **FIXED (known matrix)** | `for c = M` | 🟥 | 🔴→flag | known-matrix iterable → emits `for c in M.T:` (correct columns; no-op for 1-D) + an INDEX note. "Known matrix" now also covers params declared `(m,n) double` in an `arguments` block. Unknown iterables left quiet (most are 1-D — avoids noise) |
| Function arg-reorder — **FIXED** | `interp1(x,y,xi)`→`np.interp(xi,x,y)` | 🟥 | 🟡 | registry `argReorder: [2,0,1]` field (applied only at matching arity); a non-linear method arg is flagged. `regexprep(s,pat,rep)`→`re.sub(pat,rep,s)` via custom rewriter (reorder + raw-string pattern so `\s`/`\d` survive; `ignorecase`→`flags=re.IGNORECASE`) |

### C. Container types
| Construct | Example | Behavior | Fixability | Notes |
|---|---|---|---|---|
| Cell-array literal | `{1,'two',[3 4]}` → list | 🟧 | 🟡 | currently `+`-joined → `TypeError`; emit a Python list |
| Struct *arrays* | `s(2).x = 1` | 🟧 | 🔴 | scalar struct→dict done; array-of-structs needs a different shape |

### C2. Toolbox coverage (sweep of 2026-07)

~230 toolbox-function mappings across 13 areas. Policy: exact-signature
scipy/skimage/control/sympy/pywt matches map silently (plus the automatic
TOOLBOX review flag); known differences carry an explicit WARNING naming the
difference (arg order, return order, parameterization); functions with no
Python equivalent get a TODO with the replacement recipe; **Simulink and code
generation are ❌ UNSUPPORTED by nature** — `sim`/`set_param`/`codegen` operate
on `.slx` block diagrams / compiler toolchains, which have no textual Python
analog (the flag says to reimplement dynamics with `scipy.integrate.solve_ivp`
or use Numba/Cython workflows).

| Area | Highlights |
|---|---|
| Statistics | full `Xpdf/Xcdf/Xinv` distribution family via a generic rewriter with per-dist scale surgery (`gampdf(x,a,b)`→`stats.gamma.pdf(x,a,scale=b)`, `wbl` swaps shape/scale, `logn` exponentiates mu); `*rnd`→numpy.random; nan* family; pdist/linkage/kmeans2 |
| Signal | buttord/cheb1ord/besself/windows/medfilt/detrend exact; `fir1(n,…)`→`firwin(n+1,…)`; `dct`→`norm='ortho'`; `sgolayfilt` argReorder; `downsample(x,n)`→`x[::n]`; cpsd/mscohere flagged (swapped returns) |
| Image | skimage morphology/exposure/filters; `strel('disk',r)`→`morphology.disk(r)`; `imfill(bw,'holes')`→`binary_fill_holes`; `imbinarize`→inline otsu; graythresh flagged (normalized vs absolute) |
| Control | python-control 1:1 (lqr/place/ctrb/obsv/dcgain/poles/zeros); response functions flagged (TimeResponseData vs [y,t,x]) |
| Rotations | scipy `Rotation` templates (eul2rotm/rotm2eul exact ZYX; quaternion entries WARN about [w x y z]→[x y z w] order) |
| Symbolic | dsolve/collect/vpa(→sp.N)/taylor/fourier; ztrans flagged (no sympy equivalent) |
| Optimization | least_squares/lsq_linear/milp; ga/patternsearch/particleswarm flagged with nearest scipy analog |
| Financial | flagged with closed-form formulas (no numpy_financial dep by policy) |
| Wavelet / Audio | pywt swt/iswt + coeff recipes; soundfile info; playback flagged (sounddevice) |

### D. Unmapped functions (🟧 crash)
| Construct | Example | Behavior | Fixability | Notes |
|---|---|---|---|---|
| Higher-order / long tail | `arrayfun`, `cellfun`, `accumarray` | 🟧 | 🟢 flag / 🟡 map | at minimum emit `# TODO:` (Root Cause E); map where a clean numpy/scipy equivalent exists |

### E. Systemic — the flag net (Root Cause E) 🟥
The single highest-priority item. Across all 22 oracle probes, **not one `# TODO:`
fired** on wrong/crashing output. A Stage-5 pass should detect "this won't be
right" signals — a surviving `arr(...)` call on a known array, a cell-as-addition
expression, an ambiguous `*` on matrix operands, an unmapped bare call — and emit
a flag. Then a user never *unknowingly* ships wrong Python. 🟡 (a new Stage-5 pass).

### ✅ Recently moved to covered
- **Root Cause A — call-vs-index ambiguity** (A1 index double-correct, A2 expression
  subscript, A3 lambda call, A4 dict read): **FIXED (PR #17, symbol-kind tracking)**.
- One-line `for` bodies: **FIXED (PR #19)**.
- Bracket colon-range `[0:n-1]`: **in flight (PR #18)**.
- `*` matmul flag + column-iteration + `arguments`-block shape inference (PRs #23–#25).
- **Priority-queue Ranks 2–4** — name-value pairs (generic), function arg-reorder
  (`interp1`/`regexprep`), and command syntax (`box`/`shading`): **FIXED**.
- **Live-batch buckets** (2,824-file matGeom/OptimTraj/YALMIP run, 83.0%→86.3%):
  bracket range-vectors → `np.r_`; chained indexing `S{i}(a:b)` → `S[i-1][a-1:b]`;
  nested-paren index pairing (`pts(isfinite(pts(:,1)), :)`); comment-`...`
  continuation swallowing the next statement (the switch/`elif`-orphan bucket);
  inline-if bodies skipping literal cleanup.
- **Live2-batch buckets** (677-file voicebox/gramm/MATLABRobotics run,
  83.6%→92.6%; original batch 86.3%→86.8%): no-comma inline `if cond body; end`
  splitting; lambda-arg method calls no longer misread as multi-dim indexing
  (string args no longer shifted `- 1`); registry renames and paren→bracket
  swaps no longer fire inside string literals; `axis 'xy'` quote doubling +
  `plt.plt.` double-prefix; NV pairs with expression/bracket values; templates
  parenthesize compound args (`(x != 0).toarray()`); assigned variables shadow
  `xline`/`yline`; glued `||`→` or `; `hold all`; MATLAB `import`/`opengl`
  commented; Python-keyword lambda params renamed (`in`→`in_`); `;` inside
  cell braces is a row separator (`{'a' 'b'; 'c' 16}` → `[['a','b'],['c',16]]`).

---

## Can these be checked / fixed? — yes, and how

There **is** a way to verify fixability for each — that's what the grades above
encode, and any candidate fix is checkable end-to-end with the existing harness:

1. **Reproduce** in `__tests__/_debug.test.ts` (smallest failing snippet).
2. **Grade**: registry/transform (🟢/🟡) vs needs-type-awareness (🔴, prefer a flag).
3. **Fix + regression test**; `tsc` + full unit suite must stay green.
4. **Re-run the 375-file batch** — syntax-clean rate is the fast signal; the
   **Octave numeric oracle** is the gate for the 🟥 silent-wrong class.

### Numeric oracle status (2026-07)

Runs locally (`OCTAVE_BIN="<path to octave-cli>" npx tsx
scripts/octave_oracle.mts`, optionally `CORPUS_SAMPLE=N`) and weekly in CI
(`.github/workflows/octave-oracle.yml`, gate: zero silent-wrong on the curated
set + vacuous-pass protection). Current verdict: **0 silent-wrong across all
comparable inputs** — curated set 20/20 MATCH, corpus sample 22/22 MATCH.

- `rand`/`randn`/`randi`/`randperm` are replaced on BOTH sides by an identical
  minstd LCG (Octave shadow stubs / numpy monkeypatch, column-major fill), so
  random scripts are compared instead of skipped (was: 46 skips).
- The locked **0-based index contract** is verified explicitly: a returned-index
  var that differs from Octave by uniform −1 counts as a contract MATCH
  (`vc/03:ix`, `vc/20:locs`) — previously misreported as silent-wrong.
- Headless-graphics calls are stubbed on the Octave side; remaining OCTAVE_ERRs
  are bucketed by their `error:` line in the report. The dominant residual
  causes are MATLAB-only builtins Octave lacks (`histcounts`, `RandStream`) and
  MATLAB-only syntax Octave rejects — both environmental.
- **Multi-file conversion (bundles):** corpus scripts convert together with
  their sibling-function dependency closure (`src/lib/converter/bundle.ts` —
  `convertBundle(entry, files)` resolves calls by filename like the MATLAB
  path, shadows registry mappings with project files, and emits one
  self-contained Python file with a merged import block). The oracle runs
  Octave with `addpath(genpath(repo))` and Python on the bundle: 17 corpus
  inputs pull 80 sibling function files. PY_CRASH causes/files are bucketed in
  the report — those are the newly-VISIBLE converter frontier (previously
  hidden behind NameErrors).

Roughly **half the gaps are 🟢/🟡** (registry or localized transform — `rem`,
`reshape order`, command syntax, cell-splat, arg-reorder, name-value pairs). A few
are **🔴** (matmul, column-iteration, struct-arrays) where the honest fix is to
**flag, not guess** — which is exactly why the flag net (Rank 0) is the unlock:
it converts the hard 🔴 cases from "silently wrong" into "clearly flagged".
