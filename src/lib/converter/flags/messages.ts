import type { FlagType } from '../types'

/** Prefix emitted in output code for each flag type */
export const FLAG_PREFIXES: Record<FlagType, string> = {
  WARNING: '# ⚠ WARNING:',
  INDEX: '# 🔢 INDEX:',
  TOOLBOX: '# 📦 TOOLBOX:',
  TODO: '# 📋 TODO:',
  UNSUPPORTED: '# ❌ UNSUPPORTED:',
}

/** Human-readable label for the compatibility report */
export const FLAG_LABELS: Record<FlagType, string> = {
  WARNING: 'Converted but may behave differently',
  INDEX: 'Index offset applied — verify correctness',
  TOOLBOX: 'Toolbox function mapped — verify behavior',
  TODO: 'Manual conversion needed',
  UNSUPPORTED: 'Cannot be converted',
}
