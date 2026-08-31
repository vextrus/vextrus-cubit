// The workspace behind the signed-in frame (R-UI-030, R-UI-033): which one the session holds, and
// the one write that renames it. Both go through the existing seams — `resolveSession` for who is
// asking (R-SPINE-001) and the handles of SEAM-TENANT for what is read and written — so this file
// owns no identity rule and no handle of its own.
//
// Membership is not tenant-scoped state a tenant handle could read: it is the row that says which
// tenant a person may be scoped to at all, and it is written by sign-up under the same system
// reason (src/server/auth/session.ts). Reading it therefore runs as the system, with the reason
// recorded beside the statement. A tenant's OWN row is the other case: `tenants` is under FORCE row
// security with `tenants_tenant_scope`, so the rename is written through `forTenant` — "the tenant's
// handle: the only way a tenant's rows are read or written" (src/core/db.ts) — and the policy, not
// the membership check five lines above it, is what makes a cross-tenant write impossible.
import { cache } from "react";
import { and, asc, eq, forTenant, isUuid, memberships, runAsSystem, storableText, tenants } from "../../core/db";
import type { RefusalCode } from "../../core/errors";
import { resolveSession } from "../auth/session";
import { sessionOf } from "./resolve";

/** The workspace a person is in: the uuid the URL names it by, and the name they gave it. */
export interface Workspace {
  tenantId: string;
  name: string;
}

/** What the rename answers with: the saved workspace, or the registered refusal that stopped it. */
export type RenameAnswer = { renamed: true; workspace: Workspace } | { renamed: false; refusal: RefusalCode };

/** The rename as a caller states it: who is asking, which workspace, and the name as presented. */
export interface RenameRequest {
  sessionToken: string | null;
  tenantId: string;
  name: string;
}

/**
 * The workspace the presented session holds, or null when it holds none — a dead cookie, a session
 * that has been revoked, or an account whose membership has gone. R-UI-031 makes the uuid the URL's
 * `{tenant}` segment, so the answer carries it beside the name the switcher and breadcrumb show.
 *
 * Multi-workspace membership is not part of the shipped product, so one membership is the one
 * workspace a person is in; `memberships` widening is what makes a switcher list longer. Which one
 * that is is stated rather than left to the planner: the earliest membership, which is the one
 * sign-up minted with the account. An unordered `limit 1` would let the frame, the breadcrumb, the
 * `/` door and the rename target name a different workspace from run to run the moment a second
 * membership exists — and the layout's tenant-mismatch branch would then deny a workspace the
 * person genuinely holds.
 *
 * Request-scoped (`cache`, see ./resolve): the layout and the screen inside it both ask.
 */
export const workspaceFor = cache(async (sessionToken: string | null): Promise<Workspace | null> => {
  const session = await sessionOf(sessionToken);
  if (session === null) return null;
  return earliestWorkspaceOf(session.userId);
});

/**
 * Every workspace the presented session's account is a member of, in the order the frame lists them
 * — the order `workspaceFor` picks its first from, so the switcher's first entry is the workspace a
 * person lands in when they name none.
 *
 * R-SPINE-003's ACCEPT flow is what makes this a list rather than a singleton: a person who spends
 * an invitation holds a second membership, and "one user, many tenants, the switcher live" is the
 * proof that clause asks for. Nothing is invented for an account with none — an empty list is the
 * honest answer for a session that holds no membership at all.
 *
 * Request-scoped (`cache`, see ./resolve): the layout asks once and the frame renders from it.
 */
export const workspacesFor = cache(async (sessionToken: string | null): Promise<readonly Workspace[]> => {
  const session = await sessionOf(sessionToken);
  if (session === null) return [];
  return workspacesOf(session.userId);
});

/**
 * The workspace an address names, when the session's account genuinely holds it — the frame's own
 * question, asked of the membership rather than of the earliest one. A person who belongs to two
 * workspaces is inside whichever the URL names (R-SPINE-002: the active tenant is explicit in the
 * URL), and comparing the named tenant against `workspaceFor`'s earliest would deny them the
 * membership they hold, which is precisely what `holdsWorkspace` below exists to avoid.
 */
export const namedWorkspaceFor = cache(async (sessionToken: string | null, tenantId: string): Promise<Workspace | null> => {
  const session = await sessionOf(sessionToken);
  if (session === null || !isUuid(tenantId)) return null;
  return (await workspacesOf(session.userId)).find((workspace) => workspace.tenantId === tenantId) ?? null;
});

