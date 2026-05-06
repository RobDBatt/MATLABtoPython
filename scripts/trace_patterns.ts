import { convert } from '../src/lib/converter'

const tests = [
  `colormap gray`,
  `rotate3d on`,
  `drawnow`,
  `shg`,
  `['hello ' num2str(x)]`,
  `[' ' str(x)]`,
  `mex libsvmread.c`,
  `raise ValueError(['bad type'])`,
]
for (const t of tests) {
  const r = convert(t)
  const out = r.python.trim()
  console.log('IN:  ' + t)
  console.log('OUT: ' + out.split('\n').slice(-1)[0])
  console.log()
}
