/**
 * Multi-file conversion: convert a MATLAB entry script TOGETHER with the
 * sibling function files it calls (its dependency closure), emitting ONE
 * self-contained Python file — helper defs first, entry body last, a single
 * merged import block on top.
 *
 * MATLAB resolves calls by FILENAME on the path; the closure resolver mirrors
 * that: an identifier called in the source that matches a project function
 * file's basename pulls that file in (transitively). Sibling names shadow
 * registry mappings (a project `smooth.m` beats the Curve Fitting toolbox
 * mapping), matching MATLAB path precedence.
 *
 * Scope: FUNCTION files only. A script calling another SCRIPT runs it in the
 * caller's workspace — no clean Python equivalent, left to the flag net.
 * Class folders (@x) and package dirs (+x) are the caller's responsibility to
 * exclude when building `files`.
 */
import { convert, type ConvertOptions } from './index'
import type { ConversionResult, Flag } from './types'
import { buildImportBlock } from './registry/imports'

export interface BundleResult {
  python: string
  /** Names of sibling function files pulled into the bundle, in emit order. */
  included: string[]
  /** Closure names that were CALLED but had no file in `files` (left unresolved). */
  flags: Flag[]
}

/** Strip comments and string literals so call-scanning can't match prose. */
function stripNoise(src: string): string {
  return src
    .split('\n')
    .map(l => l.replace(/%.*$/, '').replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""'))
    .join('\n')
}

/** Identifiers invoked in `src`: `name(...)` calls, bare-statement calls, and
 *  `@name` function-handle references (`knCenter(@knGauss, X)` pulls knGauss). */
function calledNames(src: string): Set<string> {
  const out = new Set<string>()
  const clean = stripNoise(src)
  for (const m of clean.matchAll(/(^|[^\w.@])([A-Za-z_]\w*)\s*\(/g)) out.add(m[2])
  // No-paren invocation: a bare identifier alone on a statement line.
  for (const m of clean.matchAll(/^\s*([A-Za-z_]\w*)\s*;?\s*$/gm)) out.add(m[1])
  // Function-handle references (not anonymous @(...) lambdas).
  for (const m of clean.matchAll(/@([A-Za-z_]\w*)/g)) out.add(m[1])
  return out
}

/**
 * BFS the dependency closure of `entrySrc` over the project file index.
 * Returns sibling function names in a stable order (discovery order).
 */
export function resolveClosure(entrySrc: string, files: Map<string, string>): string[] {
  const included: string[] = []
  const seen = new Set<string>()
  let frontier = [...calledNames(entrySrc)].filter(n => files.has(n))
  while (frontier.length > 0) {
    const next: string[] = []
    for (const name of frontier) {
      if (seen.has(name)) continue
      seen.add(name)
      included.push(name)
      for (const dep of calledNames(files.get(name)!)) {
        if (files.has(dep) && !seen.has(dep)) next.push(dep)
      }
    }
    frontier = next
  }
  return included
}

/** Drop the leading import block a member conversion emitted (imports are
 *  merged and re-emitted once at the bundle top). */
function stripImportBlock(python: string): string {
  const lines = python.split('\n')
  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()
    if (t === '' || t.startsWith('import ') || t.startsWith('from ')) { i++; continue }
    break
  }
  return lines.slice(i).join('\n')
}

/**
 * Convert `entrySrc` plus its dependency closure from `files`
 * (basename-without-.m → MATLAB source) into one Python file.
 */
export function convertBundle(entrySrc: string, files: Map<string, string>): BundleResult {
  const included = resolveClosure(entrySrc, files)
  const externalFunctions = included
  const opts: ConvertOptions = { externalFunctions }

  const importKeys = new Set<string>()
  const flags: Flag[] = []
  const memberBodies: string[] = []

  for (const name of included) {
    const res: ConversionResult = convert(files.get(name)!, opts)
    for (const k of res.report.imports) importKeys.add(k)
    for (const f of res.report.flags) flags.push({ ...f, message: `[${name}.m] ${f.message}` })
    memberBodies.push(`# ── from ${name}.m ──\n${stripImportBlock(res.python).trim()}`)
  }

  const entryRes = convert(entrySrc, opts)
  for (const k of entryRes.report.imports) importKeys.add(k)
  flags.push(...entryRes.report.flags)

  const importBlock = buildImportBlock(importKeys)
  const pieces = [
    importBlock.trim(),
    ...memberBodies,
    stripImportBlock(entryRes.python).trim(),
  ].filter(Boolean)

  return { python: pieces.join('\n\n') + '\n', included, flags }
}
