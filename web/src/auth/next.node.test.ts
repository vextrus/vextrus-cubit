/*
 * `?next=` never leaves the app (the trust boundary: an open redirect through sign-in).
 */
import { describe, expect, it } from 'vitest'
import { safeNext } from './next'

describe('safeNext', () => {
  it.each([
    ['/members', '/members'],
    ['/p/KR-01/takeoff/1', '/p/KR-01/takeoff/1'],
    ['/p/KR-01/takeoff/1?sheet=S-04', '/p/KR-01/takeoff/1?sheet=S-04'],
    ['/p/KR-01/takeoff/1#section', '/p/KR-01/takeoff/1'],
    ['/projects', '/projects'],
  ])('follows an address inside the app: %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected)
  })

  it.each([
    'https://evil.example',
    'http://evil.example/projects',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    '/%2Fevil.example',
    '/%2f%2fevil.example',
    '%2F%2Fevil.example',
    '/%5Cevil.example',
    '/%252F%252Fevil.example',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'javascript%3Aalert(1)',
    '/\tevil.example',
    '/\n/evil.example',
    '/ /evil.example',
    '/sign-in',
    '/sign-in?next=/members',
    '/SIGN-IN',
    '/sign-in/',
    '/%73ign-in',
    '/join',
    '/choose-developer',
    '/access-ended',
    '/no-access',
    'members',
    '',
    'x'.repeat(3000),
  ])('falls back to /projects for %j', (next) => {
    expect(safeNext(next)).toBe('/projects')
  })

  it('falls back for anything that is not a string', () => {
    expect(safeNext(undefined)).toBe('/projects')
    expect(safeNext(null)).toBe('/projects')
    expect(safeNext(['/members'])).toBe('/projects')
    expect(safeNext({ href: '/members' })).toBe('/projects')
  })
})
