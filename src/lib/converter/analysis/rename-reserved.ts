/**
 * MATLAB-to-Python identifier renaming for Python reserved words.
 *
 * MATLAB allows names like `lambda`, `class`, `in` as variables and
 * struct fields. Python rejects them as syntax errors. This module
 * builds a rename map from the symbol table and applies it line-by-line,
 * skipping string and comment contents.
 *
 * Strategy:
 *   - Variables whose name is a Python reserved word → suffixed with `_`
 *   - Struct field access of those names → also suffixed (`.class` → `.class_`)
 *   - Renames must be consistent across the whole conversion so
 *     definitions and uses still line up.
 */

import { IMPORT_ALIASES } from '../registry/imports'

const PYTHON_RESERVED = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
  'while', 'with', 'yield',
])

export function isPythonReserved(name: string): boolean {
  return PYTHON_RESERVED.has(name)
}

/**
 * MATLAB keywords. Defensive — these can't be valid variable names in
 * MATLAB, so they should never be renamed even if they leak into the
 * symbol table's `variables` set due to a regex bug elsewhere.
 */
const MATLAB_KEYWORDS = new Set([
  'break', 'case', 'catch', 'classdef', 'continue', 'else', 'elseif',
  'end', 'for', 'function', 'global', 'if', 'otherwise', 'parfor',
  'persistent', 'return', 'spmd', 'switch', 'try', 'while',
])

/**
 * Build a map of MATLAB-name → safe-Python-name for every variable
 * whose name collides with a Python reserved word.
 */
export function buildRenameMap(variables: Set<string>): Map<string, string> {
  const map = new Map<string, string>()
  const taken = new Set(variables)
  for (const name of variables) {
    if (MATLAB_KEYWORDS.has(name)) continue
    // Python reserved words AND names bound by injected imports both need a
    // rename: a user variable called `signal` would otherwise shadow
    // `import scipy.signal as signal` and break generated `signal.butter(...)`.
    if (!PYTHON_RESERVED.has(name) && !IMPORT_ALIASES.has(name)) continue
    let renamed = `${name}_`
    while (taken.has(renamed)) renamed += '_'
    taken.add(renamed)
    map.set(name, renamed)
  }
  return map
}

/**
 * Apply the rename map to a single line. Walks the line character-by-character
 * so identifiers inside `'...'`, `"..."`, or after a `%` comment are left
 * untouched. Word-boundary aware: only renames complete identifiers.
 */
export function applyRenames(line: string, renames: Map<string, string>): string {
  if (renames.size === 0) return line
  let result = ''
  let i = 0
  let inString: '"' | "'" | null = null
  while (i < line.length) {
    const ch = line[i]
    if (inString === null && ch === '%') {
      result += line.slice(i)
      break
    }
    if (inString === null && (ch === "'" || ch === '"')) {
      inString = ch as '"' | "'"
      result += ch
      i++
      continue
    }
    if (inString !== null) {
      if (ch === inString && line[i + 1] === inString) {
        result += ch + ch
        i += 2
        continue
      }
      if (ch === inString) {
        inString = null
      }
      result += ch
      i++
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      let end = i
      while (end < line.length && /\w/.test(line[end])) end++
      const word = line.slice(i, end)
      const replacement = renames.get(word)
      result += replacement ?? word
      i = end
      continue
    }
    result += ch
    i++
  }
  return result
}

/**
 * Rename struct-field access where the field name is a Python reserved word.
 * Catches `obj.class`, `s.lambda`, etc. — these always need the suffix
 * regardless of whether the field name was tracked in the symbol table.
 *
 * Walks the line so we skip strings and comments. The check `prev !== '.'`
 * inside the dot guard means we only fire for `.NAME` (single-dot field
 * access), not for chained `..NAME` or numeric literals like `3.lambda`
 * (impossible in MATLAB but defensive).
 */
export function renameReservedFields(line: string): string {
  let result = ''
  let i = 0
  let inString: '"' | "'" | null = null
  while (i < line.length) {
    const ch = line[i]
    if (inString === null && ch === '%') {
      result += line.slice(i)
      break
    }
    if (inString === null && (ch === "'" || ch === '"')) {
      inString = ch as '"' | "'"
      result += ch
      i++
      continue
    }
    if (inString !== null) {
      if (ch === inString && line[i + 1] === inString) {
        result += ch + ch
        i += 2
        continue
      }
      if (ch === inString) inString = null
      result += ch
      i++
      continue
    }
    if (ch === '.' && i + 1 < line.length && /[A-Za-z_]/.test(line[i + 1])) {
      let end = i + 1
      while (end < line.length && /\w/.test(line[end])) end++
      const name = line.slice(i + 1, end)
      if (PYTHON_RESERVED.has(name)) {
        result += `.${name}_`
      } else {
        result += line.slice(i, end)
      }
      i = end
      continue
    }
    result += ch
    i++
  }
  return result
}
