import { readFileSync } from 'node:fs'
import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { shiftIndices } from '../src/lib/converter/stages/04_index'
import { cleanup } from '../src/lib/converter/stages/05_cleanup'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'

const matlab = readFileSync('scripts/corpus/repos/PRMLT/chapter09/mixGaussEm.m', 'utf8')
const rq = resolveQuotes(matlab)
const tk = tokenize(rq)
const symbols = buildSymbolTable(tk)
const struct = detectStructure(tk)
const { transformed, imports } = transform(struct)
const { shifted } = shiftIndices(transformed, symbols)
console.log('=== After stage 4 (lines mentioning bsxfun/loggausspdf) ===')
for (const l of shifted) {
  if (/bsxfun|loggausspdf/.test(l.content)) console.log('  ' + l.content)
}
const { python } = cleanup(shifted, imports)
console.log('\n=== After stage 5 (lines mentioning bsxfun/loggausspdf) ===')
for (const line of python.split('\n')) {
  if (/bsxfun|loggausspdf/.test(line)) console.log('  ' + line)
}
