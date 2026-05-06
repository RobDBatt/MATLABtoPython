import { convert } from '../src/lib/converter'
const tests = [
  `f = @() some_expr;`,
  `f = @() conf_override;`,
  `classdef PGraph < matlab.mixin.Copyable`,
  `classdef Foo < handle`,
]
for (const t of tests) {
  const r = convert(t)
  console.log('IN:', t, '→', r.python.trim().split('\n').pop())
}
