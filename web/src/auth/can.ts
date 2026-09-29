/*
 * The role rule, as the server holds it (`platform/services/auth.py`, `ROLES`; `services/invitations.py`,
 * `_INVITES`; docs/design/m0-screens.md §1.4), so the web never offers what the API would refuse. The
 * API is the wall; this only decides what is shown.
 *
 *   can(session, 'change')     upload, confirm, answer, create: the QS and the Vextrus Engineer
 *   can(session, 'people')     Members and access: everyone but a Guest
 *   can(session, 'access')     invite, renew, revoke: the MD and the QS (narrowed per row by the API)
 *   can(session, 'acts')       the activity: the MD and the QS
 *   invitableRoles(session)    the MD a QS, an MD, a Guest or a Vextrus Engineer; a QS an Engineer
 *   mayCreateProject(session)  `change`, and not given chosen projects (08's rule)
 *
 * What a member may do on one Members row is the server's (`actions` on each row): never re-derived.
 */
import type { Role, Session } from '@/app/session'

export type Grant = 'look' | 'change' | 'people' | 'access' | 'acts'

const ROLES: Readonly<Record<Grant, readonly Role[]>> = {
  look: ['qs', 'md', 'vextrus_engineer', 'guest'],
  change: ['qs', 'vextrus_engineer'],
  people: ['qs', 'md', 'vextrus_engineer'],
  access: ['qs', 'md'],
  acts: ['qs', 'md'],
}

const INVITES: Readonly<Partial<Record<Role, readonly Role[]>>> = {
  md: ['qs', 'md', 'guest', 'vextrus_engineer'],
  qs: ['vextrus_engineer'],
}

/** Whether the session's role holds the grant (the server's `ROLES`). */
export function can(session: Pick<Session, 'role'>, grant: Grant): boolean {
  return ROLES[grant].includes(session.role)
}

/** The roles the session may invite, in the order the dialog offers them. */
export function invitableRoles(session: Pick<Session, 'role'>): readonly Role[] {
  return INVITES[session.role] ?? []
}

/** Whether "New project" is offered: a role that changes, with every project (not chosen ones). */
export function mayCreateProject(session: Pick<Session, 'role' | 'scope'>): boolean {
  return can(session, 'change') && session.scope === 'all'
}

/** The MD and a Guest look but never change: the ReadOnlyChip's and the read-only toast's roles. */
export function readOnlyRole(session: Pick<Session, 'role'>): 'md' | 'guest' | null {
  return session.role === 'md' || session.role === 'guest' ? session.role : null
}
