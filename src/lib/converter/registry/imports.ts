/**
 * Import injection order and format.
 * When multiple libraries are detected, imports are injected
 * at the top of the output file in this specific order.
 */

/**
 * Special import prefix: `compat:NAME` in the imports set requests
 * `from matlabtopython_compat import NAME` to be added at the top of
 * the output. Multiple compat: entries get merged into one import line.
 */
export const COMPAT_PREFIX = 'compat:'

/** Maps an import key to its Python import statement */
export const IMPORT_STATEMENTS: Record<string, string> = {
  numpy: 'import numpy as np',
  'scipy.signal': 'import scipy.signal as signal',
  'scipy.stats': 'import scipy.stats as stats',
  'scipy.optimize': 'import scipy.optimize as optimize',
  'scipy.ndimage': 'import scipy.ndimage as ndi',
  'scipy.io': 'from scipy import io as sio',
  'skimage.io': 'from skimage import io',
  'skimage.color': 'from skimage import color',
  'skimage.transform': 'from skimage import transform',
  'skimage.feature': 'from skimage import feature',
  'skimage.measure': 'from skimage import measure',
  'skimage.morphology': 'from skimage import morphology',
  'skimage.util': 'from skimage import util',
  control: 'import control',
  'matplotlib.pyplot': 'import matplotlib.pyplot as plt',
  pandas: 'import pandas as pd',
  statsmodels: 'import statsmodels.api as sm',
  re: 'import re',
  soundfile: 'import soundfile as sf',
  time: 'import time',
  warnings: 'import warnings',
  os: 'import os',
  tempfile: 'import tempfile',
  'scipy.sparse': 'import scipy.sparse',
  'scipy.integrate': 'from scipy import integrate',
  'scipy.interpolate': 'from scipy import interpolate',
  sympy: 'import sympy as sp',
  pywt: 'import pywt',
}

/**
 * Names the injected import statements bind into the module namespace
 * (e.g. `import scipy.signal as signal` binds `signal`, `from skimage import io`
 * binds `io`). A MATLAB variable sharing one of these names would shadow the
 * import and break generated calls like `signal.butter(...)`, so the rename
 * pass (see analysis/rename-reserved.ts) treats these as reserved. Derived
 * from IMPORT_STATEMENTS so it stays in sync automatically.
 */
function parseBoundNames(stmt: string): string[] {
  // `import a.b.c as x`  |  `import a.b.c`
  let m = stmt.match(/^import\s+([\w.]+)(?:\s+as\s+(\w+))?$/)
  if (m) return [m[2] ?? m[1].split('.')[0]]
  // `from pkg import a, b as c, d`
  m = stmt.match(/^from\s+[\w.]+\s+import\s+(.+)$/)
  if (m) {
    return m[1].split(',').map(part => {
      const seg = part.trim().split(/\s+as\s+/)
      return (seg[1] ?? seg[0]).trim()
    })
  }
  return []
}

export const IMPORT_ALIASES: Set<string> = new Set(
  Object.values(IMPORT_STATEMENTS).flatMap(parseBoundNames),
)

/** Defines the order in which imports should appear */
export const IMPORT_ORDER: string[] = [
  'numpy',
  'scipy.signal',
  'scipy.stats',
  'scipy.optimize',
  'scipy.ndimage',
  'scipy.io',
  'skimage.io',
  'skimage.color',
  'skimage.transform',
  'skimage.feature',
  'skimage.measure',
  'skimage.morphology',
  'skimage.util',
  'control',
  'matplotlib.pyplot',
  'pandas',
  'statsmodels',
  're',
  'soundfile',
  'time',
  'warnings',
  'os',
  'tempfile',
  'scipy.sparse',
  'scipy.integrate',
  'scipy.interpolate',
  'sympy',
  'pywt',
]

/** Given a set of import keys, return the ordered import block */
export function buildImportBlock(imports: Set<string>): string {
  // Merge skimage submodules into combined imports
  const skimageModules: string[] = []
  const compatNames: string[] = []
  const filteredImports = new Set(Array.from(imports))

  Array.from(imports).forEach(key => {
    if (key.startsWith('skimage.')) {
      skimageModules.push(key.replace('skimage.', ''))
      filteredImports.delete(key)
    } else if (key.startsWith(COMPAT_PREFIX)) {
      compatNames.push(key.slice(COMPAT_PREFIX.length))
      filteredImports.delete(key)
    }
  })

  const lines: string[] = []

  for (const key of IMPORT_ORDER) {
    if (key.startsWith('skimage.')) continue // handled below
    if (filteredImports.has(key)) {
      lines.push(IMPORT_STATEMENTS[key])
    }
  }

  // Insert combined skimage import at the right position
  if (skimageModules.length > 0) {
    const skimageImport = `from skimage import ${skimageModules.join(', ')}`
    // Insert after scipy imports, before control
    const controlIdx = lines.findIndex(l => l.startsWith('import control'))
    if (controlIdx >= 0) {
      lines.splice(controlIdx, 0, skimageImport)
    } else {
      const pltIdx = lines.findIndex(l => l.startsWith('import matplotlib'))
      if (pltIdx >= 0) {
        lines.splice(pltIdx, 0, skimageImport)
      } else {
        lines.push(skimageImport)
      }
    }
  }

  // Append the compat import last (user installs via `pip install
  // matlabtopython-compat`). Keeping it at the end makes it obvious
  // this is the optional runtime dependency.
  if (compatNames.length > 0) {
    const names = Array.from(new Set(compatNames)).sort().join(', ')
    lines.push(`from matlabtopython_compat import ${names}`)
  }

  return lines.join('\n')
}


import { FUNCTION_MAP } from './functions'
import { TOOLBOX_MAP } from './toolboxes'
import { CONSTANT_MAP } from './constants'

/**
 * Aliases that will ACTUALLY be imported for a given source — used to scope the
 * import-alias rename so a user variable named `signal`/`time`/`stats` is only
 * renamed when the matching module is genuinely imported (i.e. the code uses a
 * function/constant that triggers that import). Avoids renaming bare variables
 * that shadow nothing.
 */
export function importedAliasesForSource(src: string): Set<string> {
  const out = new Set<string>()
  const addKeys = (keys?: string[]) => {
    for (const k of keys || []) {
      for (const a of parseBoundNames(IMPORT_STATEMENTS[k] || '')) out.add(a)
    }
  }
  const words = new Set(src.match(/\b[A-Za-z_]\w*\b/g) || [])
  for (const w of words) {
    if (FUNCTION_MAP[w]) addKeys(FUNCTION_MAP[w].imports)
    if (TOOLBOX_MAP[w]) addKeys(TOOLBOX_MAP[w].imports)
    if (CONSTANT_MAP[w]) addKeys(CONSTANT_MAP[w].imports)
  }
  return out
}
