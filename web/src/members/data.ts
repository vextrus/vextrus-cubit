/*
 * The Members page's data (docs/design/m0-screens.md §4.4; 07's API, with #75's `invited_by_id` and
 * `actions` on each row): who has access to the Developer, the Vextrus access, the invitations not
 * used yet, and one person's acts. What a member may do on a row is the server's: the page shows
 * exactly the row's `actions`, never re-deriving a right.
 */
import { queryOptions } from '@tanstack/react-query'
import { ApiRefused, api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import type { MemberAction, MembersOut75, PendingOut75, PersonOut75 } from '@/api/until75'
import type { Role, Session } from '@/app/session'

export type { MemberAction }

type ActOut = components['schemas']['ActOut']

export interface PersonRow {
  kind: 'person'
  membershipId: string
  userId: string
  name: string
  email: string
  role: Role
  /** The projects by code, or 'all'. */
  projects: readonly string[] | 'all'
  since: string
  until: string | null
  ended: { at: string; how: 'revoked' | 'expired'; by: string | null } | null
  invitedBy: string | null
  acts: number
  lastActAt: string | null
  /** This row is the signed-in user's own. */
  you: boolean
  actions: readonly MemberAction[]
}

export interface InvitationRow {
  kind: 'invitation'
  membershipId: string
  email: string
  role: Role
  projects: readonly string[] | 'all'
  until: string | null
  linkWorksUntil: string
  invitedBy: string | null
  actions: readonly MemberAction[]
}

export interface Members {
  people: readonly PersonRow[]
  vextrus: readonly PersonRow[]
  invitations: readonly InvitationRow[]
}

/** The order a row's acts are offered in (m0-screens §4.4: "Renew 30 days" before "Revoke"). */
const ORDER: readonly MemberAction[] = ['renew', 'revoke', 'copy_link', 'withdraw']

function actions(given: readonly MemberAction[] | undefined): MemberAction[] {
  return ORDER.filter((a) => given?.includes(a))
}

/** Ids to codes, through the projects the viewer may open; an id they cannot is never named. */
function codes(all: boolean, ids: readonly string[], session: Session): readonly string[] | 'all' {
  if (all) return 'all'
  return session.projects.filter((p) => ids.includes(p.id)).map((p) => p.code)
}

function person(out: PersonOut75, session: Session): PersonRow {
  const how = out.how_ended === 'revoked' || out.how_ended === 'expired' ? out.how_ended : null
  return {
    kind: 'person',
    membershipId: out.membership_id,
    userId: out.user_id,
    name: out.name,
    email: out.email,
    role: out.role,
    projects: codes(out.all_projects, out.project_ids, session),
    since: out.since,
    until: out.until ?? null,
    ended: out.ended_at && how ? { at: out.ended_at, how, by: out.revoked_by ?? null } : null,
    invitedBy: out.invited_by ?? null,
    acts: out.acts,
    lastActAt: out.last_act_at ?? null,
    you: out.user_id === session.user.id,
    actions: actions(out.actions),
  }
}

function invitation(out: PendingOut75, session: Session): InvitationRow {
  return {
    kind: 'invitation',
    membershipId: out.membership_id,
    email: out.email,
    role: out.role,
    projects: codes(out.all_projects, out.project_ids, session),
    until: out.until ?? null,
    linkWorksUntil: out.link_expires_at,
    invitedBy: out.invited_by ?? null,
    actions: actions(out.actions),
  }
}

/** `/api/members` as the page reads it. */
export function membersFrom(out: MembersOut75, session: Session): Members {
  return {
    people: out.people.map((p) => person(p, session)),
    vextrus: out.vextrus_access.map((p) => person(p, session)),
    invitations: out.invitations.map((i) => invitation(i, session)),
  }
}

/** A refusal is an answer, never tried again; an unreachable server keeps being tried. */
export function retry(failures: number, error: unknown): boolean {
  if (error instanceof ApiRefused) return false
  return error instanceof TypeError || failures < 2
}

export const membersQuery = queryOptions({
  queryKey: ['members'],
  // Until #75 is on main, its `invited_by_id` and `actions` are typed in until75.ts.
  queryFn: async () => (await unwrap(api.GET('/api/members'))) as unknown as MembersOut75,
  staleTime: 0,
  retry,
})

export const ACTS_PAGE = 50

/** One person's acts, newest first, a page at a time. */
export function actsQuery(userId: string, before: string | null) {
  return queryOptions({
    queryKey: ['acts', userId, before],
    queryFn: async (): Promise<ActOut[]> =>
      unwrap(api.GET('/api/activity', { params: { query: { actor: userId, limit: ACTS_PAGE, ...(before ? { before } : {}) } } })),
    staleTime: 0,
    retry,
  })
}

/** The acts the invite dialog sends: `null` projects means every project; `null` end, none. */
export interface Invite {
  email: string
  role: Role
  projectIds: readonly string[] | null
  expiresAt: string | null
}

export async function invite(given: Invite) {
  return unwrap(
    api.POST('/api/members/invitations', {
      // No firm is asked (4.4 gives no such field): `outside_org` stays empty.
      body: { email: given.email, role: given.role, project_ids: given.projectIds ? [...given.projectIds] : null, expires_at: given.expiresAt, outside_org: '' },
    }),
  )
}

export async function newLink(membershipId: string) {
  return unwrap(api.POST('/api/members/invitations/{membership_id}/link', { params: { path: { membership_id: membershipId } } }))
}

export async function withdraw(membershipId: string) {
  await unwrap(api.POST('/api/members/invitations/{membership_id}/withdraw', { params: { path: { membership_id: membershipId } } }))
}

export async function revoke(membershipId: string) {
  await unwrap(api.POST('/api/members/{membership_id}/revoke', { params: { path: { membership_id: membershipId } } }))
}

export async function renew(membershipId: string) {
  return unwrap(api.POST('/api/members/{membership_id}/renew', { params: { path: { membership_id: membershipId } } }))
}

/** The link an invitation is accepted through: the token after `#`, which no server ever logs. */
export function inviteLink(token: string, origin: string = window.location.origin): string {
  return `${origin}/join#${token}`
}
