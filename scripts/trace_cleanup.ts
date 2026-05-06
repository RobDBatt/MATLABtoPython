import { readFileSync } from 'node:fs'
import { resolveQuotes } from '../src/lib/converter/tokenizer/string-extractor'
import { tokenize } from '../src/lib/converter/stages/01_tokenize'
import { detectStructure } from '../src/lib/converter/stages/02_structure'
import { transform } from '../src/lib/converter/stages/03_transform'
import { shiftIndices } from '../src/lib/converter/stages/04_index'
import { buildSymbolTable } from '../src/lib/converter/analysis/scope'

const matlab = readFileSync('scripts/corpus/repos/PRMLT/chapter09/mixGaussEm.m', 'utf8')
const rq = resolveQuotes(matlab)
const tk = tokenize(rq)
const symbols = buildSymbolTable(tk)
const struct = detectStructure(tk)
const { transformed } = transform(struct)
const { shifted } = shiftIndices(transformed, symbols)

// Now manually walk a single line through 05_cleanup logic
const target = shifted.find((l) => l.content.includes('bsxfun(minus,X,mu['))!
console.log('TARGET STAGE-4 LINE:', JSON.stringify(target.content))

// Apply just the regex passes from the post-processing block one at a time
let line = target.content

// 1. The `\b(\w+)\(:` regex
const before1 = line
line = line.replace(/\b(\w+)\(:/g, (match, varName, offset) => {
  const startIdx = (offset as number) + (varName as string).length
  let depth = 1
  let endIdx = startIdx + 1
  while (endIdx < line.length && depth > 0) {
    if (line[endIdx] === '(') depth++
    else if (line[endIdx] === ')') depth--
    endIdx++
  }
  if (depth === 0) {
    const inner = line.substring(startIdx + 1, endIdx - 1)
    if (inner.startsWith(':')) {
      return `${varName}[:`
    }
  }
  return match as string
})
if (line !== before1) console.log('After \\w+\\(: regex:', JSON.stringify(line))

// 2. Bracket-balancer
const cond = /\w+\[:/.test(line) && !/\w+\[:\]/.test(line)
console.log('Bracket-balancer condition:', cond)
if (cond) {
  let brackets = 0, parens = 0
  const chars = line.split('')
  for (let ci = 0; ci < chars.length; ci++) {
    if (chars[ci] === '[') brackets++
    else if (chars[ci] === ']') brackets--
    else if (chars[ci] === '(') parens++
    else if (chars[ci] === ')') {
      parens--
      if (parens < 0 && brackets > 0) {
        chars[ci] = ']'
        brackets--
        parens++
      }
    }
  }
  line = chars.join('')
  console.log('After bracket-balancer:', JSON.stringify(line))
}
