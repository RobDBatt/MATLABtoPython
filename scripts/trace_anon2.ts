import { convert } from '../src/lib/converter'
const tests = [
  `classdef PGraph < matlab.mixin.Copyable`,
  `f = @() conf_override;`,
]
for (const t of tests) {
  const r = convert(t)
  console.log('IN:', t)
  console.log('OUT:')
  r.python.trim().split('\n').forEach((l,i) => console.log('  '+(i+1)+' '+l))
  console.log()
}
