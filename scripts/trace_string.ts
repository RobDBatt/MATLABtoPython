import { convert } from '../src/lib/converter'

const cases = [
  `s = strrep(s, 'a', 'b');`,             // no escapes
  `s = strrep(s, '\\\\', 'b');`,          // two backslashes only in 1st arg
  `s = strrep(s, 'a', '\\\\');`,          // two backslashes only in 2nd arg
  `s = strrep(s, '\\\\', '\\\\');`,       // two backslashes both args
  `t = '\\\\';`,                          // bare assign with two-backslash string
  `t = 'foo';`,                           // bare assign with simple string
]

for (const c of cases) {
  console.log('IN:  ' + JSON.stringify(c))
  console.log('OUT: ' + JSON.stringify(convert(c).python))
  console.log()
}
