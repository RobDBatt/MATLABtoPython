import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { createRouteMatcher } from '@clerk/nextjs/server'
import { PUBLIC_ROUTES } from '../publicRoutes'

const isPublic = createRouteMatcher(PUBLIC_ROUTES)
const at = (path: string) => isPublic(new NextRequest(`https://mtopython.com${path}`))

describe('public routes', () => {
  it('lets guests send telemetry', () => {
    expect(at('/api/telemetry')).toBe(true)
  })

  it('lets guests read the telemetry privacy page', () => {
    expect(at('/privacy/telemetry')).toBe(true)
  })

  it('keeps the converter and pricing public', () => {
    for (const p of ['/', '/convert', '/pricing', '/api/convert', '/learn/matlab-license-cost-2026']) {
      expect(at(p)).toBe(true)
    }
  })

  it('lets guests start checkout', () => {
    expect(at('/api/checkout')).toBe(true)
  })

  it('keeps the account route signed-in only', () => {
    expect(at('/api/me')).toBe(false)
  })
})
