import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'

const cases = [
  `else, mu_grad = []`,
  `if nargout:`,
]
for (const input of cases) {
  const rq = resolveQuotes(input)
  const tk = tokenize(rq)
  const struct = detectStructure(tk)
  const { transformed, flags } = transform(struct)
  console.log('IN:', JSON.stringify(input))
  transformed.forEach((l:any) => console.log('OUT:', l.content))
  flags.forEach((f:any) => console.log('FLAG:', f.message.slice(0,60)))
  console.log()
}
