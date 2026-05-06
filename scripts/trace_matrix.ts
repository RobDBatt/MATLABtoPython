import { convert } from '../src/lib/converter'

const cases = [
  `Sp = [b + d, b - d];`,
  `pred_boxes = [pred_ctr_x - 0.5*pred_w, pred_ctr_y - 0.5*pred_h, pred_ctr_x + 0.5*pred_w, pred_ctr_y + 0.5*pred_h];`,
]
for (const m of cases) {
  const result = convert(m)
  console.log('IN:', m)
  console.log('OUT:', result.python.trim())
  console.log()
}
