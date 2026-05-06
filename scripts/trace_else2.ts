import { convert } from '../src/lib/converter'

const cases = [
  // Real MATLAB (no trailing colon on if)
  `function y = f(x)\nif nargout\n  y = x;\nend\nend`,
  // else with comma separator
  `function y = f(x)\nif x > 0\n  y = 1;\nelse, y = 0;\nend\nend`,
]
for (const input of cases) {
  const result = convert(input)
  console.log('IN:', JSON.stringify(input.split('\n')[1]))
  console.log('OUT:', result.python.trim().split('\n').slice(0,6).join('\n'))
  console.log()
}
