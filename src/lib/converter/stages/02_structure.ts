import type { LogicalLine, StructuredLine, BlockType } from '../types'

/**
 * Stage 2: Structure Detection
 *
 * Detects block boundaries and builds an indentation tree.
 * MATLAB uses `end` to close all block types. Python uses indentation.
 * This stage tags each line with its indent level and block type.
 */
export function detectStructure(lines: LogicalLine[]): StructuredLine[] {
  const result: StructuredLine[] = []
  const blockStack: BlockType[] = []

  for (const line of lines) {
    if (line.isComment || line.content.trim() === '') {
      result.push({
        ...line,
        indentLevel: blockStack.length,
        blockType: null,
        isBlockOpen: false,
        isBlockClose: false,
      })
      continue
    }

    const trimmed = line.content.trim()
    const blockInfo = detectBlock(trimmed)

    if (blockInfo.isClose) {
      // `end` keyword — pop the block stack
      if (blockStack.length > 0) {
        blockStack.pop()
      }
      result.push({
        ...line,
        indentLevel: blockStack.length,
        blockType: null,
        isBlockOpen: false,
        isBlockClose: true,
      })
      continue
    }

    // Handle blocks that change indent but don't open a new block (elseif, else, case, otherwise, catch)
    if (blockInfo.isContinuation) {
      // Temporarily dedent for the continuation keyword
      const level = Math.max(0, blockStack.length - 1)
      result.push({
        ...line,
        indentLevel: level,
        blockType: blockInfo.type,
        isBlockOpen: false,
        isBlockClose: false,
      })
      continue
    }

    if (blockInfo.isOpen && blockInfo.type) {
      result.push({
        ...line,
        indentLevel: blockStack.length,
        blockType: blockInfo.type,
        isBlockOpen: true,
        isBlockClose: false,
      })
      blockStack.push(blockInfo.type)
      continue
    }

    // Regular line — no block change
    result.push({
      ...line,
      indentLevel: blockStack.length,
      blockType: null,
      isBlockOpen: false,
      isBlockClose: false,
    })
  }

  return result
}

interface BlockDetection {
  type: BlockType | null
  isOpen: boolean
  isClose: boolean
  isContinuation: boolean
}

const BLOCK_OPEN_PATTERNS: Array<{ pattern: RegExp; type: BlockType }> = [
  { pattern: /^function\b/, type: 'function' },
  { pattern: /^for\b/, type: 'for' },
  { pattern: /^parfor\b/, type: 'parfor' },
  { pattern: /^while\b/, type: 'while' },
  { pattern: /^if\b/, type: 'if' },
  { pattern: /^switch\b/, type: 'switch' },
  { pattern: /^try\b/, type: 'try' },
  { pattern: /^classdef\b/, type: 'classdef' },
]

const BLOCK_CONTINUATION_PATTERNS: Array<{ pattern: RegExp; type: BlockType }> = [
  { pattern: /^elseif\b/, type: 'elseif' },
  { pattern: /^else\b/, type: 'else' },
  { pattern: /^case\b/, type: 'case' },
  { pattern: /^otherwise\b/, type: 'otherwise' },
  { pattern: /^catch\b/, type: 'catch' },
]

function detectBlock(trimmedLine: string): BlockDetection {
  // Check for `end` (standalone or end of line)
  if (/^end\s*$/.test(trimmedLine) || /^end[;,\s%]/.test(trimmedLine)) {
    return { type: null, isOpen: false, isClose: true, isContinuation: false }
  }

  // Check for continuation keywords (elseif, else, case, otherwise, catch)
  for (const { pattern, type } of BLOCK_CONTINUATION_PATTERNS) {
    if (pattern.test(trimmedLine)) {
      return { type, isOpen: false, isClose: false, isContinuation: true }
    }
  }

  // Check for block openers
  for (const { pattern, type } of BLOCK_OPEN_PATTERNS) {
    if (pattern.test(trimmedLine)) {
      return { type, isOpen: true, isClose: false, isContinuation: false }
    }
  }

  return { type: null, isOpen: false, isClose: false, isContinuation: false }
}
