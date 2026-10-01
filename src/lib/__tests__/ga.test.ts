import { describe, it, expect, beforeEach } from 'vitest'
import { gaEvent, gaPlanValue } from '../ga'

type W = { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
const w = globalThis as unknown as W & { window?: unknown }

beforeEach(() => {
  w.window = globalThis
  delete w.dataLayer
  delete w.gtag
})

describe('gaEvent', () => {
  it('calls gtag once it is loaded', () => {
    const calls: unknown[][] = []
    w.gtag = (...a) => { calls.push(a) }
    gaEvent('purchase', { transaction_id: 'cs_1' })
    expect(calls).toEqual([['event', 'purchase', { transaction_id: 'cs_1' }]])
  })

  it('before gtag.js loads, queues an Arguments object (gtag ignores arrays)', () => {
    gaEvent('begin_checkout', { plan: 'pro' })
    const entry = w.dataLayer![0] as IArguments
    expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
    expect(Array.from(entry)).toEqual(['event', 'begin_checkout', { plan: 'pro' }])
  })
})

describe('gaPlanValue', () => {
  it('prices the paid plans', () => {
    expect(gaPlanValue('pro')).toEqual({ currency: 'USD', value: 19.99 })
    expect(gaPlanValue('team')).toEqual({ currency: 'USD', value: 79 })
  })
  it('sends no value for free, unknown or missing plans', () => {
    expect(gaPlanValue('free')).toEqual({})
    expect(gaPlanValue('constructor')).toEqual({})
    expect(gaPlanValue(null)).toEqual({})
  })
})
