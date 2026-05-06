import { convert } from '../src/lib/converter'

const input = `function Sp = test(b, d)
switch ftype
  case 'stop'
    Sp = [b + d, b - d];
end
end`
const result = convert(input)
console.log('OUT:', result.python.trim())
