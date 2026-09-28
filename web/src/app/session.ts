/*
 * The signed-in member, as the shell needs them: who they are, the Developer they act in and its
 * Market, their role, their access's end date and Project scope, and the projects they may open
 * (docs/design/m0-screens.md §1.4, §4.1; docs/plans/M0.md, "The Market on the web", "Project scope").
 *
 * One TanStack Query, `sessionQuery`, so ticket 20a swaps its source for `/api/me` (and 08's project
 * list) without touching a screen. Until then it is built from the seed's static copy; in development,
 * `?as=<email>` signs in as another seeded member (the Engineer, the Guest, the MD) for the design gate.
 */
import { queryOptions } from '@tanstack/react-query'
import type { MarketFormat } from '@/format/profile'
import { DEFAULT_MEMBER, DEVELOPERS, MEMBERSHIPS, PROJECTS, STEP1, type Role } from './seed/demo.fixture'

export type { Role }

export interface ProjectSummary {
  code: string
  name: string
  unitSystem: string
  /** Step 1's counts: sheets found (null when unknown), confirmed, excluded, and open Questions. */
  step1: { found: number | null; confirmed: number; excluded: number; questionsOpen: number }
}

export interface Session {
  user: { name: string; email: string }
  role: Role
  developer: { id: string; name: string }
  market: MarketFormat
  /** The Projects the Membership covers, or 'all' (m0-screens §1.4). */
  scope: readonly string[] | 'all'
  /** The access's end, as stored (UTC), or null. */
  until: string | null
  /** How many Developers the user holds a Membership in (the Developer switcher shows above one). */
  membershipCount: number
  /** Only the projects this member may open, in code order. */
  projects: readonly ProjectSummary[]
}

export class NoSuchMember extends Error {
  override name = 'NoSuchMember' // eslint-disable-line lingui/no-unlocalized-strings -- an error class name
}

/** The session the seed's static copy gives a member (the seed's QS unless another is named). */
export function staticSession(email: string = DEFAULT_MEMBER): Session {
  const memberships = MEMBERSHIPS.filter((m) => m.email === email)
  const membership = memberships[0]
  if (!membership) throw new NoSuchMember(email)
  const developer = DEVELOPERS.find((d) => d.id === membership.developer)!
  const scope = membership.projects
  const projects = PROJECTS.filter((p) => p.developer === developer.id && (scope === 'all' || scope.includes(p.code)))
    .map((p) => ({ code: p.code, name: p.name, unitSystem: p.unitSystem, step1: STEP1[p.code] ?? { found: null, confirmed: 0, excluded: 0, questionsOpen: 0 } }))
    .sort((a, b) => a.code.localeCompare(b.code))
  return {
    user: { name: membership.name, email },
    role: membership.role,
    developer: { id: developer.id, name: developer.name },
    market: developer.market,
    scope,
    until: membership.until,
    membershipCount: memberships.length,
    projects,
  }
}

let member: string | undefined

/** Development only: sign the static session in as another seeded member (`?as=<email>`). */
export function setStaticMember(email: string | undefined): void {
  member = email
}

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async (): Promise<Session> => staticSession(member),
  staleTime: Infinity,
})

/** The project a code names, if this member may open it; undefined for any other (never "forbidden"). */
export function projectFor(session: Session, code: string): ProjectSummary | undefined {
  return session.projects.find((p) => p.code === code)
}
