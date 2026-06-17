/**
 * Browser-side telemetry client (mirrors VBAtoPython).
 *
 * Owns consent state + the anonymous, monthly-rotating session id (both in
 * localStorage), and exposes `telemetryFields()` — the `{ telemetry_consent,
 * session_id }` the converter widget piggybacks onto its /api/convert request
 * so the server-side mirror logs the event.
 *
 * No source code, identity, or IP is ever handled here — only consent booleans
 * and a random session uuid.
 */
import { CONSENT_VERSION } from './types'

const CONSENT_KEY = 'mtp_telemetry_consent' // value: `${"on"|"off"}:${version}`
const SESSION_KEY = 'mtp_telemetry_session' // value: `${uuid}:${YYYY-MM}`

const hasWindow = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = new Uint8Array(16)
  ;(crypto as Crypto).getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
}

/** Stable per-device session id that rotates at each month boundary. */
export function getSessionId(): string {
  if (!hasWindow()) return ''
  const month = currentMonth()
  const stored = window.localStorage.getItem(SESSION_KEY)
  if (stored) {
    const [id, m] = stored.split(':')
    if (m === month && id) return id
  }
  const id = uuid()
  try { window.localStorage.setItem(SESSION_KEY, `${id}:${month}`) } catch { /* ignore */ }
  return id
}

/** Has the user made a consent choice under the CURRENT policy version? */
export function hasConsentChoice(): boolean {
  if (!hasWindow()) return false
  const v = window.localStorage.getItem(CONSENT_KEY)
  if (!v) return false
  const [, ver] = v.split(':')
  return Number(ver) === CONSENT_VERSION
}

/** Current consent. If undecided: unsigned ON (free tier), signed-in OFF (paying). */
export function getConsent(isSignedIn: boolean): boolean {
  if (!hasWindow()) return false
  const v = window.localStorage.getItem(CONSENT_KEY)
  if (v) {
    const [state, ver] = v.split(':')
    if (Number(ver) === CONSENT_VERSION) return state === 'on'
  }
  return !isSignedIn // default
}

export function setConsent(on: boolean): void {
  if (!hasWindow()) return
  try { window.localStorage.setItem(CONSENT_KEY, `${on ? 'on' : 'off'}:${CONSENT_VERSION}`) } catch { /* ignore */ }
}

/** The fields a converter widget adds to its request body so the server-side
 *  mirror logs the event. Empty object when consent is off (nothing is sent). */
export function telemetryFields(isSignedIn: boolean): { telemetry_consent?: true; session_id?: string } {
  if (!getConsent(isSignedIn)) return {}
  return { telemetry_consent: true, session_id: getSessionId() }
}
