import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { shiftIndices } from '../src/lib/converter/stages/04_index'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'

const input = `Sp = [b + d, b - d];`
const rq = resolveQuotes(input)
const tk = tokenize(rq)
const symbols = buildSymbolTable(tk)
const struct = detectStructure(tk)
const { transformed } = transform(struct)
console.log('After Stage 3:', transformed.map((l:any) => l.content).join('\n'))
const { shifted } = shiftIndices(transformed, symbols)
console.log('After Stage 4:', shifted.map((l:any) => l.content).join('\n'))
