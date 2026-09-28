/*
 * `/api/me` and `/api/projects` as the web reads them: the one mapping each (the Market on the web;
 * #75's "Access ended" facts), and where each signed-in user belongs (m0-screens §4.1, §4.2).
 */
import { describe, expect, it } from 'vitest'
import type { EndedOut75, MeOut75 } from '@/api/until75'
import { ENGLISH, type Language } from '@/i18n/languages'
import { BANGLADESH_OUT } from './seed/api.fixture'
import { BANGLADESH } from './seed/demo.fixture'
import { gateOf, marketFormat, meFrom, sessionFrom, NoDeveloper } from './session'

const SHAPLA = 'd-shapla'
const MEGHNA = 'd-meghna'

function me(over: Partial<MeOut75> = {}): MeOut75 {
  return {
    user: { id: 'u-1', name: 'Nusrat Jahan', email: 'nusrat@shapla-homes.example' },
    developer_id: SHAPLA,
    memberships: [{ id: 'm-1', developer_id: SHAPLA, developer_name: 'Shapla Homes Ltd', role: 'qs', project_ids: [], expires_at: null }],
    ended: [],
    ended_membership_id: null,
    market: BANGLADESH_OUT,
    ...over,
  }
}

const ENDED: EndedOut75 = {
  membership_id: 'm-9',
  developer_id: SHAPLA,
  developer_name: 'Shapla Homes Ltd',
  role: 'vextrus_engineer',
  ended_at: '2026-09-26T09:00:00Z',
  how: 'revoked',
  revoked_by: 'Kamal Uddin',
  project_ids: [],
  market: BANGLADESH_OUT,
}

describe('marketFormat (the Market on the web)', () => {
  it('maps the API’s Market to the formatters’ profile: Bangladesh’s is the static copy’s', () => {
    expect(marketFormat(BANGLADESH_OUT)).toEqual(BANGLADESH)
  })

  it('activates only a shipped language, with the web’s own direction; any other falls back to the first shipped', () => {
    const pseudo: Language = { code: 'xx', dir: 'rtl' }
    expect(marketFormat({ ...BANGLADESH_OUT, language: { code: 'xx', direction: 'rtl' } }).language).toBe(ENGLISH)
    expect(marketFormat({ ...BANGLADESH_OUT, language: { code: 'xx', direction: 'rtl' } }, [ENGLISH, pseudo]).language).toBe(pseudo)
    expect(marketFormat({ ...BANGLADESH_OUT, language: { code: 'en', direction: 'rtl' } }).language).toBe(ENGLISH)
  })

  it('offers only unit systems the web can write, keeping the default among them', () => {
    const out = marketFormat({ ...BANGLADESH_OUT, unit_systems: { offered: ['furlong', 'metric'], default: 'furlong' } })
    expect(out.unitSystems).toEqual({ offered: ['metric'], default: 'metric' })
  })

  it('groups in thousands unless the Market says lakh', () => {
    expect(marketFormat({ ...BANGLADESH_OUT, grouping: 'weird' }).grouping).toBe('thousands')
  })
})

describe('meFrom', () => {
  it('reads #75’s ended access with its Developer, who revoked it and its projects', () => {
    const read = meFrom(me({ developer_id: null, market: null, memberships: [], ended: [{ ...ENDED, project_ids: ['p-1'] }], ended_membership_id: 'm-9' }))
    expect(read.ended).toEqual([
      {
        membershipId: 'm-9',
        developer: { id: SHAPLA, name: 'Shapla Homes Ltd' },
        role: 'vextrus_engineer',
        endedAt: ENDED.ended_at,
        how: 'revoked',
        revokedBy: 'Kamal Uddin',
        projectIds: ['p-1'],
        market: BANGLADESH,
      },
    ])
    expect(read.endedMembershipId).toBe('m-9')
    expect(read.market).toBeNull()
  })

  it('reads an ended row without #75’s Market (its branch before the ruling) as none', () => {
    const { market: _dropped, ...before } = ENDED
    expect(meFrom(me({ ended: [before] })).ended[0]!.market).toBeNull()
  })
})

