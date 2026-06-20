/**
 * Guard against the "import/name mismatch" bug class.
 *
 * Several registry entries emitted a Python call that referenced a module
 * alias the generated import block never bound — e.g. `solve_ivp(...)` while
 * importing `from scipy import integrate` (ode45), or `scipy.linalg.sqrtm(...)`
 * with no `scipy.linalg` import at all. Each produced a guaranteed NameError
 * with zero flags.
 *
 * This test converts a generic call for every FUNCTION_MAP / TOOLBOX_MAP entry
 * and asserts that every `alias.` prefix appearing in the output is actually
 * bound by one of the emitted import lines. It is conversion-based (not static)
 * so custom arg-handlers that rewrite the head — like nextpow2 → int(np.ceil(
 * np.log2(x))) — are validated by their real output, not their registry field.
 */
import { describe, it, expect } from 'vitest'
import { convert } from '../index'
import { FUNCTION_MAP } from '../registry/functions'
import { TOOLBOX_MAP } from '../registry/toolboxes'
import { IMPORT_ALIASES } from '../registry/imports'

function boundNames(stmt: string): string[] {
  let m = stmt.match(/^import\s+([\w.]+)(?:\s+as\s+(\w+))?$/)
  if (m) return [m[2] ?? m[1].split('.')[0]]
  m = stmt.match(/^from\s+[\w.]+\s+import\s+(.+)$/)
  if (m) return m[1].split(',').map(p => { const s = p.trim().split(/\s+as\s+/); return (s[1] ?? s[0]).trim() })
  return []
}

/** Module aliases referenced as `alias.something` but never imported. */
function unboundAliases(python: string): string[] {
  const lines = python.split('\n')
  const importLines = lines.filter(l => l.startsWith('import ') || l.startsWith('from '))
  const bound = new Set(importLines.flatMap(boundNames))
  // Only scan the code body — exclude import lines (their text mentions the
  // dotted module path, e.g. `import scipy.signal`) and comments (flag text
  // can reference `scipy.foo`). Both would otherwise be false positives.
  const body = lines
    .filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .map(l => l.replace(/#.*$/, ''))
    .join('\n')
  const used = new Set<string>()
  for (const m of body.matchAll(/(?:^|[^.\w])([A-Za-z_]\w*)\.[A-Za-z_]/g)) {
    if (IMPORT_ALIASES.has(m[1])) used.add(m[1])
  }
  return [...used].filter(a => !bound.has(a))
}

const allEntries = [
  ...Object.keys(FUNCTION_MAP).map(name => ['FUNCTION', name] as const),
  ...Object.keys(TOOLBOX_MAP).map(name => ['TOOLBOX', name] as const),
]

describe('registry entries import every module alias they emit', () => {
  it.each(allEntries)('%s %s emits no unbound module alias', (_reg, name) => {
    // Generic call — enough args to satisfy most signatures; only the emitted
    // module prefixes matter for this check, not argument arity.
    const python = convert(`__lhs = ${name}(__a, __b, __c);`).python
    expect(unboundAliases(python)).toEqual([])
  })
})
