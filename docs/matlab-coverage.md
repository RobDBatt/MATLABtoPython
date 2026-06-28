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
| **0** | **Flag net (Root Cause E)** | The systemic gap: *nothing warns* on silent-wrong/crash output. Closing it makes every other gap safe-to-ship (TODO instead of garbage). | 🟡 Stage-5 pass |
| **1** | **`*` matmul vs elementwise** | Most common silent-wrong in linear-algebra code; needs shape awareness → **flag when ambiguous** | 🔴→flag |
| **2** | **Name-value pairs** (generic, not allowlist) | Cross-toolbox `SyntaxError`; today an unknown property stays positional and breaks ordering | 🟡 |
| **3** | **Function arg-reorder** (`interp1`, `regexprep`) | silent-wrong garbage; a registry `argReorder` field covers a whole class | 🟡 |
| **4** | **Command syntax** (`axis ij`, …) | recurring `SyntaxError`; `hold`/`grid` already handled, extend the set | 🟢 |
| **5** | **`rem`→`np.fmod`, `reshape order='F'`** | trivial registry fixes, both silent-wrong | 🟢 |

---

## Coverage matrix

### A. Syntax-level gaps (🟨 invalid Python)
| Construct | Example | Behavior | Fixability | Notes / approach |
|---|---|---|---|---|
| Name-value pairs — **PARTIAL** | `'FontSize',12`→`fontsize=12` ✓ but `'FontUnits','points'` stays positional | 🟨 | 🟡 | **allowlist-based today**: recognized props convert, unknown props stay positional → `positional-after-keyword` when one follows a converted kwarg (the eae-126 bucket). Fix: convert **all** trailing `'Name',value` pairs generically (snake_case the name) instead of by allowlist |
| Command syntax — **PARTIAL** | `hold on`/`grid on` handled ✓; `axis ij`, `disp hello` not | 🟨 | 🟢 | extend the command-form registry beyond the hold/grid set |
| Bracket horizontal concat | `[1:100 1:100]`, `[v1 v2]` | 🟨 | 🟡 | space-separated elements in `[...]` → `np.concatenate`/`column_stack`; distinguish from `[1 2 3]` literal |
| Bracket colon-range | `[0:(n-1)]` | 🟨 | 🟢 | **fix in flight (PR #18)** — `[a:b]`→`np.arange` |
| Cell-content splat | `f(c{:})` | 🟨 | 🟡 | `c{:}` in arg position → `*c` |
| One-line `for` body | `for i=1:n max(x); end` | 🟨 | — | **FIXED (PR #19)** |

### B. Semantic gaps (🟥 silent-wrong — the dangerous half)
| Construct | Example | Behavior | Fixability | Notes |
|---|---|---|---|---|
| `*` matmul vs elementwise | `A*B` (matmul) vs `A.*B` | 🟥 | 🔴→flag | numpy `*` always elementwise; needs operand-shape → flag when unknown |
| `rem` vs `mod` | `rem(-7,3)` | 🟥 | 🟢 | map `rem`→`np.fmod` (currently `np.remainder`, wrong sign) |
| `reshape` order | `reshape(v,2,3)` | 🟥 | 🟢 | MATLAB is column-major → add `order='F'` |
| Column iteration — **FIXED (known matrix)** | `for c = M` | 🟥 | 🔴→flag | known-matrix iterable → emits `for c in M.T:` (correct columns; no-op for 1-D) + an INDEX note. Unknown iterables left quiet (most are 1-D — avoids noise) |
| Function arg-reorder | `interp1(x,y,xi)`→`np.interp(xi,x,y)` | 🟥 | 🟡 | registry `argReorder` field; covers `interp1`, `regexprep`, … |
| `regexprep` escapes / `@`-in-string | `regexprep(s,'\s+','_')` | 🟥 | 🟡 | backslash mangling + `@`-handle detector firing inside string literals (tokenizer bug) |

### C. Container types
| Construct | Example | Behavior | Fixability | Notes |
|---|---|---|---|---|
| Cell-array literal | `{1,'two',[3 4]}` → list | 🟧 | 🟡 | currently `+`-joined → `TypeError`; emit a Python list |
| Struct *arrays* | `s(2).x = 1` | 🟧 | 🔴 | scalar struct→dict done; array-of-structs needs a different shape |

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

---

## Can these be checked / fixed? — yes, and how

There **is** a way to verify fixability for each — that's what the grades above
encode, and any candidate fix is checkable end-to-end with the existing harness:

1. **Reproduce** in `__tests__/_debug.test.ts` (smallest failing snippet).
2. **Grade**: registry/transform (🟢/🟡) vs needs-type-awareness (🔴, prefer a flag).
3. **Fix + regression test**; `tsc` + full unit suite must stay green.
4. **Re-run the 375-file batch** — syntax-clean rate is the fast signal; the
   **Octave numeric oracle** is the gate for the 🟥 silent-wrong class.

Roughly **half the gaps are 🟢/🟡** (registry or localized transform — `rem`,
`reshape order`, command syntax, cell-splat, arg-reorder, name-value pairs). A few
are **🔴** (matmul, column-iteration, struct-arrays) where the honest fix is to
**flag, not guess** — which is exactly why the flag net (Rank 0) is the unlock:
it converts the hard 🔴 cases from "silently wrong" into "clearly flagged".
