export interface NumericOutput {
  shape: number[]
  real: number | number[]
  imag?: number | number[]
}

export type Workspace = Record<string, NumericOutput | null>

export interface OutputContract {
  probe?: string[]
  indexOutputs?: string[]
  flatColumnOutputs?: string[]
}

const RTOL = 1e-6
const ATOL = 1e-9

function values(data: number | number[]): number[] {
  return Array.isArray(data) ? data : [data]
}

function sameShape(expected: number[], actual: number[], allowFlatColumn: boolean): boolean {
  if (actual.length === 0) return expected.every(n => n === 1)
  if (actual.length === 1 && expected.length === 2) {
    if (expected[0] === 1 && expected[1] === actual[0]) return true
    if (allowFlatColumn && expected[1] === 1 && expected[0] === actual[0]) return true
  }
  return expected.length === actual.length && expected.every((n, i) => n === actual[i])
}

function closeEnough(expected: number[], actual: number[]): boolean {
  return expected.length === actual.length && expected.every((n, i) =>
    Math.abs(n - actual[i]) <= ATOL + RTOL * Math.abs(n),
  )
}

export function compareWorkspaces(reference: Workspace, candidate: Workspace, contract: OutputContract = {}) {
  const names = contract.probe ?? Object.keys(reference)
  const missingReference = names.filter(name => !Object.hasOwn(reference, name))
  const mismatches: string[] = []
  const indexMatches: string[] = []
  let compared = 0

  for (const name of names) {
    if (!Object.hasOwn(reference, name)) continue
    const expected = reference[name]
    if (!expected) continue
    compared++
    const actual = Object.hasOwn(candidate, name) ? candidate[name] : null
    if (!actual) {
      mismatches.push(`${name} (missing numeric output)`)
      continue
    }
    if (!sameShape(expected.shape, actual.shape, contract.flatColumnOutputs?.includes(name) ?? false)) {
      mismatches.push(`${name} (shape [${actual.shape}] vs [${expected.shape}])`)
      continue
    }

    const expectedReal = values(expected.real)
    const actualReal = values(actual.real)
    const zeros = expectedReal.map(() => 0)
    const expectedImag = expected.imag === undefined ? zeros : values(expected.imag)
    const actualImag = actual.imag === undefined ? zeros : values(actual.imag)
    const isIndex = contract.indexOutputs?.includes(name) ?? false
    const realMatches = isIndex
      ? expectedReal.length === actualReal.length && expectedReal.every((n, i) =>
        Number.isInteger(n) && Number.isInteger(actualReal[i]) && n === actualReal[i] + 1,
      )
      : closeEnough(expectedReal, actualReal)
    if (!realMatches || !closeEnough(expectedImag, actualImag)) mismatches.push(`${name} (values)`)
    else if (isIndex) indexMatches.push(name)
  }

  return { compared, mismatches, missingReference, indexMatches }
}
