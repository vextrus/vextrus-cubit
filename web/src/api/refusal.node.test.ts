/*
 * Every refusal is read into its words (`{code, params}`), whatever its shape.
 */
import { describe, expect, it } from 'vitest'
import { ApiRefused, readRefusal, sessionEventOf, unwrap } from './refusal'

describe('readRefusal', () => {
  it('reads the guard’s refusal, `{code, params}`', () => {
    const r = readRefusal(403, { code: 'platform.auth.not_allowed', params: { role: 'guest' } })
    expect(r).toBeInstanceOf(ApiRefused)
    expect([r.status, r.refusal, r.field, r.code]).toEqual([403, { code: 'platform.auth.not_allowed', params: { role: 'guest' } }, null, 'platform.auth.not_allowed'])
  })

  it('reads a create’s refusal naming its field, `{field, message}`', () => {
    const r = readRefusal(409, { field: 'code', message: { code: 'projects.projects.code_taken', params: { code: 'KR-01', name: 'Kadam Residence' } } })
    expect([r.field, r.refusal?.code, r.refusal?.params]).toEqual(['code', 'projects.projects.code_taken', { code: 'KR-01', name: 'Kadam Residence' }])
  })

  it('reads a refusal with a list of strings as a parameter (one_source, held_file: `sheets`), its items joined', () => {
    const r = readRefusal(409, { code: 'takeoff.step1.one_source', params: { sheets: ['E-02', 'E-03'], count: 2 } })
    expect(r.code).toBe('takeoff.step1.one_source')
    expect(r.refusal?.params.count).toBe(2)
    expect(String(r.refusal?.params.sheets).replace(/[\u2066-\u2069]/g, '')).toBe('E-02, E-03')
  })

  it.each([{ sheets: [1, 2] }, { sheets: ['A', { b: 1 }] }, { sheets: [['A']] }])('reads a list of anything but strings (%j) as no words', (params) => {
    expect(readRefusal(409, { code: 'x.y.z', params }).refusal).toBeNull()
  })

  it('reads Ninja’s 422, which carries no code, as a refusal without words', () => {
    const r = readRefusal(422, { detail: [{ type: 'missing', loc: ['body', 'payload', 'email'] }] })
    expect([r.status, r.refusal, r.code]).toEqual([422, null, null])
  })

  it.each([null, 'Forbidden', { code: 3, params: {} }, { code: 'x.y.z', params: [] }, { code: 'x.y.z', params: { a: { b: 1 } } }])('reads a body of another shape (%j) as no words', (body) => {
    expect(readRefusal(500, body).refusal).toBeNull()
  })
})

describe('unwrap', () => {
  it('gives the data of a success and throws the refusal of a failure', async () => {
    await expect(unwrap(Promise.resolve({ data: { ok: 1 }, response: new Response(null, { status: 200 }) }))).resolves.toEqual({ ok: 1 })
    await expect(
      unwrap(Promise.resolve({ error: { code: 'platform.auth.signed_out', params: {} }, response: new Response(null, { status: 401 }) })),
    ).rejects.toMatchObject({ status: 401, code: 'platform.auth.signed_out' })
  })
})

describe('sessionEventOf', () => {
  it('is signed out only for the signed-out refusal, never a wrong password', () => {
    expect(sessionEventOf('platform.auth.signed_out')).toBe('signed-out')
    expect(sessionEventOf('platform.auth.wrong_credentials')).toBeNull()
  })
  it('is no Developer for a Membership revoked or ended mid-session', () => {
    expect(sessionEventOf('platform.auth.choose_developer')).toBe('no-developer')
    expect(sessionEventOf('platform.auth.no_access')).toBe('no-developer')
  })
  it('is nothing for any other refusal', () => {
    expect(sessionEventOf('platform.auth.not_allowed')).toBeNull()
    expect(sessionEventOf('platform.auth.csrf_failed')).toBeNull()
    expect(sessionEventOf(null)).toBeNull()
  })
})
