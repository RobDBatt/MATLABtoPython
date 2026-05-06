import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { shiftIndices } from '../src/lib/converter/stages/04_index'
import { cleanup } from '../src/lib/converter/stages/05_cleanup'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'

const input = `t = '\\\\';`
console.log('IN:        ' + JSON.stringify(input))

const rq = resolveQuotes(input)
console.log('resolveQuotes: ' + JSON.stringify(rq))

const tk = tokenize(rq)
console.log('tokenize:  ' + JSON.stringify(tk.map(l => l.content)))

const symbols = buildSymbolTable(tk)
const struct = detectStructure(tk)
console.log('structure: ' + JSON.stringify(struct.map(l => l.content)))

const { transformed, imports, flags } = transform(struct)
console.log('transform: ' + JSON.stringify(transformed.map(l => l.content)))

const { shifted } = shiftIndices(transformed, symbols)
console.log('shifted:   ' + JSON.stringify(shifted.map(l => l.content)))

const { python } = cleanup(shifted, imports)
console.log('cleanup:   ' + JSON.stringify(python))
