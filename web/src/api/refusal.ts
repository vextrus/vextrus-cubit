/*
 * The refusal reader: every refusal the API sends is the machine's sentence, `{code, params}` (07's
 * guard, `platform/http/acts.py`), worded by the web from the catalogue with `MachineText`. Two other
 * shapes reach the web: a create's refusal that names its field, `{field, message: {code, params}}`
 * (08's `ProjectRefusedOut`), and Ninja's own 422 (`{detail: [...]}`), which carries no code.
 *
 *   try { await unwrap(api.POST('/api/projects', { body })) }
 *   catch (e) { if (e instanceof ApiRefused && e.field === 'code') showUnderCode(e.message) }
 */
import type { MachineMessage } from '@/format/machine'
import { isolateLtr } from '@/ui/notation'
import type { SessionEvent } from './events'

/** An act the API refused: its status, why (null when the body carries no code), and the field at fault. */
export class ApiRefused extends Error {
  override name = 'ApiRefused' // eslint-disable-line lingui/no-unlocalized-strings -- an error class name
  readonly status: number
  /** Why, as the machine's sentence; null for a refusal that carries none (Ninja's 422). */
  readonly refusal: MachineMessage | null
  /** The field at fault, when the operation names one (a create's). */
  readonly field: string | null
  /** The response had no body at all: what a proxy or gateway with nothing behind it answers (query-policy.ts). */
  readonly empty: boolean

  constructor(status: number, refusal: MachineMessage | null, field: string | null = null, empty = false) {
    super(refusal?.code ?? `HTTP ${status}`)
    this.status = status
    this.refusal = refusal
    this.field = field
    this.empty = empty
  }

  /** The refusal's code, or null. */
  get code(): string | null {
    return this.refusal?.code ?? null
  }
}

type Param = string | number | readonly string[]

const isParam = (v: unknown): v is Param => typeof v === 'string' || typeof v === 'number' || (Array.isArray(v) && v.every((x) => typeof x === 'string'))

function isMessage(value: unknown): value is { code: string; params: Readonly<Record<string, Param>> } {
  if (typeof value !== 'object' || value === null) return false
  const { code, params } = value as Record<string, unknown>
  if (typeof code !== 'string' || typeof params !== 'object' || params === null || Array.isArray(params)) return false
  return Object.values(params).every(isParam)
}

/**
 * The machine's sentence with each list parameter (a refusal's `sheets`: "E-02, E-03") as one text,
 * each item isolated left to right, as drawing text is (§1.8).
 */
function sentence(message: { code: string; params: Readonly<Record<string, Param>> }): MachineMessage {
  const params = Object.fromEntries(Object.entries(message.params).map(([name, v]) => [name, typeof v === 'object' ? v.map((x) => isolateLtr(x)).join(', ') : v]))
  return { code: message.code, params }
}

/** Reads a refused response's body into an `ApiRefused`, whatever its shape. */
export function readRefusal(status: number, body: unknown): ApiRefused {
  if (isMessage(body)) return new ApiRefused(status, sentence(body))
  if (typeof body === 'object' && body !== null) {
    const { field, message } = body as Record<string, unknown>
    if (isMessage(message)) return new ApiRefused(status, sentence(message), typeof field === 'string' ? field : null)
  }
  return new ApiRefused(status, null, null, body === '' || body === undefined || body === null)
}

/** The data of a successful call; a refusal is thrown as an `ApiRefused`. */
export async function unwrap<R extends { data?: unknown; error?: unknown; response: Response }>(
  call: Promise<R>,
): Promise<Exclude<R['data'], undefined>> {
  const { data, error, response } = await call
  if (!response.ok) throw readRefusal(response.status, error)
  return data as Exclude<R['data'], undefined>
}

/** A refused response's code, if its body carries one (the response is read: pass a clone). */
export async function refusalCode(response: Response): Promise<string | null> {
  try {
    return readRefusal(response.status, await response.json()).code
  } catch {
    return null
  }
}

const SIGNED_OUT = 'platform.auth.signed_out'
const NO_DEVELOPER = new Set(['platform.auth.choose_developer', 'platform.auth.no_access'])

/**
 * The session event a refusal means: signed out (401 `signed_out`), or no Developer to work in (a
 * revoked or ended Membership: `choose_developer`, `no_access`). A wrong password (401
 * `wrong_credentials`) is none: it is the sign-in form's to show.
 */
export function sessionEventOf(code: string | null): SessionEvent | null {
  if (code === SIGNED_OUT) return 'signed-out'
  if (code !== null && NO_DEVELOPER.has(code)) return 'no-developer'
  return null
}
