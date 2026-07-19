import { describe, it, expect } from 'vitest'
import { PLANS } from '../plans'
import { isOwnPlan, isClerkUserNotFound, tolerateMissingUser } from '../webhook-guards'

describe('cross-product event scoping', () => {
  it('accepts every plan this site actually sells', () => {
    for (const id of Object.keys(PLANS)) expect(isOwnPlan(id)).toBe(true)
  })
  it('rejects an event with no planId (the foreign-product case)', () => {
    expect(isOwnPlan(undefined)).toBe(false)
    expect(isOwnPlan('')).toBe(false)
  })
  it("rejects another product's plan key", () => {
    expect(isOwnPlan('payroll_pro')).toBe(false)
  })
  it('is not fooled by inherited Object properties', () => {
    // A naive `planId in PLANS` would return true for these.
    expect(isOwnPlan('constructor')).toBe(false)
    expect(isOwnPlan('toString')).toBe(false)
  })
})

describe('Clerk error classification', () => {
  it('detects the real 404 shape seen in production', () => {
    // Verbatim from the Vercel runtime log for user cmq66vrnq0001zgc47urv5zn1.
    expect(isClerkUserNotFound({
      clerkError: true, status: 404, code: 'api_response_error',
      errors: [{ code: 'resource_not_found', message: 'not found' }],
    })).toBe(true)
  })
  it('treats transient failures as retryable, not permanent', () => {
    expect(isClerkUserNotFound({ status: 500, errors: [{ code: 'internal_error' }] })).toBe(false)
    expect(isClerkUserNotFound({ status: 429, errors: [{ code: 'rate_limited' }] })).toBe(false)
    expect(isClerkUserNotFound(new Error('socket hang up'))).toBe(false)
    expect(isClerkUserNotFound(null)).toBe(false)
    expect(isClerkUserNotFound(undefined)).toBe(false)
  })
  it('does not treat a bare 404 without the error code as user-not-found', () => {
    expect(isClerkUserNotFound({ status: 404 })).toBe(false)
  })
})

describe('tolerateMissingUser', () => {
  const notFound = Object.assign(new Error('Not Found'), {
    status: 404,
    errors: [{ code: 'resource_not_found', message: 'not found' }],
  })

  it('swallows a missing user so Stripe stops retrying a hopeless event', async () => {
    await expect(
      tolerateMissingUser(() => Promise.reject(notFound), { userId: 'cmq66vrnq0001zgc47urv5zn1' }),
    ).resolves.toBeUndefined()
  })

  it('rethrows transient failures so Stripe DOES retry', async () => {
    const transient = Object.assign(new Error('Bad Gateway'), { status: 502 })
    await expect(
      tolerateMissingUser(() => Promise.reject(transient), {}),
    ).rejects.toThrow('Bad Gateway')
  })

  it('passes through on success', async () => {
    let ran = false
    await tolerateMissingUser(async () => { ran = true }, {})
    expect(ran).toBe(true)
  })
})
