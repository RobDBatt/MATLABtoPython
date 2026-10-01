import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PLANS } from '@/lib/plans'
import { findOrCreateUserByEmail } from '@/lib/guest-buyer'

// Guest checkout (Oct 2026). A visitor who is not signed in can pay; Stripe
// collects the email and the webhook puts the plan on the Clerk user with that
// email, creating one if none exists. Stripe and Clerk are faked so the
// routes' own logic is what runs.

process.env.STRIPE_SECRET_KEY = 'sk_test_x'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
process.env.CLERK_SECRET_KEY = 'sk_test_x'
process.env.NEXT_PUBLIC_APP_URL = 'https://mtopython.com'

const PRO_PRICE = (PLANS.pro as { stripePriceId: string }).stripePriceId

let nextEvent: unknown = null
const subRetrieve = vi.fn()
const subUpdate = vi.fn()
const sessionsCreate = vi.fn()
vi.mock('stripe', () => ({
  default: class {
    webhooks = { constructEvent: () => nextEvent }
    subscriptions = { retrieve: subRetrieve, update: subUpdate }
    checkout = { sessions: { create: sessionsCreate } }
    prices = { retrieve: async () => ({ recurring: { interval: 'month' } }) }
  },
}))

let signedInAs: string | null = null
const users = {
  getUserList: vi.fn(),
  createUser: vi.fn(),
  updateUserMetadata: vi.fn(),
}
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: signedInAs }),
  clerkClient: async () => ({ users }),
}))

const { POST: webhook } = await import('../route')
const { POST: checkout } = await import('../../../checkout/route')

const deliver = (session: Record<string, unknown>) => {
  nextEvent = { id: 'evt_1', type: 'checkout.session.completed', data: { object: session } }
  return webhook(new Request('https://mtopython.com/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=x' },
    body: '{}',
  }))
}

const paidSession = (extra: Record<string, unknown>) => ({
  id: 'cs_1',
  mode: 'subscription',
  subscription: 'sub_1',
  customer: 'cus_1',
  metadata: { planId: 'pro' },
  customer_details: { email: 'Engineer@Lab.edu' },
  ...extra,
})

beforeEach(() => {
  signedInAs = null
  for (const f of [subRetrieve, subUpdate, sessionsCreate, ...Object.values(users)]) f.mockReset()
  subRetrieve.mockResolvedValue({ id: 'sub_1', metadata: { planId: 'pro' }, items: { data: [{ price: { id: PRO_PRICE } }] } })
  users.getUserList.mockResolvedValue({ data: [] })
  users.createUser.mockResolvedValue({ id: 'user_new' })
  users.updateUserMetadata.mockResolvedValue({})
  sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_1' })
})

describe('webhook: guest purchase', () => {
  it('creates the account for a new email and grants the plan to it', async () => {
    const res = await deliver(paidSession({}))
    expect(res.status).toBe(200)
    expect(users.createUser).toHaveBeenCalledWith({ emailAddress: ['engineer@lab.edu'], skipPasswordRequirement: true })
    expect(users.updateUserMetadata).toHaveBeenCalledWith('user_new', expect.objectContaining({
      publicMetadata: expect.objectContaining({ plan: 'pro', stripeSubscriptionId: 'sub_1' }),
    }))
  })

  it('stamps the subscription so a later cancellation revokes from this user', async () => {
    await deliver(paidSession({}))
    expect(subUpdate).toHaveBeenCalledWith('sub_1', { metadata: { planId: 'pro', userId: 'user_new' } })
  })

  it('grants to an existing account with that email instead of creating one', async () => {
    users.getUserList.mockResolvedValue({ data: [{ id: 'user_existing' }] })
    await deliver(paidSession({}))
    expect(users.createUser).not.toHaveBeenCalled()
    expect(users.updateUserMetadata).toHaveBeenCalledWith('user_existing', expect.anything())
  })

  it('a Clerk failure throws, so Stripe retries instead of keeping the money', async () => {
    users.getUserList.mockRejectedValue(new Error('clerk down'))
    await expect(deliver(paidSession({}))).rejects.toThrow('clerk down')
    expect(users.updateUserMetadata).not.toHaveBeenCalled()
  })

  it('no email on the session grants nothing', async () => {
    const res = await deliver(paidSession({ customer_details: { email: null } }))
    expect(res.status).toBe(200)
    expect(users.updateUserMetadata).not.toHaveBeenCalled()
  })
})

describe('webhook: signed-in purchase is unchanged', () => {
  it('grants to the checkout userId and touches neither lookup nor the subscription', async () => {
    await deliver(paidSession({ metadata: { planId: 'pro', userId: 'user_signed_in' } }))
    expect(users.getUserList).not.toHaveBeenCalled()
    expect(users.createUser).not.toHaveBeenCalled()
    expect(subUpdate).not.toHaveBeenCalled()
    expect(users.updateUserMetadata).toHaveBeenCalledWith('user_signed_in', expect.anything())
  })

  it('another product on the Stripe account is still ignored', async () => {
    await deliver(paidSession({ metadata: { tier: 'week' } }))
    expect(users.getUserList).not.toHaveBeenCalled()
    expect(users.updateUserMetadata).not.toHaveBeenCalled()
  })
})

describe('checkout route', () => {
  const start = () => checkout(new Request('https://mtopython.com/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://mtopython.com' },
    body: JSON.stringify({ planKey: 'pro' }),
  }))

  it('a guest gets a Stripe session instead of a 401', async () => {
    const res = await start()
    expect(res.status).toBe(200)
    expect((await res.json()).url).toContain('checkout.stripe.com')
    const params = sessionsCreate.mock.calls[0][0]
    expect(params.customer_email).toBeUndefined() // Stripe collects it
    expect(params.metadata).toEqual({ planId: 'pro' })
    expect(params.subscription_data).toEqual({ metadata: { planId: 'pro' } })
  })

  it('a signed-in buyer still carries their userId', async () => {
    signedInAs = 'user_signed_in'
    await start()
    const params = sessionsCreate.mock.calls[0][0]
    expect(params.metadata).toEqual({ userId: 'user_signed_in', planId: 'pro' })
    expect(params.subscription_data).toEqual({ metadata: { userId: 'user_signed_in', planId: 'pro' } })
  })
})

describe('findOrCreateUserByEmail', () => {
  it('recovers when the create races another delivery', async () => {
    users.getUserList
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 'user_raced' }] })
    users.createUser.mockRejectedValue(Object.assign(new Error('exists'), { status: 422 }))
    expect(await findOrCreateUserByEmail(users, 'a@b.co')).toBe('user_raced')
  })

  it('rethrows when the create fails and no user appeared', async () => {
    users.createUser.mockRejectedValue(new Error('boom'))
    await expect(findOrCreateUserByEmail(users, 'a@b.co')).rejects.toThrow('boom')
  })
})
