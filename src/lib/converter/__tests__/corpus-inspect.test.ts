import { describe, it } from 'vitest'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { convert } from '../index'

/**
 * Corpus inspector — given a short list of .m paths, converts each and
 * dumps MATLAB + Python side-by-side with the py_compile error so we can
 * eyeball what's going wrong. Gated behind INSPECT_CORPUS=1.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..', '..', '..')
const corpusRoot = join(repoRoot, 'scripts', 'corpus', 'repos')
const outDir = join(repoRoot, 'scripts', 'corpus', 'output', 'inspect')

const run = process.env.INSPECT_CORPUS === '1'

const FILES = [
  // Line-continuation breakage
  'PRMLT/chapter03/linRegFp.m',
  'PRMLT/chapter09/linRegEm.m',
  // "Maybe you meant ==" in conditions
  'PRMLT/chapter09/kmeans.m',
  'PRMLT/chapter09/kmedoids.m',
  'PRMLT/chapter09/mixBernEm.m',
  'PRMLT/chapter10/mixGaussVb.m',
]

describe.skipIf(!run)('corpus inspection', () => {
  it('dumps side-by-side conversions for top failure cases', { timeout: 120_000 }, () => {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

    for (const rel of FILES) {
      const abs = join(corpusRoot, rel.replace(/\//g, require('node:path').sep))
      if (!existsSync(abs)) {
        console.log(`[skip missing] ${rel}`)
        continue
      }
      const matlab = readFileSync(abs, 'utf8')
      const python = convert(matlab).python

      const tmp = join(outDir, '_check.py')
      writeFileSync(tmp, python)
      const check = spawnSync('python', ['-m', 'py_compile', tmp], { encoding: 'utf8' })
      const err = check.status === 0 ? 'PASS' : (check.stderr || check.stdout).trim()

      const outFile = join(outDir, rel.replace(/[\\\/]/g, '_').replace(/\.m$/, '.dump.txt'))
      const dump =
        `=== ${rel}\n\n` +
        `--- MATLAB (first 60 lines) ---\n${matlab.split('\n').slice(0, 60).join('\n')}\n\n` +
        `--- PYTHON OUTPUT (first 80 lines) ---\n${python.split('\n').slice(0, 80).join('\n')}\n\n` +
        `--- PY_COMPILE ---\n${err}\n`
      writeFileSync(outFile, dump)
    }
  })
})
