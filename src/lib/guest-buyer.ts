/**
 * Guest checkout: the account a purchase belongs to when the buyer was not
 * signed in.
 *
 * Stripe collects the email on its checkout page. The paid plan has to land
 * on a Clerk user, so the webhook finds the user with that email or creates
 * one. Sign-in on this instance is by emailed code, so the buyer gets in by
 * signing in with the address they paid with — no password is ever set.
 * Creating the address through the Backend API marks it verified; the code
 * sent at sign-in is what proves the buyer owns it.
 */

/** The slice of Clerk's `users` API this needs — structural, so tests can fake it. */
export interface ClerkUsersApi {
  getUserList(params: { emailAddress: string[] }): Promise<{ data: Array<{ id: string }> }>
  createUser(params: { emailAddress: string[]; skipPasswordRequirement: boolean }): Promise<{ id: string }>
}

/**
 * The Clerk user id for `rawEmail`, creating the user if none exists.
 * Throws on any Clerk failure so the webhook returns 500 and Stripe retries —
 * a retry finds the user created on the first attempt.
 */
export async function findOrCreateUserByEmail(users: ClerkUsersApi, rawEmail: string): Promise<string> {
  const email = rawEmail.trim().toLowerCase()
  const existing = await users.getUserList({ emailAddress: [email] })
  if (existing.data.length > 0) return existing.data[0].id

  try {
    const created = await users.createUser({ emailAddress: [email], skipPasswordRequirement: true })
    return created.id
  } catch (err) {
    // Two deliveries of the same event racing, or the buyer signing up in the
    // seconds between our lookup and the create. Either way the user exists now.
    const again = await users.getUserList({ emailAddress: [email] })
    if (again.data.length > 0) return again.data[0].id
    throw err
  }
}
