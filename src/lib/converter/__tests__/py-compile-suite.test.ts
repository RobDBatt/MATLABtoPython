import { describe, it, expect, beforeAll } from 'vitest'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { convert } from '../index'

/**
 * Runs every .m fixture in scripts/py-compile-suite/inputs through the
 * converter and validates the resulting Python with `python -m py_compile`.
 *
 * This is the end-to-end safety net: the unit tests cover individual
 * transformation rules, the py_compile suite proves that realistic MATLAB
 * scripts convert to *syntactically valid* Python.
 *
 * Requires `python` on PATH. If absent, tests are skipped with a notice.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..', '..', '..')
const inputsDir = join(repoRoot, 'scripts', 'py-compile-suite', 'inputs')
const outputsDir = join(repoRoot, 'scripts', 'py-compile-suite', 'outputs')

function pythonAvailable(): boolean {
  const r = spawnSync('python', ['--version'], { encoding: 'utf8' })
  return r.status === 0
}

const pyOk = pythonAvailable()

describe.skipIf(!pyOk)('py_compile suite (30 real-world MATLAB scripts)', () => {
  const files = readdirSync(inputsDir).filter(f => f.endsWith('.m')).sort()

  beforeAll(() => {
    if (existsSync(outputsDir)) rmSync(outputsDir, { recursive: true })
    mkdirSync(outputsDir, { recursive: true })
  })

  it('suite has exactly 30 scripts', () => {
    expect(files.length).toBe(30)
  })

  for (const file of files) {
    it(`${file} → valid Python`, () => {
      const matlab = readFileSync(join(inputsDir, file), 'utf8')
      const { python } = convert(matlab)
      const pyFile = join(outputsDir, file.replace(/\.m$/, '.py'))
      writeFileSync(pyFile, python)

      const check = spawnSync('python', ['-m', 'py_compile', pyFile], { encoding: 'utf8' })
      if (check.status !== 0) {
        const err = (check.stderr || check.stdout || '').trim()
        throw new Error(`py_compile failed for ${file}:\n${err}\n\n--- Generated Python ---\n${python}`)
      }
      expect(check.status).toBe(0)
    })
  }
})
