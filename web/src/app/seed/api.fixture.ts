/*
 * An in-memory copy of the API for the web's tests (`mountApp`, src/app/testing.tsx): the seed of
 * docs/design/m0-screens.md §7 and the rules of tickets 07 and 08 as the server applies them (the
 * guard's order: CSRF, signed out, no Developer, Project scope, role; `_INVITES`; `_scope`;
 * `_changeable`; the Members rows each viewer sees), with ticket #75's shapes (the "Access ended"
 * facts, an invitation's projects, each Members row's actions). Everything is invented.
 *
 * It is a test double, never the wall: the API is. The walk (web/e2e/) drives the real server.
 *
 * Beyond §7, for the states the real seed cannot reach before #75 seeds them: Rafiq Hasan, with two
 * current Memberships (QS at Meghna, MD at Kanchan Homes Ltd, which has no projects); Shirin Akter, a
 * QS given only BP-02 (the scoped QS of the role matrix); and Jamal Hossain, a Guest whose access
 * ended on 20 Sep 2026.
 */
import type { components } from '@/api/schema.gen'
import type { EndedOut75, MeOut75, MemberAction, MembersOut75, PendingOut75, PersonOut75 } from '@/api/until75'
import type { Role } from '@/app/session'

type Schemas = components['schemas']

export const PASSWORD = 'correct horse battery'

export const PEOPLE = {
  qs: 'nusrat@shapla-homes.example',
  md: 'kamal@shapla-homes.example',
  engineer: 'arif@vextrus.example',
  guest: 'farhana@padma-builders.example',
  scopedQs: 'shirin@shapla-homes.example',
  twoDevelopers: 'rafiq@kanchan-homes.example',
  expiredGuest: 'jamal@padma-builders.example',
  meghnaQs: 'tanvir@meghna.example',
} as const

/** The Bangladesh Market as `/api/me` sends it. */
export const BANGLADESH_OUT: Schemas['MarketOut'] = {
  code: 'BD',
  name: 'Bangladesh',
  language: { code: 'en', direction: 'ltr' },
  locale: 'en-IN',
  grouping: 'lakh',
  digits: 'latn',
  currency: { code: 'BDT', minor_units: 2, symbol: '৳', symbol_position: 'before' },
  time_zone: 'Asia/Dhaka',
  unit_systems: { offered: ['imperial', 'metric'], default: 'imperial' },
  days_off: [5],
}

const DAY = 86_400_000
/** The end of 26 Oct 2026 in Dhaka (UTC+6), as the seed writes the Guest's end. */
export const END_26_OCT = '2026-10-26T17:59:00Z'

interface User {
  id: string
  name: string
  email: string
  password: string
  staff: boolean
}

interface Developer {
  id: string
  name: string
}

interface Project {
  id: string
  tenant: string
  code: string
  name: string
  address: string
  unitSystem: string
  createdAt: string
}

interface Membership {
  id: string
  tenant: string
  userId: string | null
  role: Role
  outsideOrg: string
  /** Empty: every Project. */
  projectIds: string[]
  expiresAt: string | null
  revokedAt: string | null
  invitedBy: string | null
  invitedEmail: string
  token: string | null
  inviteExpiresAt: string | null
  since: string
}

interface Act {
  id: string
  tenant: string
  code: string
  actorId: string | null
  subjectId: string | null
  projectId: string | null
  at: string
}

export interface FakeRequest {
  method: string
  path: string
  status: number
}

type Grant = 'account' | 'look' | 'change' | 'people' | 'access' | 'acts'

const ROLES: Record<Grant, readonly Role[]> = {
  account: ['qs', 'md', 'vextrus_engineer', 'guest'],
  look: ['qs', 'md', 'vextrus_engineer', 'guest'],
  change: ['qs', 'vextrus_engineer'],
  people: ['qs', 'md', 'vextrus_engineer'],
  access: ['qs', 'md'],
  acts: ['qs', 'md'],
}

const INVITES: Partial<Record<Role, readonly Role[]>> = {
  md: ['qs', 'md', 'vextrus_engineer', 'guest'],
  qs: ['vextrus_engineer'],
}

function refusal(code: string, params: Record<string, string | number> = {}) {
  return { code, params }
}

