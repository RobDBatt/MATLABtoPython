import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'

const input = `f = @(x) a*x.^3 + b*x.^2 + c*x + d;`
const rq = resolveQuotes(input)
const tk = tokenize(rq)
const struct = detectStructure(tk)
const { transformed, flags } = transform(struct)
console.log('flags:', flags.length, flags.map((f:any) => f.message.slice(0,60)))
transformed.forEach((l:any) => console.log('OUT:', l.content))
