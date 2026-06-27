# Symbol-kind tracking — plan to close Root Cause A

Status: **plan only.** Design for the next converter increment. Implementation
(the Stage-04 consumption) follows. This file exists so that work starts fast and
stays scoped.

## Why (the ceiling, measured)

The engine resolves MATLAB's `()` call-vs-index ambiguity with a **binary**
symbol table (`src/lib/converter/analysis/scope.ts`): every name is either a
`variable` or a `function`, and variables shadow functions (MATLAB's own rule).
That binary is enough for ~90% of real indexing and is why simple/2-D indexing,
`end`-arithmetic, and logical indexing are already correct (see REVIEW_PUNCHLIST
"Verified correct").

It is **not** enough for the cases in REVIEW_PUNCHLIST **Root Cause A**, because
"variable vs function" can't distinguish the *kind* of a variable:

| Bug | MATLAB | v2 emits | should be | missing knowledge |
|-----|--------|----------|-----------|-------------------|
| **A1** | `[mx,ix]=max(v); m=v(ix)` | `m = v[ix - 1]` (silent wrong) | `m = v[ix]` | `ix` is an **already-0-based index** (from `argmax`), not a 1-based subscript |
| **A2** | `first = v(idx(1))` | `v(idx[0])` → not callable | `v[idx[0]]` | `v` is an **array** but the subscript is an **expression**, not a simple var |
| **A3** | `f=@(x)...; y=f(3)` | `y = f[2]` → not subscriptable | `y = f(3)` | `f` is a **lambda**, not an array |
| **A4** | `m=containers.Map(); v=m('k')` | `v = m('k')` → not callable | `v = m['k']` | `m` is a **dict**; read side wasn't converted |

The punch-list states the fix directly: *"A proper fix needs **symbol-kind
tracking** (is this name a lambda / dict / numpy array / function?) plus handling
of nested/expression subscripts. Fixing this resolves A1–A4 together."*

This is **not** a ground-up rewrite (MATLAB's engine is at 69.6% clean / 80.5%
runtime / 90.5% numerically-correct on the comparable subset — a high floor,
unlike the sibling VBA engine that triggered a full v3 parser at ~14% USABLE). It
is a **targeted extension of the existing symbol-table pre-pass** plus a
type-aware Stage-04 consumer.

## What

Promote the binary symbol table to a **symbol-KIND** table, additively:

```ts
// analysis/scope.ts — extend SymbolTable, keep variables/functions for compat
export type SymbolKind =
  | 'array'      // zeros/ones/[..]/linspace/…, or used with size/length, or 2-D indexed
  | 'lambda'     // f = @(args) expr
  | 'dict'       // containers.Map(...)
  | 'index'      // a 0-based index produced by argmax/flatnonzero/… (A1)
  | 'scalar'     // numeric/char literal
  | 'function'   // registry / built-in / local function
  | 'unknown'    // can't determine → flag-don't-guess

export interface SymbolTable {
  variables: Set<string>           // unchanged (back-compat)
  functions: Set<string>           // unchanged
  localFunctions: Set<string>      // unchanged
  kinds: Map<string, SymbolKind>   // NEW — last-known kind per name (per scope)
}
```

### Inference rules (scope pre-pass, RHS of each assignment)

Grounded in the A-cases; each rule keys off the *raw* RHS so it runs before
transforms rewrite it:

- `name = @(...) ...`                         → `lambda`   (A3)
- `name = containers.Map(...)`                → `dict`     (A4)
- `name = zeros|ones|eye|rand|linspace|[...]` → `array`
- `name` appears in `size(name)`/`length(name)`/`name(:, …)`/`name.'` → `array`
- `[~, name] = max|min|sort(...)` or `name = find(...)` → `index`  (A1) — the
  output is already 0-based after `argmax`/`flatnonzero`, so it must NOT get the
  `−1` shift
- numeric/char literal RHS                    → `scalar`
- otherwise                                   → `unknown`

Kinds are **last-write-wins per scope** (a name reassigned to a new kind updates;
shadowing follows the existing variable-wins rule). Keep it intra-procedural —
that already covers A1–A4.

### Stage-04 consumption (the "after" work)

`stages/04_index.ts` switches from brittle heuristics (colon-in-args, comparison
ops) to the kind:

- `kind(name) === 'lambda'`   → leave `name(args)` as a **call** (A3)
- `kind(name) === 'dict'`     → `name[key]` on **read and write** (A4, fix the asymmetry)
- `kind(name) === 'array'`:
  - simple subscript → `name[expr - 1]` (unchanged)
  - **expression subscript** `name(inner)` → resolve `inner` recursively, then
    `name[<resolved> - 1]` (A2) — this is the "nested/expression subscript" the
    punch-list calls out
- subscript that *is* an `index` var → **no `−1`** (it's already 0-based) (A1);
  this replaces the `buildZeroBasedVars` single-assignment gap
- `kind(name) === 'function'` → leave as call (unchanged)
- `kind(name) === 'unknown'` and the form is an ambiguous `name(...)` → **emit a
  `# TODO:` flag** and leave it, rather than guess (see below)

## Two methodology pieces carried from the sibling (VBA) engine

1. **Flag-don't-guess as the "clean signal."** Whenever the kind is `unknown`
   and the construct is ambiguous, emit a `# TODO:` instead of guessing. This is
   the punch-list's **Tier-2 flag net** ("the single highest-leverage fix" —
   converts the silent-wrong class into *visible*) delivered as a *byproduct* of
   kind tracking, not a separate pass. A guessed wrong answer is worse than a
   flagged one.

2. **The numeric oracle is the gate.** Tier-1 silent-wrong (A1, plus B-family) is
   undetectable by py_compile or flags — only a numeric diff catches it. Make the
   **Octave oracle** (punch-list "highest-leverage investment") the regression
   gate for this work: run the A1–A4 fixtures + the corpus through Octave-vs-Python
   and diff, before and after. Mirror the sibling engine's before/after corpus
   comparison so the change is *proven*, not asserted.

## Scope

**In (this plan → the Stage-04 increment):**
- `kinds` map in `scope.ts` with the 7 rules above.
- Stage-04 consumer for lambda / dict / array-expression-subscript / index-var.
- `# TODO:` flag on `unknown` ambiguous `name(...)`.
- One verification-corpus case per A1–A4 (the punch-list asks for this; it turns
  the punch-list into permanent harness coverage).

**Out (deliberately deferred):**
- Full expression-type propagation beyond what A1–A4 need (no general AST).
- Root Cause B (matmul `*`, `reshape` column-major, `rem`) — separate semantic
  bucket, not a kind problem.
- Inter-procedural kind flow — intra-procedural covers the measured cases.

## Acceptance

- A1–A4 fixtures produce the "correct" column above and `ast.parse`-clean Python.
- Octave numeric oracle: A1 fixture flips from silent-wrong to correct; no new
  mismatches introduced corpus-wide.
- The REVIEW_PUNCHLIST "Verified correct" list (1-D/2-D indexing, `end`-arith,
  logical indexing) does **not** regress — the kind table *extends*, never
  replaces, the binary classifier; names with no kind fall back to today's
  variable/function behavior.
- Net flag count may rise (that's the point — visible > silent); net *wrong*
  answers must fall.

## Files

- `src/lib/converter/analysis/scope.ts` — add `kinds` + inference rules.
- `src/lib/converter/stages/04_index.ts` — consume `kinds`; replace heuristics;
  recurse expression subscripts; drop `−1` for `index` kind.
- `src/lib/converter/__tests__/` — A1–A4 regression tests + corpus fixtures.
- Octave oracle harness (`scripts/corpus/`) — wire as the silent-wrong gate.
