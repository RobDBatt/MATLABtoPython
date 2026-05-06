import { convert } from '../src/lib/converter'

const tests = [
  `y = arrayfun(@(x) x+1, data);`,
  `addlistener(obj, 'event', @(src,evt) callback(src));`,
]
for (const t of tests) {
  const r = convert(t)
  console.log('IN:', t)
  console.log('OUT:', r.python.trim())
  console.log()
}
