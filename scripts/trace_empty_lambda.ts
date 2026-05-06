import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { shiftIndices } from '../src/lib/converter/stages/04_index'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'
import { cleanup } from '../src/lib/converter/stages/05_cleanup'

const input = `f = @() conf_override;`
const rq = resolveQuotes(input)
const tk = tokenize(rq)
const symbols = buildSymbolTable(tk)
const struct = detectStructure(tk)
const { transformed, imports } = transform(struct)
console.log('Stage3:', transformed.map((l:any) => l.content).join(' | '))
const { shifted } = shiftIndices(transformed, symbols)
console.log('Stage4:', shifted.map((l:any) => l.content).join(' | '))
const { python } = cleanup(shifted, imports)
console.log('Stage5:', python.trim())
