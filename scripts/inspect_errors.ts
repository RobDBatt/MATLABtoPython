import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { convert } from '../src/lib/converter'

const files = process.argv.slice(2)
const tmpFile = '/tmp/converted_inspect.py'

for (const path of files) {
  const matlab = readFileSync(path, 'utf8')
  let result
  try {
    result = convert(matlab)
  } catch (err) {
    console.log(`${path}\n  CONVERT_THREW: ${(err as Error).message}\n`)
    continue
  }
  writeFileSync(tmpFile, result.python)
  const r = spawnSync('python', ['-m', 'py_compile', tmpFile], { encoding: 'utf8' })
  if (r.status === 0) { console.log(`${path}\n  PASS\n`); continue }
  const err = (r.stderr || r.stdout || '').trim()
  // Extract: line number, code, error type+msg
  const m = err.match(/File "[^"]+", line (\d+)\r?\n\s+([^\r\n]+)\r?\n(?:\s*\^+\r?\n)?(\w+Error[^\r\n]*)/)
  if (m) {
    console.log(`${path}`)
    console.log(`  L${m[1]}: ${m[2].trim()}`)
    console.log(`  ${m[3].trim()}`)
    console.log()
  } else {
    console.log(`${path}\n  ${err.split('\n').slice(0, 3).join(' | ')}\n`)
  }
}
