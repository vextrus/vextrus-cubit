/*
 * The shapes ticket #75 adds to the API (fixed by the orchestrator on 29 Sep 2026, before #75 merged):
 * the "Access ended" facts, an invitation's projects by code and name, and each Members row's inviter
 * id and the acts the signed-in user may do on it. Until #75 is on `main` and `npm run api:types`
 * brings them, the web reads them through these types, and every variant is tested on fixtures of
 * these exact shapes (src/app/seed/api.fixture.ts). When #75 merges, the generated types replace this
 * file and its two loose calls move to `api`.
 */
import type { components } from './schema.gen'
import { callLoose } from './client'

type Schemas = components['schemas']
type RoleName = Schemas['MembershipOut']['role']

/** An ended Membership, as #75 sends it in `/api/me`'s `ended` (newest first). */
export interface EndedOut75 {
  membership_id: string
  developer_id: string
  developer_name: string
  role: RoleName
  ended_at: string
  how: 'revoked' | 'expired'
  /** Who revoked it, by name; null when no revocation names an actor, or it expired. */
  revoked_by: string | null
  /** The Projects it gave; empty means every Project. */
  project_ids: string[]
}

/** `/api/me` with #75's fields. */
export interface MeOut75 extends Omit<Schemas['MeOut'], 'ended'> {
  ended: EndedOut75[]
  /** The Membership the session was working in when it ended, kept while it is in `ended`. */
  ended_membership_id: string | null
}

/** The acts the signed-in user may do on a Members row, computed by the server's rule. */
export type MemberAction = 'revoke' | 'renew' | 'copy_link' | 'withdraw'

interface RowFacts75 {
  invited_by_id: string | null
  actions: MemberAction[]
}

export type PersonOut75 = Schemas['PersonOut'] & RowFacts75

export type PendingOut75 = Schemas['PendingOut'] & RowFacts75

/**
 * What an invitation link offers (`POST /api/invitations/look-up`, `platform/http/auth.py` `LinkOut`).
 * Typed here because the OpenAPI schema names two schemas `LinkOut` (the look-up's and the Members
 * page's new link) and keeps only the second, so the generated type of the look-up is wrong: an API
 * gap this ticket reports.
 */
export interface LookUpOut {
  developer_name: string
  invited_by: string | null
  role: RoleName
  email: string
  /** The Projects it gives; empty means every Project. */
  project_ids: string[]
  expires_at: string | null
  link_expires_at: string
  has_account: boolean
}

export interface MembersOut75 {
  people: PersonOut75[]
  vextrus_access: PersonOut75[]
  invitations: PendingOut75[]
}

/** A scoped ended Membership's project codes (for 4.1's "Your access to KR-01 at …"). */
export interface EndedProjectsOut {
  membership_id: string
  codes: string[]
}

/** A project an invitation link gives, by code and name (4.2's "…to KR-01 Kadam Residence"). */
export interface LinkProjectOut {
  code: string
  name: string
}

/** `GET /api/ended-access/projects`: only scoped ended Memberships appear. */
export function endedAccessProjects(): Promise<EndedProjectsOut[]> {
  return callLoose<EndedProjectsOut[]>('GET', '/api/ended-access/projects')
}

/** `POST /api/invitations/look-up/projects`: the link's projects, sorted by code; its refusal is the look-up's. */
export function lookUpProjects(token: string): Promise<LinkProjectOut[]> {
  return callLoose<LinkProjectOut[]>('POST', '/api/invitations/look-up/projects', { token })
}
