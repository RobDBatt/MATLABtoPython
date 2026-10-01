import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  it('waits for gtag when it is not loaded yet, instead of dropping the event', () => {
    vi.useFakeTimers()
    const calls: unknown[][] = []
    gaEvent('purchase', { transaction_id: 'cs_2' })
    expect(calls).toEqual([])
    w.gtag = (...a) => { calls.push(a) }
    vi.advanceTimersByTime(250)
    expect(calls).toEqual([['event', 'purchase', { transaction_id: 'cs_2' }]])
    vi.useRealTimers()
  })

  it('gives up quietly if GA never loads', () => {
    vi.useFakeTimers()
    gaEvent('purchase', { transaction_id: 'cs_3' })
    vi.advanceTimersByTime(20_000)
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
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
