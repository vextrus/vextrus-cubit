/*
 * The signed-in member, as the shell needs them: who they are, the Developer they act in and its
 * Market, their role, their access's end date and Project scope, their Memberships, and the projects
 * they may open (docs/design/m0-screens.md §1.4, §4.1; docs/plans/M0.md, "The Market on the web",
 * "Project scope").
 *
 * One TanStack Query, `sessionQuery`, built from `/api/me` and `/api/projects` (ticket 20a), so every
 * screen reads one `Session`. It is only ever a session working in a Developer: signed out, the query
 * fails with the API's 401 (`ApiRefused`); signed in with no Developer to work in (none chosen, access
 * ended, none at all), with `NoDeveloper`, carrying `/api/me` so the frame can send the user to 4.1's
 * page for it (`gateOf`). The frame (`routes/_app/route.tsx`) does both before any screen renders.
 *
 * `meQuery` is `/api/me` alone, null when signed out, for the pages outside the frame: sign-in, the
 * chooser, "Access ended" and "No access to anything".
 *
 * Step 1's counts stay "not started" (`found: null`) until ticket 19a sends them.
 */
import { queryOptions } from '@tanstack/react-query'
import { ApiRefused, api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import type { Grouping, MarketFormat } from '@/format/profile'
import { knownUnitSystem } from '@/format/units'
import { SHIPPED_LANGUAGES, type Language } from '@/i18n/languages'

export type Role = 'qs' | 'md' | 'vextrus_engineer' | 'guest'

type MarketOut = components['schemas']['MarketOut']
type MeOut = components['schemas']['MeOut']
type EndedOut = components['schemas']['EndedOut']
type ProjectOut = components['schemas']['ProjectOut']

export interface ProjectSummary {
  id: string
  code: string
  name: string
  address: string
  unitSystem: string
  /** When the project's newest DomainEvent happened (UTC, as the API sends it), for every role. */
  updatedAt: string
  /** Step 1's counts: sheets found (null when unknown), confirmed, excluded, and open Questions. */
  step1: { found: number | null; confirmed: number; excluded: number; questionsOpen: number }
}

/** One of the user's current Memberships, in any of their Developers. */
export interface MembershipSummary {
  id: string
  developer: { id: string; name: string }
  role: Role
  /** The Projects it may open, by id; empty means every Project. */
  projectIds: readonly string[]
  /** The access's end, as stored (UTC), or null. */
  until: string | null
}

/** A Membership that has ended (4.1's "Access ended"). */
export interface EndedAccess {
  membershipId: string
  developer: { id: string; name: string }
  role: Role
  endedAt: string
  how: 'revoked' | 'expired'
  /** Who revoked it, by name; null when it expired, or no revocation names who. */
  revokedBy: string | null
  /** The Projects it gave, by id; empty means every Project. */
  projectIds: readonly string[]
  /** Its Developer's Market, which its dates are worded with. */
  market: MarketFormat
}

/** `/api/me`, as the web reads it. */
export interface Me {
  user: { id: string; name: string; email: string }
  /** The Developer the session works in, or null. */
  developerId: string | null
  memberships: readonly MembershipSummary[]
  /** Ended access, newest first. */
  ended: readonly EndedAccess[]
  /** The Membership the session was working in when it ended, while it is in `ended`. */
  endedMembershipId: string | null
  market: MarketFormat | null
}

export interface Session {
  user: { id: string; name: string; email: string }
  role: Role
  developer: { id: string; name: string }
  market: MarketFormat
  /** The Membership the session works in. */
  membershipId: string
  /** The Projects the Membership covers, by code, or 'all' (m0-screens §1.4). */
  scope: readonly string[] | 'all'
  /** The access's end, as stored (UTC), or null. */
  until: string | null
  /** How many Developers the user holds a Membership in (the Developer switcher shows above one). */
  membershipCount: number
  /** Every current Membership, this one included (the Developer switcher). */
  memberships: readonly MembershipSummary[]
  /** Only the projects this member may open, in code order. */
  projects: readonly ProjectSummary[]
}

const STEP1_NOT_STARTED: ProjectSummary['step1'] = { found: null, confirmed: 0, excluded: 0, questionsOpen: 0 }

/**
 * The Market on the web (ADR 0038): `/api/me`'s MarketOut as the formatters take it. Only a shipped
 * language is ever activated: any other falls back to the first shipped (English), with the
 * direction from the web's own language data. Unit systems the web cannot write are left out.
 */
export function marketFormat(out: MarketOut, shipped: readonly Language[] = SHIPPED_LANGUAGES): MarketFormat {
  const language = shipped.find((l) => l.code === out.language.code) ?? shipped[0]!
  const grouping: Grouping = out.grouping === 'lakh' ? 'lakh' : 'thousands'
  const offered = out.unit_systems.offered.filter(knownUnitSystem)
  const fallback = offered[0] ?? out.unit_systems.default
  return {
    language,
    locale: out.locale,
    grouping,
    digits: out.digits,
    currency: { code: out.currency.code, minorUnits: out.currency.minor_units, display: 'narrowSymbol' },
    timeZone: out.time_zone,
    unitSystems: { offered, default: offered.includes(out.unit_systems.default) ? out.unit_systems.default : fallback },
  }
}

function endedFrom(out: EndedOut): EndedAccess {
  return {
    membershipId: out.membership_id,
    developer: { id: out.developer_id, name: out.developer_name },
    role: out.role,
    endedAt: out.ended_at,
    how: out.how,
    revokedBy: out.revoked_by,
    projectIds: out.project_ids,
    market: marketFormat(out.market),
  }
}

/** `/api/me` as the web reads it (the one mapping from its shape). */
export function meFrom(out: MeOut): Me {
  return {
    user: { id: out.user.id, name: out.user.name, email: out.user.email },
    developerId: out.developer_id ?? null,
    memberships: out.memberships.map((m) => ({
      id: m.id,
      developer: { id: m.developer_id, name: m.developer_name },
      role: m.role,
      projectIds: m.project_ids,
      until: m.expires_at ?? null,
    })),
    ended: out.ended.map(endedFrom),
    endedMembershipId: out.ended_membership_id ?? null,
    market: out.market ? marketFormat(out.market) : null,
  }
}

/** Where a signed-in user belongs (m0-screens §4.1, §4.2). */
export type Gate = { to: 'frame' } | { to: 'choose' } | { to: 'ended'; ended: EndedAccess } | { to: 'no-access' }

/**
 * Working in a Developer: the frame. Else the access the session was working in, when it ended; else
 * "Which Developer?" while any Membership is current; else the newest ended access, so someone whose
 * access expired learns it on signing in; else "No access to anything".
 */
export function gateOf(me: Me): Gate {
  const working = me.developerId !== null && me.market !== null && me.memberships.some((m) => m.developer.id === me.developerId)
  if (working) return { to: 'frame' }
  const endedHere = me.ended.find((e) => e.membershipId === me.endedMembershipId)
  if (endedHere) return { to: 'ended', ended: endedHere }
  if (me.memberships.length > 0) return { to: 'choose' }
  const newest = me.ended[0]
  if (newest) return { to: 'ended', ended: newest }
  return { to: 'no-access' }
}

/** Signed in, but with no Developer to work in: `me` says which page of 4.1 to show. */
export class NoDeveloper extends Error {
  override name = 'NoDeveloper' // eslint-disable-line lingui/no-unlocalized-strings -- an error class name
  readonly me: Me
  constructor(me: Me) {
    super(gateOf(me).to)
    this.me = me
  }
}

/** The session working in the Developer `me` names, with its projects. */
export function sessionFrom(me: Me, projects: readonly ProjectOut[]): Session {
  const membership = me.memberships.find((m) => m.developer.id === me.developerId)
  if (!membership || !me.market) throw new NoDeveloper(me)
  const summaries = projects
    .map<ProjectSummary>((p) => ({ id: p.id, code: p.code, name: p.name, address: p.address, unitSystem: p.unit_system, updatedAt: p.updated_at, step1: STEP1_NOT_STARTED }))
    .sort((a, b) => a.code.localeCompare(b.code))
  const scope = membership.projectIds.length === 0 ? 'all' : summaries.filter((p) => membership.projectIds.includes(p.id)).map((p) => p.code)
  return {
    user: me.user,
    role: membership.role,
    developer: membership.developer,
    market: me.market,
    membershipId: membership.id,
    scope,
    until: membership.until,
    membershipCount: me.memberships.length,
    memberships: me.memberships,
    projects: summaries,
  }
}

async function fetchMe(): Promise<Me> {
  return meFrom(await unwrap(api.GET('/api/me')))
}

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async (): Promise<Session> => {
    const me = await fetchMe()
    if (gateOf(me).to !== 'frame') throw new NoDeveloper(me)
    // Only once a Developer is chosen: asked without one, the projects are refused.
    const projects = await unwrap(api.GET('/api/projects'))
    return sessionFrom(me, projects)
  },
  staleTime: Infinity,
  // Read again whenever the tab comes back into view (another tab may have signed out, or switched
  // the Developer the session works in), as well as on every move inside the frame (auth/gate.ts).
  refetchOnWindowFocus: 'always',
})

/** `/api/me`, or null when signed out: for the pages outside the frame. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    try {
      return await fetchMe()
    } catch (error) {
      if (error instanceof ApiRefused && error.status === 401) return null
      throw error
    }
  },
  staleTime: 0,
})

/** The project a code names, if this member may open it; undefined for any other (never "forbidden"). */
export function projectFor(session: Session, code: string): ProjectSummary | undefined {
  return session.projects.find((p) => p.code === code)
}
