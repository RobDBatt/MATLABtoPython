import { cleanup } from '../src/lib/converter/stages/05_cleanup'
import type { StructuredLine } from '../src/lib/converter/types'

// Simulate the Stage 4 output for our test case
const lines: StructuredLine[] = [
  { content: 'def test(b, d):', originalLineStart: 1, originalLineEnd: 1, isComment: false, indentLevel: 0, blockType: null, isBlockOpen: true, isBlockClose: false },
  { content: '# switch ftype  → converted to if/elif', originalLineStart: 2, originalLineEnd: 2, isComment: true, indentLevel: 1, blockType: null, isBlockOpen: false, isBlockClose: false },
  { content: 'elif ftype == \'stop\':', originalLineStart: 3, originalLineEnd: 3, isComment: false, indentLevel: 1, blockType: null, isBlockOpen: true, isBlockClose: false },
  { content: 'Sp = [b + d, b - d]', originalLineStart: 4, originalLineEnd: 4, isComment: false, indentLevel: 2, blockType: null, isBlockOpen: false, isBlockClose: false },
  { content: 'end', originalLineStart: 5, originalLineEnd: 5, isComment: false, indentLevel: 1, blockType: null, isBlockOpen: false, isBlockClose: true },
  { content: 'end', originalLineStart: 6, originalLineEnd: 6, isComment: false, indentLevel: 0, blockType: null, isBlockOpen: false, isBlockClose: true },
]
const imports = new Set<string>(['numpy'])
const { python } = cleanup(lines, imports)
console.log('Stage 5 output:')
python.split('\n').forEach((l, i) => {
  if (l.includes('Sp') || l.includes('b')) console.log('  L' + (i+1) + ':', l)
})
