import { convert } from '../src/lib/converter'

// Simulate what happens after the ... continuation joins the lines
const input = `function test()
warning('vbmc:pbInitFailed', ...
    'Some plausible bounds.');
end`
const r = convert(input)
console.log('OUT:')
r.python.trim().split('\n').forEach(l => console.log(' ', l))
