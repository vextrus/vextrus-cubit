/*
 * The MD's Step 1 notice of who from Vextrus has access (m0-screens §6.12; ts27g6 pins its words and
 * Revoke): which access it names. Only the MD's top bar carries it; it names current Vextrus access
 * that may open this project, never an Ended or revoked one, nor one given other projects only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\u00a0/g, ' ')

function topBar(): string {
  return clean(document.querySelector('[data-region="top-bar"]')?.textContent)
}

async function step1(as: string, api: FakeApi) {
  await mountApp('/p/KR-01/takeoff/1', { as, api })
  await waitFor(() => expect(topBar()).toContain('Kadam Residence'))
}

describe('the MD’s Vextrus access notice', () => {
  it('names each current access that may open the project, and no other', async () => {
    const api = new FakeApi()
    const shapla = api.developer('Shapla Homes Ltd')
    const md = api.user(PEOPLE.md).id
    const bp02 = api.project('BP-02')
    api.addMembership(shapla, api.addUser('sadia@vextrus.example', 'Sadia Karim', true), 'vextrus_engineer', {
      invitedBy: md,
      projectIds: [bp02.id],
      expiresAt: '2026-10-20T17:59:00Z',
    })
    api.addMembership(shapla, api.addUser('rumi@vextrus.example', 'Rumi Das', true), 'vextrus_engineer', {
      invitedBy: md,
      expiresAt: '2026-09-25T17:59:00Z',
    })
    await step1(PEOPLE.md, api)
    await waitFor(() => expect(topBar()).toContain('Arif Rahman, Vextrus Engineer, has access until 26 Oct 2026'))
    expect(topBar()).not.toContain('Sadia Karim')
    expect(topBar()).not.toContain('Rumi Das')
  })

  it('says nothing in a QS’s top bar', async () => {
    const api = new FakeApi()
    await step1(PEOPLE.qs, api)
    expect(topBar()).not.toContain('has access until')
    expect(api.calls()).not.toContain('GET /api/members')
  })
})
