import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'

// With context to simulate what the converter sees
const lines = [
  `b = 0.5 * (V(2) - V(1)) ./ Q;`,
  `d = sqrt(b .* b + c);`,
  `Sp = [b + d, b - d];`,
]
for (const line of lines) {
  const rq = resolveQuotes(line)
  const tk = tokenize(rq)
  const symbols = buildSymbolTable(tk)
  const struct = detectStructure(tk)
  const { transformed } = transform(struct)
  console.log('IN:', line)
  console.log('OUT:', transformed.map((l:any) => l.content).join(' | '))
}
