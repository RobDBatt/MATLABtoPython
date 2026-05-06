import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'

const cases = [
  `batch = x(kk((l - 1) * opts.batchsize + 1 : l * opts.batchsize), :);`,
  `f = @(x) x + 1;`,
  `x{i}{1} = reshape(train_x(((i - 1) * N + 1) : (i) * N, :), N, 28, 28) * 255;`,
]
for (const input of cases) {
  console.log('\nIN:', JSON.stringify(input))
  const rq = resolveQuotes(input)
  const tk = tokenize(rq)
  const struct = detectStructure(tk)
  const { transformed } = transform(struct)
  transformed.forEach((l: any) => {
    console.log('OUT:', l.content)
    if (l.flags && l.flags.length) {
      l.flags.forEach((f: any) => console.log('  FLAG:', f.type, f.message.slice(0, 80)))
    }
  })
}
