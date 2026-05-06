import { readFileSync, existsSync } from 'node:fs'

type Flag = { type: string; message: string }
type Result = {
  rel: string
  status: string
  flagCount?: number
  flags?: Flag[]
}

const rawPath = 'scripts/corpus/output/raw.json'
if (!existsSync(rawPath)) {
  console.error('No corpus run found. Run `npm run corpus` first.')
  process.exit(1)
}

const raw: Result[] = JSON.parse(readFileSync(rawPath, 'utf8'))

// First word of each message is usually a function name — group by that to
// collapse parameterised messages. Keep one full example per group so the
// output is actionable.
const groups = new Map<
  string,
  { count: number; type: string; example: string; files: Set<string> }
>()

for (const r of raw) {
  if (!r.flags) continue
  for (const flag of r.flags) {
    // Group key: first ~80 chars of the message stripped of variable bits.
    // Numbers, single-quoted args, and dollar-arg references are normalised
    // so functionally identical flags collapse.
    const key = flag.message
      .replace(/\d+/g, 'N')
      .replace(/'[^']*'/g, "'…'")
      .replace(/\$\d+/g, '$N')
      .slice(0, 100)
    const g = groups.get(key)
    if (g) {
      g.count++
      g.files.add(r.rel)
    } else {
      groups.set(key, {
        count: 1,
        type: flag.type,
        example: flag.message,
        files: new Set([r.rel]),
      })
    }
  }
}

const sorted = Array.from(groups.entries()).sort(
  (a, b) => b[1].count - a[1].count,
)

const totalFlags = sorted.reduce((s, [, g]) => s + g.count, 0)
const filesWithFlags = new Set(raw.filter((r) => (r.flagCount ?? 0) > 0).map((r) => r.rel)).size

console.log(`Total flags: ${totalFlags} across ${filesWithFlags} files`)
console.log(`Distinct flag patterns: ${sorted.length}`)
console.log()
console.log('# Top flag patterns by occurrence count')
console.log()

const topN = parseInt(process.argv[2] || '20', 10)
let rank = 1
for (const [, g] of sorted.slice(0, topN)) {
  const pct = ((g.count / totalFlags) * 100).toFixed(1)
  console.log(`${rank}. [${g.type}] ${g.count} firings in ${g.files.size} files (${pct}% of all flags)`)
  console.log(`   ${truncate(g.example, 200)}`)
  rank++
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}
