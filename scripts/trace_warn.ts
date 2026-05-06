import { convert } from '../src/lib/converter'

const input = `warning('vbmc:pbInitFailed', 'Some plausible bounds.');`
const r = convert(input)
console.log('OUT:', r.python.trim())
