import type { LogicalLine } from '../types'
import { FUNCTION_MAP } from '../registry/functions'
import { TOOLBOX_MAP } from '../registry/toolboxes'

/**
 * Pre-pass that walks raw MATLAB source and builds a symbol table of
 * which names are variables vs. functions. Drives the `A(i)` →
 * function-call-vs-array-indexing decision throughout the pipeline.
 *
 * MATLAB can't reference an undeclared variable, so:
 *   - Any name on the LHS of `=`       → variable
 *   - Any name as a `for` loop target  → variable
 *   - Any name as a function parameter → variable
 *   - Any name in FUNCTION_MAP / TOOLBOX_MAP or in known built-ins → function
 *
 * When a name is in BOTH sets, variable wins (MATLAB allows shadowing a
 * built-in with a local variable, and callers usually mean the variable).
 */

export interface SymbolTable {
  variables: Set<string>
  functions: Set<string>
  /** Functions defined in THIS file (non-built-in, non-registry) */
  localFunctions: Set<string>
}

/**
 * Names that are universally treated as functions in MATLAB and should
 * never be accidentally classified as array variables even without a
 * registry entry. Subset of common built-ins the registry misses.
 */
const MATLAB_BUILTINS = [
  'disp', 'error', 'warning', 'exist', 'isa', 'isempty', 'isfield',
  'isequal', 'isnumeric', 'ischar', 'islogical', 'isstruct', 'iscell',
  'isnan', 'isfinite', 'isinf', 'isreal',
  'struct', 'cell', 'logical', 'char', 'num2str', 'str2num', 'str2double',
  'feval', 'func2str', 'str2func',
  'nargin', 'nargout', 'inputname',
  'size', 'numel', 'length', 'ndims', 'class',
  'fieldnames', 'isfield', 'rmfield', 'setfield', 'getfield',
  'any', 'all', 'find',
  'varargin', 'varargout',
  'true', 'false',
  'assert',
]

export function buildSymbolTable(lines: LogicalLine[]): SymbolTable {
  const variables = new Set<string>()
  const functions = new Set<string>()
  const localFunctions = new Set<string>()

  // Seed functions from registries + MATLAB built-ins
  for (const name of Object.keys(FUNCTION_MAP)) functions.add(name)
  for (const name of Object.keys(TOOLBOX_MAP)) functions.add(name)
  for (const name of MATLAB_BUILTINS) functions.add(name)

  for (const line of lines) {
    if (line.isComment) continue
    const content = line.content
    if (!content.trim()) continue

    // Function definitions: capture name + parameters
    // Forms:
    //   function name(args)
    //   function out = name(args)
    //   function [out1, out2] = name(args)
    const funcMatch = content.match(
      /^\s*function\s+(?:\[([^\]]*)\]\s*=\s*|(\w+)\s*=\s*)?(\w+)\s*\(([^)]*)\)/,
    )
    if (funcMatch) {
      const bracketOuts = funcMatch[1] || ''
      const singleOut = funcMatch[2] || ''
      const funcName = funcMatch[3]
      const params = funcMatch[4] || ''

      localFunctions.add(funcName)
      functions.add(funcName)

      // Output variables are assignable → variables
      const outs = (bracketOuts || singleOut)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      for (const o of outs) if (o !== '~') variables.add(o)

      // Parameters are variables in the function scope
      const ps = params.split(',').map(s => s.trim()).filter(Boolean)
      for (const p of ps) variables.add(p === 'varargin' ? 'args' : p)
      continue
    }

    // `for var = range` / `parfor var = range`
    const forMatch = content.match(/^\s*(?:for|parfor)\s+(\w+)\s*=/)
    if (forMatch) {
      variables.add(forMatch[1])
      // Skip the assignment LHS path below — that `=` belongs to the loop
      // header, not a variable assignment, and the LHS regex would
      // otherwise capture the keyword `for` itself as a variable.
      continue
    }

    // Global / persistent declarations: `global x y z`
    const globalMatch = content.match(/^\s*(?:global|persistent)\s+(.+)/)
    if (globalMatch) {
      for (const name of globalMatch[1].split(/[\s,]+/).filter(Boolean)) {
        variables.add(name)
      }
      continue
    }

    // Assignment LHS. Handle three shapes:
    //   name = ...
    //   name(args) = ...  (array element assignment)
    //   [a, b, c] = ...   (multi-return destructure)
    // Must detect `=` that is NOT part of `==`, `~=`, `<=`, `>=`, `!=`
    const eq = findBareAssignmentEquals(content)
    if (eq < 0) continue
    const lhs = content.slice(0, eq).trim()

    if (lhs.startsWith('[')) {
      // Multi-return: [a, b, c] = ... → a, b, c are all variables
      const inner = lhs.slice(1, lhs.lastIndexOf(']'))
      for (const name of extractIdentifiers(inner)) variables.add(name)
    } else {
      // Single target — the root identifier is a variable
      // (e.g. `foo(i) = x`, `foo.bar = x`, `foo{i} = x` all define `foo`)
      const root = lhs.match(/^(\w+)/)
      if (root) variables.add(root[1])
    }
  }

  // Resolution: if a name is both a variable and a function, treat it as
  // a variable (MATLAB's shadowing rule) UNLESS it was declared as a
  // local function in this file.
  for (const v of Array.from(variables)) {
    if (functions.has(v) && !localFunctions.has(v)) {
      functions.delete(v)
    }
  }

  return { variables, functions, localFunctions }
}

/** Find the index of the `=` that's an assignment (not `==`/`~=`/etc.). */
function findBareAssignmentEquals(line: string): number {
  let paren = 0, bracket = 0, brace = 0
  let inString = false, sc = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < line.length && line[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === '%' || ch === '#') return -1
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
    else if (ch === '=' && paren === 0 && bracket === 0 && brace === 0) {
      const prev = line[i - 1] || ''
      const next = line[i + 1] || ''
      if (next === '=') return -1 // `==`
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '~') return -1
      return i
    }
  }
  return -1
}

function extractIdentifiers(s: string): string[] {
  const out: string[] = []
  for (const m of s.matchAll(/\b([A-Za-z_]\w*)\b/g)) {
    if (m[1] !== '~') out.push(m[1])
  }
  return out
}