function json(status: number, body: unknown): Response {
  if (status === 204) return new Response(null, { status })
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let serial = 0
function newId(): string {
  serial += 1
  return `f0000000-0000-4000-8000-${String(serial).padStart(12, '0')}`
}

function newToken(): string {
  return `tok${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

class Refused extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown) {
    super(String(status))
    this.status = status
    this.body = body
  }
}

export interface FakeApiOptions {
  /** Extra developers, people and projects on top of the seed. */
  extend?: (api: FakeApi) => void
}

/** The fake backend: `handle` answers a Request as the API would. */
export class FakeApi {
  users: User[] = []
  developers: Developer[] = []
  projects: Project[] = []
  memberships: Membership[] = []
  acts: Act[] = []
  requests: FakeRequest[] = []
  /** The browser's session cookie, kept here. */
  session: { userId: string | null; developerId: string | null } = { userId: null, developerId: null }
  csrf: string | null = null
  /** While true, every request fails as an unreachable server does (TypeError). */
  offline = false
  private once: { match: (method: string, path: string) => boolean; status: number; body: unknown }[] = []

  constructor(options: FakeApiOptions = {}) {
    this.seed()
    options.extend?.(this)
  }

  now(): number {
    return Date.now()
  }

  // Seeding ---------------------------------------------------------------------------------------

  addUser(email: string, name: string, staff = false): User {
    const user = { id: newId(), name, email, password: PASSWORD, staff }
    this.users.push(user)
    return user
  }

  addDeveloper(name: string): Developer {
    const developer = { id: newId(), name }
    this.developers.push(developer)
    return developer
  }

  addProject(developer: Developer, code: string, name: string, address: string): Project {
    const project = { id: newId(), tenant: developer.id, code, name, address, unitSystem: 'imperial', createdAt: '2026-09-24T04:00:00Z' }
    this.projects.push(project)
    return project
  }

  addMembership(developer: Developer, user: User | null, role: Role, extra: Partial<Membership> = {}): Membership {
    const membership: Membership = {
      id: newId(),
      tenant: developer.id,
      userId: user?.id ?? null,
      role,
      outsideOrg: '',
      projectIds: [],
      expiresAt: null,
      revokedAt: null,
      invitedBy: null,
      invitedEmail: user?.email ?? '',
      token: null,
      inviteExpiresAt: null,
      since: '2026-09-01T04:00:00Z',
      ...extra,
    }
    this.memberships.push(membership)
    return membership
  }

  addAct(tenant: string, code: string, actorId: string | null, subjectId: string | null, at: string, projectId: string | null = null): void {
    this.acts.push({ id: newId(), tenant, code, actorId, subjectId, projectId, at })
  }

  developer(name: string): Developer {
    return this.developers.find((d) => d.name === name)!
  }

  user(email: string): User {
    return this.users.find((u) => u.email === email)!
  }

  project(code: string, tenant?: string): Project {
    return this.projects.find((p) => p.code === code && (tenant === undefined || p.tenant === tenant))!
  }

  membershipOf(email: string, developerName: string): Membership {
    const user = this.user(email)
    const developer = this.developer(developerName)
    return this.memberships.filter((m) => m.userId === user.id && m.tenant === developer.id).at(-1)!
  }

  private seed(): void {
    const shapla = this.addDeveloper('Shapla Homes Ltd')
    const meghna = this.addDeveloper('Meghna Properties Ltd')
    const kanchan = this.addDeveloper('Kanchan Homes Ltd')
    const kr01 = this.addProject(shapla, 'KR-01', 'Kadam Residence', 'Plot 14, Road 7, Block C, Dhaka')
    const bp02 = this.addProject(shapla, 'BP-02', 'Bokul Place', 'House 3, Lane 2, Dhaka')
    this.addProject(shapla, 'SG-03', 'Shimul Garden', 'Plot 9, Sector 4, Dhaka')
    this.addProject(meghna, 'MG-01', 'Meghna Heights', 'Plot 22, Road 11, Block D, Dhaka')

    const kamal = this.addUser(PEOPLE.md, 'Kamal Uddin')
    const nusrat = this.addUser(PEOPLE.qs, 'Nusrat Jahan')
    const arif = this.addUser(PEOPLE.engineer, 'Arif Rahman', true)
    const farhana = this.addUser(PEOPLE.guest, 'Farhana Kabir')
    const shirin = this.addUser(PEOPLE.scopedQs, 'Shirin Akter')
    const rafiq = this.addUser(PEOPLE.twoDevelopers, 'Rafiq Hasan')
    const jamal = this.addUser(PEOPLE.expiredGuest, 'Jamal Hossain')
    const tanvir = this.addUser(PEOPLE.meghnaQs, 'Tanvir Ahmed')

    this.addMembership(shapla, kamal, 'md', { since: '2026-09-01T04:00:00Z' })
    const qs = this.addMembership(shapla, nusrat, 'qs', { invitedBy: kamal.id, since: '2026-09-03T04:00:00Z' })
    const engineer = this.addMembership(shapla, arif, 'vextrus_engineer', { invitedBy: kamal.id, expiresAt: END_26_OCT, since: '2026-09-26T04:00:00Z' })
    const guest = this.addMembership(shapla, farhana, 'guest', {
      invitedBy: kamal.id,
      outsideOrg: 'Padma Builders',
      projectIds: [kr01.id],
      expiresAt: END_26_OCT,
      since: '2026-09-26T05:00:00Z',
    })
    this.addMembership(shapla, shirin, 'qs', { invitedBy: kamal.id, projectIds: [bp02.id], since: '2026-09-10T04:00:00Z' })
    this.addMembership(shapla, jamal, 'guest', {
      invitedBy: kamal.id,
      outsideOrg: 'Padma Builders',
      projectIds: [kr01.id],
      expiresAt: '2026-09-20T17:59:00Z',
      since: '2026-09-05T04:00:00Z',
    })
    const rumana = this.addMembership(shapla, null, 'qs', {
      invitedBy: kamal.id,
      invitedEmail: 'rumana@shapla-homes.example',
      token: newToken(),
      inviteExpiresAt: '2026-10-03T04:00:00Z',
      since: '2026-09-26T06:00:00Z',
    })
    this.addMembership(meghna, tanvir, 'qs')
    this.addMembership(meghna, rafiq, 'qs', { since: '2026-09-12T04:00:00Z' })
    this.addMembership(kanchan, rafiq, 'md', { since: '2026-09-14T04:00:00Z' })

    this.addAct(shapla.id, 'platform.invitations.invited', kamal.id, qs.id, '2026-09-03T03:00:00Z')
    this.addAct(shapla.id, 'platform.invitations.invited', kamal.id, engineer.id, '2026-09-26T03:00:00Z')
    this.addAct(shapla.id, 'platform.invitations.accepted', arif.id, engineer.id, '2026-09-26T04:00:00Z')
    this.addAct(shapla.id, 'platform.invitations.invited', kamal.id, guest.id, '2026-09-26T04:30:00Z')
    this.addAct(shapla.id, 'platform.invitations.invited', kamal.id, rumana.id, '2026-09-26T06:00:00Z')
    this.addAct(shapla.id, 'projects.projects.created', arif.id, null, '2026-09-26T09:42:00Z', kr01.id)
  }

  // Test helpers ----------------------------------------------------------------------------------

  /** Starts a session as `email`, as signing in does (the only Developer chosen, if there is one). */
  signInAs(email: string): void {
    const user = this.user(email)
    this.session = { userId: user.id, developerId: null }
    const current = this.currentMemberships(user.id)
    if (current.length === 1) this.session.developerId = current[0]!.tenant
    this.rotateCsrf()
  }

  /** The next request matching answers `status` with `body`, once. */
  failOnce(match: (method: string, path: string) => boolean, status: number, body: unknown): void {
    this.once.push({ match, status, body })
  }

  /** The token of an unused invitation, for its link. */
  tokenFor(email: string): string {
    const m = this.memberships.find((x) => x.invitedEmail === email && x.userId === null && x.token)
    return m!.token!
  }

  /** Ends someone's access now, as an MD's Revoke does. */
  revoke(email: string, developerName: string, by: string | null): void {
    const membership = this.membershipOf(email, developerName)
    membership.revokedAt = new Date(this.now()).toISOString()
    this.addAct(membership.tenant, 'platform.invitations.revoked', by ? this.user(by).id : null, membership.id, membership.revokedAt)
  }

  /** Every request made, "METHOD /path" with its status. */
  calls(): string[] {
    return this.requests.map((r) => `${r.method} ${r.path}`)
  }

  // Rules -----------------------------------------------------------------------------------------

  private rotateCsrf(): void {
    this.csrf = newToken()
    document.cookie = `csrftoken=${this.csrf}; path=/`
  }

  private isCurrent(m: Membership): boolean {
    return m.userId !== null && m.revokedAt === null && (m.expiresAt === null || Date.parse(m.expiresAt) > this.now())
  }

  private currentMemberships(userId: string): Membership[] {
    return this.memberships.filter((m) => m.userId === userId && this.isCurrent(m))
  }

  private ending(m: Membership): { at: string; how: 'revoked' | 'expired' } | null {
    const now = this.now()
    if (m.expiresAt !== null && Date.parse(m.expiresAt) <= now && (m.revokedAt === null || Date.parse(m.expiresAt) < Date.parse(m.revokedAt))) {
      return { at: m.expiresAt, how: 'expired' }
    }
    if (m.revokedAt !== null) return { at: m.revokedAt, how: 'revoked' }
    return null
  }

  private acting(): Membership | null {
    const { userId, developerId } = this.session
    if (!userId || !developerId) return null
    return this.memberships.find((m) => m.userId === userId && m.tenant === developerId && this.isCurrent(m)) ?? null
  }

  private require(grant: Grant, projectId?: string): Membership {
    if (!this.session.userId) throw new Refused(401, refusal('platform.auth.signed_out'))
    const membership = this.acting()
    if (!membership) {
      const holds = this.currentMemberships(this.session.userId).length > 0
      throw new Refused(403, refusal(holds ? 'platform.auth.choose_developer' : 'platform.auth.no_access'))
    }
    if (projectId !== undefined && !this.mayOpen(membership, projectId)) throw new Refused(404, refusal('platform.auth.not_found'))
    if (!ROLES[grant].includes(membership.role)) throw new Refused(403, refusal('platform.auth.not_allowed', { role: membership.role }))
    return membership
  }

  private mayOpen(m: Membership, projectId: string): boolean {
    const project = this.projects.find((p) => p.id === projectId && p.tenant === m.tenant)
    if (!project) return false
    return m.projectIds.length === 0 || m.projectIds.includes(projectId)
  }

  private me(): MeOut75 {
    const user = this.users.find((u) => u.id === this.session.userId)!
    const current = this.currentMemberships(user.id)
    const acting = this.acting()
    const currentTenants = new Set(current.map((m) => m.tenant))
    const latest = new Map<string, EndedOut75>()
    for (const m of this.memberships.filter((x) => x.userId === user.id && !currentTenants.has(x.tenant))) {
      const end = this.ending(m)
      if (!end) continue
      const before = latest.get(m.tenant)
      if (before && Date.parse(before.ended_at) >= Date.parse(end.at)) continue
      const revoker = this.acts.find((a) => a.code === 'platform.invitations.revoked' && a.subjectId === m.id && a.actorId)
      latest.set(m.tenant, {
        membership_id: m.id,
        developer_id: m.tenant,
        developer_name: this.developers.find((d) => d.id === m.tenant)!.name,
        role: m.role,
        ended_at: end.at,
        how: end.how,
        revoked_by: end.how === 'revoked' && revoker ? this.users.find((u) => u.id === revoker.actorId)!.name : null,
        project_ids: [...m.projectIds],
      })
    }
    const ended = [...latest.values()].sort((a, b) => Date.parse(b.ended_at) - Date.parse(a.ended_at))
    const workedIn = this.session.developerId
    const endedHere = acting ? null : ended.find((e) => e.developer_id === workedIn)
    return {
      user: { id: user.id, name: user.name, email: user.email },
      developer_id: acting?.tenant ?? null,
      memberships: current.map((m) => ({
        id: m.id,
        developer_id: m.tenant,
        developer_name: this.developers.find((d) => d.id === m.tenant)!.name,
        role: m.role,
        project_ids: [...m.projectIds],
        expires_at: m.expiresAt,
      })),
      ended,
      ended_membership_id: endedHere?.membership_id ?? null,
      market: acting ? BANGLADESH_OUT : null,
    }
  }

  private projectOut(p: Project): Schemas['ProjectOut'] {
    return { id: p.id, code: p.code, name: p.name, address: p.address, market_id: 'm-bd', currency: 'BDT', unit_system: p.unitSystem, created_at: p.createdAt }
  }

  private seenProjects(viewer: Membership, theirs: string[]): { all: boolean; ids: string[] } | null {
    if (theirs.length === 0) return { all: true, ids: [] }
    const shown = viewer.projectIds.length === 0 ? theirs : theirs.filter((id) => viewer.projectIds.includes(id))
    return shown.length ? { all: false, ids: [...shown].sort() } : null
  }

  private changeable(actor: Membership, m: Membership): boolean {
    if (m.userId !== null && m.userId === actor.userId) return false
    if (actor.role === 'md') return true
    return actor.role === 'qs' && m.role === 'vextrus_engineer' && m.invitedBy === actor.userId
  }

  private actionsFor(viewer: Membership, m: Membership): MemberAction[] {
    if (!ROLES.access.includes(viewer.role) || !this.changeable(viewer, m)) return []
    if (m.userId === null) return ['copy_link', 'withdraw']
    if (m.revokedAt !== null) return []
    return m.expiresAt !== null ? ['renew', 'revoke'] : ['revoke']
  }

  private members(viewer: Membership): MembersOut75 {
    const seesAccess = ROLES.access.includes(viewer.role)
    const people: PersonOut75[] = []
    const vextrus: PersonOut75[] = []
    const invitations: PendingOut75[] = []
    for (const m of this.memberships.filter((x) => x.tenant === viewer.tenant)) {
      const seen = this.seenProjects(viewer, m.projectIds)
      if (!seen) continue
      const inviter = this.users.find((u) => u.id === m.invitedBy)
      if (m.userId === null) {
        const open = m.revokedAt === null && m.inviteExpiresAt !== null && Date.parse(m.inviteExpiresAt) > this.now()
        if (seesAccess && open) {
          invitations.push({
            membership_id: m.id,
            email: m.invitedEmail,
            role: m.role,
            outside_org: m.outsideOrg,
            all_projects: seen.all,
            project_ids: seen.ids,
            until: m.expiresAt,
            link_expires_at: m.inviteExpiresAt!,
            invited_by: inviter?.name ?? null,
            invited_by_id: m.invitedBy,
            actions: this.actionsFor(viewer, m),
          })
        }
        continue
      }
      const user = this.users.find((u) => u.id === m.userId)!
      const end = this.ending(m)
      const mine = this.acts.filter((a) => a.tenant === viewer.tenant && a.actorId === user.id)
      const revoker = this.acts.find((a) => a.code === 'platform.invitations.revoked' && a.subjectId === m.id && a.actorId)
      const person: PersonOut75 = {
        membership_id: m.id,
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: m.role,
        outside_org: m.outsideOrg,
        all_projects: seen.all,
        project_ids: seen.ids,
        since: m.since,
        until: m.expiresAt,
        ended_at: end?.at ?? null,
        how_ended: end?.how ?? null,
        revoked_by: revoker ? this.users.find((u) => u.id === revoker.actorId)!.name : null,
        invited_by: inviter?.name ?? null,
        acts: mine.length,
        last_act_at: mine.map((a) => a.at).sort().at(-1) ?? null,
        invited_by_id: m.invitedBy,
        actions: this.actionsFor(viewer, m),
      }
      if (m.role !== 'vextrus_engineer') people.push(person)
      else if (seesAccess) vextrus.push(person)
    }
    people.sort((a, b) => Number(a.ended_at !== null) - Number(b.ended_at !== null) || a.name.localeCompare(b.name))
    vextrus.sort((a, b) => Number(a.ended_at !== null) - Number(b.ended_at !== null) || a.since.localeCompare(b.since))
    return { people, vextrus_access: vextrus, invitations }
  }

  private record(tenant: string, code: string, actorId: string | null, subjectId: string | null, projectId: string | null = null): void {
    this.addAct(tenant, code, actorId, subjectId, new Date(this.now()).toISOString(), projectId)
  }

  private actOut(a: Act): Schemas['ActOut'] {
    const actor = this.users.find((u) => u.id === a.actorId)
    const subject = this.memberships.find((m) => m.id === a.subjectId)
    const subjectUser = subject ? this.users.find((u) => u.id === subject.userId) : undefined
    const actorRole = actor ? (this.memberships.find((m) => m.userId === actor.id && m.tenant === a.tenant)?.role ?? null) : null
    const params: Record<string, string | number> = { by: actor ? 'person' : 'vextrus', actor: actor?.name ?? '' }
    if (subject) {
      params.subject = subjectUser?.name ?? subject.invitedEmail
      params.role = subject.role
    }
    return {
      id: a.id,
      code: a.code,
      params,
      actor: actor ? { id: actor.id, name: actor.name, role: actorRole, vextrus: actorRole === 'vextrus_engineer' || actor.staff } : null,
      project_id: a.projectId,
      building_id: null,
      subject_type: subject ? 'membership' : 'project',
      subject_id: a.subjectId,
      occurred_at: a.at,
    }
  }

  private lookUp(token: unknown): Membership {
    const m = this.memberships.find((x) => typeof token === 'string' && x.token === token)
    const usable =
      m && m.userId === null && m.revokedAt === null && m.inviteExpiresAt !== null && Date.parse(m.inviteExpiresAt) > this.now() && (m.expiresAt === null || Date.parse(m.expiresAt) > this.now())
    if (!m || !usable) throw new Refused(404, refusal('platform.invitations.unusable'))
    return m
  }

  private take(m: Membership, user: User): void {
    if (m.role === 'vextrus_engineer' && !user.staff) throw new Refused(403, refusal('platform.invitations.engineer_not_staff'))
    if (this.memberships.some((x) => x.tenant === m.tenant && x.userId === user.id && x.revokedAt === null)) {
      throw new Refused(409, refusal('platform.invitations.already_member', { email: user.email }))
    }
    m.userId = user.id
    m.token = null
    m.since = new Date(this.now()).toISOString()
    this.record(m.tenant, 'platform.invitations.accepted', user.id, m.id)
    this.session = { userId: user.id, developerId: m.tenant }
    this.rotateCsrf()
  }

  // The API ---------------------------------------------------------------------------------------

  handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method
    if (this.offline) {
      this.requests.push({ method, path, status: 0 })
      throw new TypeError('Failed to fetch')
    }
    let response: Response
    const forced = this.once.findIndex((o) => o.match(method, path))
    if (forced >= 0) {
      const [o] = this.once.splice(forced, 1)
      response = json(o!.status, o!.body)
    } else {
      try {
        const body = method === 'GET' ? {} : await request.json().catch(() => ({}))
        const [status, out] = this.route(method, path, url.searchParams, body as Record<string, unknown>, request.headers)
        response = json(status, out)
      } catch (error) {
        if (!(error instanceof Refused)) throw error
        response = json(error.status, error.body)
      }
    }
    this.requests.push({ method, path, status: response.status })
    return response
  }

  private route(method: string, path: string, query: URLSearchParams, body: Record<string, unknown>, headers: Headers): [number, unknown] {
    if (method !== 'GET' && (this.csrf === null || headers.get('X-CSRFToken') !== this.csrf)) throw new Refused(403, refusal('platform.auth.csrf_failed'))
    const at = (pattern: RegExp) => pattern.exec(path)
    let match: RegExpExecArray | null

    if (method === 'GET' && path === '/api/auth/csrf') {
      if (this.csrf === null) this.rotateCsrf()
      return [200, { token: this.csrf }]
    }
    if (method === 'POST' && path === '/api/auth/sign-in') {
      const user = this.users.find((u) => u.email.toLowerCase() === String(body.email ?? '').trim().toLowerCase())
      if (!user || user.password !== body.password) throw new Refused(401, refusal('platform.auth.wrong_credentials'))
      this.signInAs(user.email)
      return [200, this.me()]
    }
    if (method === 'POST' && path === '/api/auth/sign-out') {
      this.require('account')
      this.session = { userId: null, developerId: null }
      this.rotateCsrf()
      return [204, null]
    }
    if (method === 'POST' && path === '/api/invitations/look-up') {
      const m = this.lookUp(body.token)
      return [
        200,
        {
          developer_name: this.developers.find((d) => d.id === m.tenant)!.name,
          invited_by: this.users.find((u) => u.id === m.invitedBy)?.name ?? null,
          role: m.role,
          email: m.invitedEmail,
          project_ids: [...m.projectIds],
          expires_at: m.expiresAt,
          link_expires_at: m.inviteExpiresAt,
          has_account: this.users.some((u) => u.email.toLowerCase() === m.invitedEmail.toLowerCase()),
        },
      ]
    }
    if (method === 'POST' && path === '/api/invitations/look-up/projects') {
      const m = this.lookUp(body.token)
      const projects = this.projects.filter((p) => p.tenant === m.tenant && (m.projectIds.length === 0 || m.projectIds.includes(p.id)))
      return [200, projects.map((p) => ({ code: p.code, name: p.name })).sort((a, b) => a.code.localeCompare(b.code))]
    }
    if (method === 'POST' && path === '/api/invitations/accept') {
      const m = this.lookUp(body.token)
      const signedIn = this.users.find((u) => u.id === this.session.userId)
      if (signedIn) {
        if (signedIn.email.toLowerCase() !== m.invitedEmail.toLowerCase()) throw new Refused(403, refusal('platform.invitations.wrong_account', { email: m.invitedEmail }))
        this.take(m, signedIn)
        return [200, this.me()]
      }
      if (this.users.some((u) => u.email.toLowerCase() === m.invitedEmail.toLowerCase())) {
        throw new Refused(409, refusal('platform.invitations.sign_in_first', { email: m.invitedEmail }))
      }
      if (m.role === 'vextrus_engineer') throw new Refused(403, refusal('platform.invitations.engineer_not_staff'))
      const name = String(body.name ?? '').trim()
      if (!name) throw new Refused(400, refusal('platform.invitations.name_required'))
      if (String(body.password ?? '').length < 12) throw new Refused(400, refusal('platform.auth.password_too_short', { min: 12 }))
      const user = this.addUser(m.invitedEmail, name)
      user.password = String(body.password)
      this.take(m, user)
      return [200, this.me()]
    }
    if (method === 'GET' && path === '/api/me') {
      this.require('account')
      return [200, this.me()]
    }
    if (method === 'POST' && path === '/api/me/developer') {
      this.require('account')
      const found = this.currentMemberships(this.session.userId!).find((m) => m.tenant === body.developer_id)
      if (!found) throw new Refused(404, refusal('platform.auth.not_found'))
      this.session.developerId = found.tenant
      return [200, this.me()]
    }
    if (method === 'GET' && path === '/api/ended-access/projects') {
      this.require('account')
      const ended = this.me().ended.filter((e) => e.project_ids.length > 0)
      return [
        200,
        ended.map((e) => ({
          membership_id: e.membership_id,
          codes: this.projects
            .filter((p) => e.project_ids.includes(p.id))
            .map((p) => p.code)
            .sort(),
        })),
      ]
    }
    if (method === 'GET' && path === '/api/projects') {
      const m = this.require('look')
      const list = this.projects.filter((p) => p.tenant === m.tenant && (m.projectIds.length === 0 || m.projectIds.includes(p.id)))
      return [200, list.sort((a, b) => a.code.localeCompare(b.code)).map((p) => this.projectOut(p))]
    }
    if (method === 'POST' && path === '/api/projects') {
      const m = this.require('change')
      if (m.projectIds.length > 0) throw new Refused(403, refusal('projects.projects.scoped_member_cannot_create'))
      const extra = Object.keys(body).filter((k) => !['code', 'name', 'address', 'unit_system'].includes(k))
      if (extra.length) throw new Refused(422, { detail: extra.map((k) => ({ type: 'extra_forbidden', loc: ['body', 'payload', k] })) })
      const name = String(body.name ?? '').trim()
      const code = String(body.code ?? '').trim()
      if (!name) throw new Refused(400, { field: 'name', message: refusal('projects.projects.name_missing') })
      if (!code) throw new Refused(400, { field: 'code', message: refusal('projects.projects.code_missing') })
      const taken = this.projects.find((p) => p.tenant === m.tenant && p.code.toLowerCase() === code.toLowerCase())
      if (taken) throw new Refused(409, { field: 'code', message: refusal('projects.projects.code_taken', { code: taken.code, name: taken.name }) })
      const unit = body.unit_system === undefined || body.unit_system === null ? 'imperial' : String(body.unit_system)
      if (!BANGLADESH_OUT.unit_systems.offered.includes(unit)) throw new Refused(400, { field: 'unit_system', message: refusal('projects.projects.unit_system_not_offered') })
      const developer = this.developers.find((d) => d.id === m.tenant)!
      const project = this.addProject(developer, code, name, String(body.address ?? '').trim())
      project.unitSystem = unit
      project.createdAt = new Date(this.now()).toISOString()
      this.record(m.tenant, 'projects.projects.created', m.userId, null, project.id)
      return [201, this.projectOut(project)]
    }
    if (method === 'GET' && path === '/api/members') {
      return [200, this.members(this.require('people'))]
    }
    if (method === 'POST' && path === '/api/members/invitations') {
      const inviter = this.require('access')
      const chosen = body.project_ids
      let projectIds: string[] = []
      if (chosen === null || chosen === undefined) {
        if (inviter.projectIds.length) throw new Refused(403, refusal('platform.invitations.projects_not_yours'))
      } else {
        projectIds = [...new Set(chosen as string[])]
        if (!projectIds.length) throw new Refused(400, refusal('platform.invitations.choose_a_project'))
        if (!projectIds.every((id) => this.mayOpen(inviter, id))) throw new Refused(404, refusal('platform.auth.not_found'))
      }
      const role = String(body.role) as Role
      if (!(INVITES[inviter.role] ?? []).includes(role)) throw new Refused(403, refusal('platform.invitations.role_not_yours', { role }))
      const email = String(body.email ?? '').trim()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Refused(400, refusal('platform.invitations.invalid_email'))
      let expiresAt = (body.expires_at as string | null | undefined) ?? null
      if (role === 'vextrus_engineer' && expiresAt === null) expiresAt = new Date(this.now() + 30 * DAY).toISOString()
      if (expiresAt !== null && Date.parse(expiresAt) <= this.now()) throw new Refused(400, refusal('platform.invitations.end_in_past'))
      const existing = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
      if (existing) {
        for (const x of this.memberships.filter((y) => y.tenant === inviter.tenant && y.userId === existing.id && y.revokedAt === null)) {
          if (x.expiresAt !== null && Date.parse(x.expiresAt) <= this.now()) throw new Refused(409, refusal('platform.invitations.access_ended', { email }))
          throw new Refused(409, refusal('platform.invitations.already_member', { email }))
        }
      }
      const pending = this.memberships.find(
        (y) => y.tenant === inviter.tenant && y.userId === null && y.revokedAt === null && y.inviteExpiresAt !== null && Date.parse(y.inviteExpiresAt) > this.now() && y.invitedEmail.toLowerCase() === email.toLowerCase(),
      )
      if (pending) throw new Refused(409, refusal('platform.invitations.already_invited', { email }))
      const developer = this.developers.find((d) => d.id === inviter.tenant)!
      const membership = this.addMembership(developer, null, role, {
        invitedBy: inviter.userId,
        invitedEmail: email,
        projectIds,
        expiresAt,
        outsideOrg: String(body.outside_org ?? ''),
        token: newToken(),
        inviteExpiresAt: new Date(this.now() + 7 * DAY).toISOString(),
        since: new Date(this.now()).toISOString(),
      })
      this.record(inviter.tenant, 'platform.invitations.invited', inviter.userId, membership.id)
      return [201, { membership_id: membership.id, token: membership.token, link_expires_at: membership.inviteExpiresAt }]
    }
    if ((match = at(/^\/api\/members\/invitations\/([^/]+)\/(link|withdraw)$/)) && method === 'POST') {
      const actor = this.require('access')
      const m = this.changeableOr404(actor, match[1]!)
      const open = m.userId === null && m.revokedAt === null && m.inviteExpiresAt !== null && Date.parse(m.inviteExpiresAt) > this.now()
      if (!open) throw new Refused(409, refusal('platform.invitations.no_longer_open'))
      if (match[2] === 'withdraw') {
        m.revokedAt = new Date(this.now()).toISOString()
        m.token = null
        this.record(actor.tenant, 'platform.invitations.withdrawn', actor.userId, m.id)
        return [204, null]
      }
      m.token = newToken()
      this.record(actor.tenant, 'platform.invitations.link_reissued', actor.userId, m.id)
      return [200, { membership_id: m.id, token: m.token, link_expires_at: m.inviteExpiresAt }]
    }
    if ((match = at(/^\/api\/members\/([^/]+)\/(revoke|renew)$/)) && method === 'POST') {
      const actor = this.require('access')
      const m = this.changeableOr404(actor, match[1]!)
      if (m.userId === null) throw new Refused(404, refusal('platform.auth.not_found'))
      if (m.revokedAt !== null) throw new Refused(409, refusal('platform.invitations.already_ended'))
      if (match[2] === 'revoke') {
        m.revokedAt = new Date(this.now()).toISOString()
        this.record(actor.tenant, 'platform.invitations.revoked', actor.userId, m.id)
        return [204, null]
      }
      if (m.expiresAt === null) throw new Refused(409, refusal('platform.invitations.no_end_date'))
      m.expiresAt = new Date(Math.max(Date.parse(m.expiresAt), this.now()) + 30 * DAY).toISOString()
      this.record(actor.tenant, 'platform.invitations.renewed', actor.userId, m.id)
      return [200, { expires_at: m.expiresAt }]
    }
    if (method === 'GET' && path === '/api/activity') {
      const viewer = this.require('acts')
      const actor = query.get('actor')
      const limit = Math.min(Number(query.get('limit') ?? 50), 200)
      const before = query.get('before')
      let list = this.acts.filter((a) => a.tenant === viewer.tenant && (actor === null || a.actorId === actor)).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      if (before) list = list.slice(list.findIndex((a) => a.id === before) + 1)
      return [200, list.slice(0, limit).map((a) => this.actOut(a))]
    }
    throw new Refused(404, refusal('platform.auth.not_found'))
  }

  private changeableOr404(actor: Membership, id: string): Membership {
    const m = this.memberships.find((x) => x.id === id && x.tenant === actor.tenant)
    if (!m || !this.seenProjects(actor, m.projectIds)) throw new Refused(404, refusal('platform.auth.not_found'))
    if (m.userId !== null && m.userId === actor.userId) throw new Refused(403, refusal('platform.invitations.not_yourself'))
    if (!this.changeable(actor, m)) throw new Refused(403, refusal('platform.invitations.not_yours_to_change'))
    return m
  }
}
