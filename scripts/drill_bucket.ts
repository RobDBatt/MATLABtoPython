import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { convert } from '../src/lib/converter'

type Result = { rel: string; status: string; error?: string }

const bucketIdx = parseInt(process.argv[2] || '1', 10)
const sampleSize = parseInt(process.argv[3] || '5', 10)

const rawPath = 'scripts/corpus/output/raw.json'
if (!existsSync(rawPath)) {
  console.error('No corpus run found. Run `npm run corpus` first.')
  process.exit(1)
}
const raw: Result[] = JSON.parse(readFileSync(rawPath, 'utf8'))
const fails = raw.filter((r) => r.status !== 'PASS')

const groups = new Map<string, Result[]>()
for (const r of fails) {
  const key = (r.error || 'unknown')
    .replace(/line \d+/g, 'line N')
    .replace(/\(.+?, line \d+\)/g, '')
    .trim()
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key)!.push(r)
}
const sorted = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)

if (sorted.length === 0) {
  console.log('No failures — corpus is fully passing.')
  process.exit(0)
}

if (bucketIdx < 1 || bucketIdx > sorted.length) {
  console.error(`Bucket ${bucketIdx} out of range. Available buckets:`)
  for (let i = 0; i < sorted.length; i++) {
    console.error(`  ${i + 1}. ${sorted[i][0]} (${sorted[i][1].length} files)`)
  }
  process.exit(1)
}

const [key, files] = sorted[bucketIdx - 1]
console.log(`Bucket ${bucketIdx}: ${key}`)
console.log(`${files.length} files total. Sampling up to ${sampleSize} from distinct repos.\n`)

// Pick one file per top-level repo for diversity, up to sampleSize
const seenRepos = new Set<string>()
const samples: Result[] = []
for (const f of files) {
  const repo = f.rel.split(/[\\/]/)[0]
  if (seenRepos.has(repo)) continue
  seenRepos.add(repo)
  samples.push(f)
  if (samples.length >= sampleSize) break
}

const corpusRoot = 'scripts/corpus/repos'
const tmpFile = '/tmp/converted_drill.py'
for (const s of samples) {
  const path = join(corpusRoot, s.rel)
  let matlab: string
  try { matlab = readFileSync(path, 'utf8') }
  catch (err) {
    console.log(`${s.rel}\n  ERROR reading: ${(err as Error).message}\n`)
    continue
  }
  let result
  try { result = convert(matlab) }
  catch (err) {
    console.log(`${s.rel}\n  CONVERT_THREW: ${(err as Error).message}\n`)
    continue
  }
  writeFileSync(tmpFile, result.python)
  const r = spawnSync('python', ['-m', 'py_compile', tmpFile], { encoding: 'utf8' })
  if (r.status === 0) {
    console.log(`${s.rel}\n  PASS now (corpus snapshot is stale — re-run \`npm run corpus\`)\n`)
    continue
  }
  const err = (r.stderr || r.stdout || '').trim()
  const m = err.match(/File "[^"]+", line (\d+)\r?\n\s+([^\r\n]+)\r?\n(?:\s*\^+\r?\n)?(\w+Error[^\r\n]*)/)
  console.log(`${s.rel}`)
  if (m) {
    console.log(`  L${m[1]}: ${m[2].trim()}`)
    console.log(`  ${m[3].trim()}`)
  } else {
    console.log(`  ${err.split('\n').slice(0, 2).join(' | ')}`)
  }
  console.log()
}