describe('gateOf: where a signed-in user belongs', () => {
  it('is the frame while working in a Developer', () => {
    expect(gateOf(meFrom(me()))).toEqual({ to: 'frame' })
  })

  it('is "Which Developer?" for several Memberships and none chosen', () => {
    const two = me({
      developer_id: null,
      market: null,
      memberships: [...me().memberships, { id: 'm-2', developer_id: MEGHNA, developer_name: 'Meghna Properties Ltd', role: 'md', project_ids: [], expires_at: null }],
    })
    expect(gateOf(meFrom(two))).toEqual({ to: 'choose' })
  })

  it('is "Access ended" for the access the session worked in, even with another Membership current (a reload keeps it)', () => {
    const gate = gateOf(meFrom(me({ developer_id: null, market: null, ended: [ENDED], ended_membership_id: 'm-9' })))
    expect(gate).toMatchObject({ to: 'ended', ended: { membershipId: 'm-9' } })
  })

  it('is "Access ended" for the newest ended access of someone with no Membership left, signing in afresh', () => {
    const older = { ...ENDED, membership_id: 'm-8', developer_id: MEGHNA, developer_name: 'Meghna Properties Ltd', ended_at: '2026-09-01T00:00:00Z' }
    const gate = gateOf(meFrom(me({ developer_id: null, market: null, memberships: [], ended: [ENDED, older] })))
    expect(gate).toMatchObject({ to: 'ended', ended: { membershipId: 'm-9' } })
  })

  it('is "No access to anything" with no Membership, current or ended', () => {
    expect(gateOf(meFrom(me({ developer_id: null, market: null, memberships: [] })))).toEqual({ to: 'no-access' })
  })

  it('is never the frame without a Market, or for a Developer the user holds no Membership in', () => {
    expect(gateOf(meFrom(me({ market: null }))).to).not.toBe('frame')
    expect(gateOf(meFrom(me({ developer_id: MEGHNA }))).to).not.toBe('frame')
  })
})

describe('sessionFrom', () => {
  const projects = [
    { id: 'p-2', code: 'BP-02', name: 'Bokul Place', address: '', market_id: 'm', currency: 'BDT', unit_system: 'imperial', created_at: '2026-09-25T00:00:00Z' },
    { id: 'p-1', code: 'KR-01', name: 'Kadam Residence', address: 'Plot 14', market_id: 'm', currency: 'BDT', unit_system: 'imperial', created_at: '2026-09-24T00:00:00Z' },
  ]

  it('names a Membership given chosen projects by their codes, and lists the projects in code order', () => {
    const scoped = me({ memberships: [{ ...me().memberships[0]!, project_ids: ['p-1'] }] })
    const session = sessionFrom(meFrom(scoped), projects)
    expect(session.scope).toEqual(['KR-01'])
    expect(session.projects.map((p) => p.code)).toEqual(['BP-02', 'KR-01'])
    expect(session.projects[1]).toEqual({ id: 'p-1', code: 'KR-01', name: 'Kadam Residence', address: 'Plot 14', unitSystem: 'imperial', step1: { found: null, confirmed: 0, excluded: 0, questionsOpen: 0 } })
  })

  it('keeps no currency or Market of a project (never shown, m0-screens §1.9)', () => {
    const session = sessionFrom(meFrom(me()), projects)
    expect(Object.keys(session.projects[0]!)).not.toContain('currency')
    expect(Object.keys(session.projects[0]!)).not.toContain('market_id')
  })

  it('refuses a session with no Developer to work in', () => {
    expect(() => sessionFrom(meFrom(me({ developer_id: null })), projects)).toThrow(NoDeveloper)
  })
})
