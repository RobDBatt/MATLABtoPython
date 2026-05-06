import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'

const input = `batch = x(kk((l - 1) * opts.batchsize + 1 : l * opts.batchsize), :);`
console.log('IN:', JSON.stringify(input))
const rq = resolveQuotes(input)
const tk = tokenize(rq)
const struct = detectStructure(tk)
const { transformed, flags } = transform(struct)
console.log('top-level flags:', flags?.length, flags?.map((f:any) => f.message.slice(0,60)))
transformed.forEach((l, i) => {
  console.log('OUT[' + i + ']:', JSON.stringify(l.content))
  console.log('  keys:', Object.keys(l).join(', '))
})
