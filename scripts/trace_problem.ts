import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'

const input = `net.layers{n}.d{j} = reshape(net.fvd(((j - 1) * fvnum + 1) : j * fvnum, :), sa(1), sa(2), sa(3));`
console.log('IN:', JSON.stringify(input))
const rq = resolveQuotes(input)
const tk = tokenize(rq)
const struct = detectStructure(tk)
const { transformed, imports } = transform(struct)
transformed.forEach((l: any) => {
  console.log('OUT:', l.content)
  if (l.flags && l.flags.length) {
    l.flags.forEach((f: any) => console.log('  FLAG:', f.type, f.message.slice(0, 80)))
  }
})
