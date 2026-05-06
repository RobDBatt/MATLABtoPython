import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

type Result = {
  rel: string
  status: string
  error?: string
  flagCount?: number
}

const outDir = 'scripts/corpus/output'
const curPath = join(outDir, 'raw.json')
const prevPath = join(outDir, 'raw_prev.json')

if (!existsSync(curPath)) {
  console.error('No corpus run found. Run `npm run corpus` first.')
  process.exit(1)
}

const cur: Result[] = JSON.parse(readFileSync(curPath, 'utf8'))
const curPass = cur.filter((r) => r.status === 'PASS').length
const curClean = cur.filter((r) => r.status === 'PASS' && (r.flagCount ?? 0) === 0).length
const curTotal = cur.length

if (!existsSync(prevPath)) {
  console.log(`No previous run to diff against.`)
  console.log(`Current: ${curPass}/${curTotal} pass py_compile, ${curClean}/${curTotal} clean (zero flags)`)
  process.exit(0)
}

const prev: Result[] = JSON.parse(readFileSync(prevPath, 'utf8'))
const prevPass = prev.filter((r) => r.status === 'PASS').length
const prevClean = prev.filter((r) => r.status === 'PASS' && (r.flagCount ?? 0) === 0).length

const prevByRel = new Map(prev.map((r) => [r.rel, r]))
const newlyPass: string[] = []
const newlyFail: Array<{ rel: string; error?: string }> = []
const newlyClean: string[] = []
const newlyDirty: Array<{ rel: string; from: number; to: number }> = []

for (const r of cur) {
  const p = prevByRel.get(r.rel)
  if (!p) continue
  if (p.status === 'PASS' && r.status !== 'PASS') {
    newlyFail.push({ rel: r.rel, error: r.error })
  } else if (p.status !== 'PASS' && r.status === 'PASS') {
    newlyPass.push(r.rel)
  }
  // Flag-count drift on still-passing files
  if (p.status === 'PASS' && r.status === 'PASS') {
    const before = p.flagCount ?? 0
    const after = r.flagCount ?? 0
    if (before === 0 && after > 0) {
      newlyDirty.push({ rel: r.rel, from: before, to: after })
    } else if (before > 0 && after === 0) {
      newlyClean.push(r.rel)
    }
  }
}

const dPass = curPass - prevPass
const dClean = curClean - prevClean
const sign = (n: number) => (n > 0 ? '+' : '')
console.log(`PASS:  ${prevPass} → ${curPass} (${sign(dPass)}${dPass})`)
console.log(`CLEAN: ${prevClean} → ${curClean} (${sign(dClean)}${dClean})`)

if (
  newlyPass.length === 0 &&
  newlyFail.length === 0 &&
  newlyClean.length === 0 &&
  newlyDirty.length === 0
) {
  console.log('\nNo file-level changes.')
  process.exit(0)
}

if (newlyPass.length) {
  console.log(`\nNewly passing (${newlyPass.length}):`)
  for (const r of newlyPass) console.log(`  + ${r}`)
}

if (newlyClean.length) {
  console.log(`\nNewly clean — flags resolved (${newlyClean.length}):`)
  for (const r of newlyClean) console.log(`  ✓ ${r}`)
}

if (newlyFail.length) {
  console.log(`\nNewly failing (${newlyFail.length}) — REGRESSIONS:`)
  for (const r of newlyFail) {
    const err = r.error ? ` — ${r.error}` : ''
    console.log(`  - ${r.rel}${err}`)
  }
}

if (newlyDirty.length) {
  console.log(`\nNewly flagged — was clean, now has flags (${newlyDirty.length}):`)
  for (const r of newlyDirty) console.log(`  ! ${r.rel} (0 → ${r.to} flags)`)
}

if (newlyFail.length > 0) {
  process.exit(1)
}
