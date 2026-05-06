import { convert } from '../src/lib/converter'

// Test the continuation pattern  
const input = `function test()
warning('vbmc:pbInitFailed', ...
    'Some plausible bounds could not be determined. Using hard upper/lower bounds.');
end`
const r = convert(input)
r.python.trim().split('\n').forEach((l,i) => console.log(i+1, l))
