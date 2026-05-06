import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'

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
struct.forEach(l => {
  if (!l.isComment && l.content.trim()) {
    console.log('Stage2 blockType=' + l.blockType + ' content=' + l.content)
  }
})
const { transformed } = transform(struct)
transformed.forEach(l => {
  if (l.content.trim()) console.log('Stage3:', l.content)
})
