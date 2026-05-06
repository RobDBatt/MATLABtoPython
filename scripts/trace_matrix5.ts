import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'

const input = `function Sp = test(b, d)
switch ftype
  case 'stop'
    Sp = [b + d, b - d];
end
end`
const rq = resolveQuotes(input)
const tk = tokenize(rq)
tk.forEach(l => console.log('L:', JSON.stringify(l.content)))
