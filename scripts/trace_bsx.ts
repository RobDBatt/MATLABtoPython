import { convert } from '../src/lib/converter'
const result = convert('R = bsxfun(@plus, R, log(w));')
console.log(JSON.stringify(result.python))
console.log('flags:', result.report.flags.map(f => `${f.type}: ${f.message.slice(0, 60)}`))
