import { convert } from '../src/lib/converter'
import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { shiftIndices } from '../src/lib/converter/stages/04_index'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'
import { cleanup } from '../src/lib/converter/stages/05_cleanup'

const input = `function Sp = test(b, d)
switch ftype
  case 'stop'
    Sp = [b + d, b - d];
end
end`
const rq = resolveQuotes(input)
const tk = tokenize(rq)
const symbols = buildSymbolTable(tk)
const struct = detectStructure(tk)
const { transformed, imports } = transform(struct)
const { shifted } = shiftIndices(transformed, symbols)
console.log('After Stage 4:')
shifted.forEach(l => { if (l.content.trim()) console.log(' ', l.content) })
const { python } = cleanup(shifted, imports)
console.log('\nAfter Stage 5:')
python.split('\n').filter(l => l.trim()).forEach(l => console.log(' ', l))
