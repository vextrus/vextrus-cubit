/*
 * The role rule mirrors the server's (`platform/services/auth.py` ROLES, `services/invitations.py`
 * _INVITES; m0-screens §1.4), so the web never offers what the API refuses.
 */
import { describe, expect, it } from 'vitest'
import type { Role } from '@/app/session'
import { can, invitableRoles, mayCreateProject, readOnlyRole, type Grant } from './can'

const ALL: readonly Role[] = ['qs', 'md', 'vextrus_engineer', 'guest']

describe('can', () => {
  it.each<[Grant, readonly Role[]]>([
    ['look', ['qs', 'md', 'vextrus_engineer', 'guest']],
    ['change', ['qs', 'vextrus_engineer']],
    ['people', ['qs', 'md', 'vextrus_engineer']],
    ['access', ['qs', 'md']],
    ['acts', ['qs', 'md']],
  ])('%s: exactly %j', (grant, roles) => {
    expect(ALL.filter((role) => can({ role }, grant))).toEqual(roles)
  })
})

describe('invitableRoles', () => {
  it('lets the MD invite a QS, an MD, a Guest or a Vextrus Engineer, in the dialog’s order', () => {
    expect(invitableRoles({ role: 'md' })).toEqual(['qs', 'md', 'guest', 'vextrus_engineer'])
  })
  it('lets a QS invite a Vextrus Engineer only', () => {
    expect(invitableRoles({ role: 'qs' })).toEqual(['vextrus_engineer'])
  })
  it('lets a Vextrus Engineer and a Guest invite no one', () => {
    expect(invitableRoles({ role: 'vextrus_engineer' })).toEqual([])
    expect(invitableRoles({ role: 'guest' })).toEqual([])
  })
})

describe('mayCreateProject', () => {
  it('is the QS and the Vextrus Engineer with every project, never the MD, a Guest or a member given chosen projects', () => {
    expect(mayCreateProject({ role: 'qs', scope: 'all' })).toBe(true)
    expect(mayCreateProject({ role: 'vextrus_engineer', scope: 'all' })).toBe(true)
    expect(mayCreateProject({ role: 'qs', scope: ['BP-02'] })).toBe(false)
    expect(mayCreateProject({ role: 'vextrus_engineer', scope: ['KR-01'] })).toBe(false)
    expect(mayCreateProject({ role: 'md', scope: 'all' })).toBe(false)
    expect(mayCreateProject({ role: 'guest', scope: ['KR-01'] })).toBe(false)
  })
})

describe('readOnlyRole', () => {
  it('is the MD and a Guest', () => {
    expect(ALL.map((role) => readOnlyRole({ role }))).toEqual([null, 'md', null, 'guest'])
  })
})