/**
 * Does this account hold a membership in that workspace? This is the question every door that acts
 * *on a named workspace* asks — the rename below, and the project lifecycle doors on `/t/{tenant}`.
 *
 * It is deliberately not `workspaceFor`: that answers "the one workspace this person is in", the
 * EARLIEST membership, which is a different question and the wrong one to guard a write with. The
 * moment a second membership exists — which is what the shipped switcher anticipates — comparing a
 * named tenant against the earliest one refuses a person the membership they genuinely hold.
 *
 * The workspace arrives from a form field a caller can write anything into, and `tenants.tenant_id`
 * is a `uuid`: a value that is not one makes postgres raise 22P02, a driver error carrying no
 * refusal marker. A string that names no tenant names no tenant this account is a member of, so it
 * is answered here as "no membership" (the shape `scopedTenantId` takes in src/core/db.ts).
 *
 * Reading membership runs as the system for the reason stated at the head of this file: it is the
 * row that says which tenant a person may be scoped to at all, so no tenant handle can read it.
 */
export async function holdsWorkspace(userId: string, tenantId: string): Promise<boolean> {
  if (!isUuid(tenantId)) return false;
  const admitting = runAsSystem("the membership that admits a write to a named workspace");
  const held = await admitting
    .select({ tenantId: memberships.tenantId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)))
    .limit(1);
  return held[0] !== undefined;
}

/**
 * R-UI-033's rename, membership-checked: a person may rename the workspace they are a member of and
 * no other. A request with no live session is answered SIGNED_OUT and one from a non-member
 * PERMISSION_NOT_HELD — both registered answers, never faults (ARCH-03, B-21).
 *
 * The name is taken as presented, exactly as the door that first named the workspace takes it
 * (R-SPINE-002): case, spacing and length are the person's. What `text` has no representation for
 * is dropped through the seam's own `storableText`, because a value the database cannot store is
 * not an outage — the same settled reading sign-up follows.
 *
 * The workspace, by contrast, is a handle and is judged before it is used. It arrives from a form
 * field a caller can write anything into, and `tenants.tenant_id` is a `uuid`: a value that is not
 * one makes postgres raise 22P02, a driver error carrying no refusal marker, so a tampered or
 * missing field would answer a fault id for a request this door did judge. A string that names no
 * tenant names no tenant this session is a member of, which is PERMISSION_NOT_HELD — the same
 * answer the membership query gives, refused as the value is taken (the shape `scopedTenantId`
 * takes in src/core/db.ts).
 */
export async function renameWorkspace(request: RenameRequest): Promise<RenameAnswer> {
  const session = request.sessionToken === null ? null : await resolveSession(request.sessionToken);
  if (session === null) return { renamed: false, refusal: "SIGNED_OUT" };
  if (!isUuid(request.tenantId)) return { renamed: false, refusal: "PERMISSION_NOT_HELD" };

  if (!(await holdsWorkspace(session.userId, request.tenantId))) return { renamed: false, refusal: "PERMISSION_NOT_HELD" };

  // Scoped to the tenant the membership admitted, so the boundary is the policy's and not this
  // function's: `tenants_tenant_scope` matches the row by `cubit.tenant_id`, and a statement that
  // named another tenant's row would touch nothing however the check above were reordered or lost.
  const saved = await forTenant({ tenantId: request.tenantId })
    .update(tenants)
    .set({ name: storableText(request.name) })
    .where(eq(tenants.tenantId, request.tenantId))
    .returning({ tenantId: tenants.tenantId, name: tenants.name });

  const row = saved[0];
  if (row === undefined) return { renamed: false, refusal: "PERMISSION_NOT_HELD" };
  return { renamed: true, workspace: { tenantId: row.tenantId, name: row.name } };
}

/**
 * The workspace a membership joins this account to, with the name the tenant row carries. The order
 * is total, not merely stated: `created_at` names the earliest membership, and the tenant uuid
 * settles the tie two memberships written in the same transaction would otherwise leave open.
 */
async function earliestWorkspaceOf(userId: string): Promise<Workspace | null> {
  return (await workspacesOf(userId))[0] ?? null;
}

/** Every membership's workspace, in that same total order — the one statement both readings use. */
async function workspacesOf(userId: string): Promise<readonly Workspace[]> {
  const db = runAsSystem("R-UI-030 shell frame: the workspaces a signed-in account is a member of, and the names they wear");
  const rows = await db
    .select({ tenantId: tenants.tenantId, name: tenants.name })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.tenantId, memberships.tenantId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt), asc(memberships.tenantId));
  return rows.map((row) => ({ tenantId: row.tenantId, name: row.name }));
}
