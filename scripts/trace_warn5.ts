import { convert } from '../src/lib/converter'

const input = `function test()
warning('vbmc:pbInitFailed', ...
    'Some plausible bounds could not be determined from starting set. Using hard upper/lower bounds for those instead.');
end`
const r = convert(input)
r.python.trim().split('\n').forEach((l,i) => console.log(i+1, l))
