import { spawnSync } from 'node:child_process'

process.env.RUN_CORPUS = '1'
const r = spawnSync(
  'npx',
  ['vitest', 'run', 'src/lib/converter/__tests__/corpus-analysis.test.ts'],
  { stdio: 'inherit', shell: true, env: process.env },
)
process.exit(r.status ?? 1)
