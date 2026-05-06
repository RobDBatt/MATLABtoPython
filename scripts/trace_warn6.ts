import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { shiftIndices } from '../src/lib/converter/stages/04_index'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'

const input = `function test()
warning('vbmc:pbInitFailed', ...
    'Some plausible bounds could not be determined from starting set. Using hard upper/lower bounds for those instead.');
end`
const rq = resolveQuotes(input)
const tk = tokenize(rq)
const symbols = buildSymbolTable(tk)
const struct = detectStructure(tk)
const { transformed, imports } = transform(struct)
const { shifted } = shiftIndices(transformed, symbols)
console.log('Pre-Stage5 lines:')
shifted.forEach(l => {
  if (l.content.includes('warn') || l.content.includes('plausible')) {
    console.log('  content:', JSON.stringify(l.content))
  }
})
