import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { shiftIndices } from '../src/lib/converter/stages/04_index'
import { cleanup } from '../src/lib/converter/stages/05_cleanup'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'

for (const input of [`v = [1:5];`, `th = [0:opt.n-1]';`]) {
  console.log('IN:        ' + JSON.stringify(input))
  const rq = resolveQuotes(input)
  const tk = tokenize(rq)
  const symbols = buildSymbolTable(tk)
  const struct = detectStructure(tk)
  const { transformed, imports } = transform(struct)
  console.log('  after stage 3: ' + JSON.stringify(transformed.map(l => l.content)))
  const { shifted } = shiftIndices(transformed, symbols)
  console.log('  after stage 4: ' + JSON.stringify(shifted.map(l => l.content)))
  const { python } = cleanup(shifted, imports)
  console.log('  final:         ' + JSON.stringify(python))
  console.log()
}
