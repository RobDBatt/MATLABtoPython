import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { convert } from '../src/lib/converter'

const path = process.argv[2]
if (!path) { console.error('usage: inspect_one.ts <file.m>'); process.exit(1) }

const matlab = readFileSync(path, 'utf8')
const result = convert(matlab)
const tmpFile = '/tmp/converted_inspect.py'
writeFileSync(tmpFile, result.python)

console.log('=== OUTPUT ===')
console.log(result.python)
console.log('\n=== PY_COMPILE ===')
const r = spawnSync('python', ['-m', 'py_compile', tmpFile], { encoding: 'utf8' })
console.log(r.stdout || '')
console.log(r.stderr || '')
console.log(`exit: ${r.status}`)

console.log('\n=== FLAGS ===')
for (const f of result.report.flags) {
  console.log(`  [${f.type}] L${f.originalLine}: ${f.message}`)
}
