// L-ACT-03: "Project lifecycle and identity (archive, restore, field edits) require tenant
// OWNER/ADMIN or participation on the project." One guard at the seam, used by all three doors
// (ARCH-02) — a door that judged for itself would be a second answer to one question.
//
// At M0 the clause reduces to participation: `memberships` carries no role column and the tree
// declares no OWNER/ADMIN anywhere, so there is no tenant role to read. The limb is left unwritten
// rather than faked against a column that does not exist; when workspace roles land, this guard is
// where they widen it.
//
// Archiving moves a marker and deletes nothing: `archived_at` is set to the moment it happened and
// restore puts it back to the absence archiving found. Every lifecycle write moves `updated_at` too,
// because that is the project's last activity, which is what S-Home reads.
import { and, eq, forTenant, isUuid, participants, projects, type TenantTx } from "../../../core/db";
import { permissionNotHeld } from "../../../core/acts/refusals";
import { columnsOf, type ProjectChanges, type ProjectColumns } from "./draft";
import type { ProjectsCtx } from "./scope";

/**
 * ADMINISTER_PROJECT is the permission L-ACT-03 makes PRINCIPAL-only, and lifecycle is what it
 * administers. The act type is null: archive, restore and a field edit are lifecycle rather than
 * acts, and the clause's read-path precedent says a refusal with no act type to name is lawful.
 */
const LIFECYCLE_PERMISSION = "ADMINISTER_PROJECT" as const;

/** One project, as a caller names it. */
export interface ProjectRef {
  readonly projectId: string;
}

/** A field edit: the project, and the R-SPINE-010 fields it moves. */
export type ProjectEdit = ProjectRef & ProjectChanges;

export async function updateProject(ctx: ProjectsCtx, edit: ProjectEdit): Promise<void> {
  const { projectId, ...changes } = edit;
  await write(ctx, projectId, columnsOf(changes));
}

export async function archiveProject(ctx: ProjectsCtx, ref: ProjectRef): Promise<void> {
  await write(ctx, ref.projectId, { archivedAt: new Date() });
}

export async function restoreProject(ctx: ProjectsCtx, ref: ProjectRef): Promise<void> {
  await write(ctx, ref.projectId, { archivedAt: null });
}

/** What a lifecycle write sets, beside the last activity every one of them moves. */
type LifecycleColumns = ProjectColumns & { archivedAt?: Date | null };

/**
 * The guard, then the write, in one transaction — so the participation that admitted the write is
 * the participation the store held when it landed.
 */
async function write(ctx: ProjectsCtx, projectId: string, columns: LifecycleColumns): Promise<void> {
  await forTenant(ctx).transaction(async (tx) => {
    await requireLifecycle(tx, ctx, projectId);
    await tx
      .update(projects)
      .set({ ...columns, updatedAt: new Date() })
      .where(and(eq(projects.projectId, projectId), eq(projects.tenantId, ctx.tenantId)));
  });
}

/**
 * Participation on the project, read through the tenant's own handle. The workspace is named in the
 * predicate as well as enforced by row-level security: a guard whose whole scoping rests on a policy
 * is a guard that admits everything the day the policy is read wrong, and a query that says what it
 * means is the one that can be reviewed (B-17). The id is judged before it is compared: a
 * `project_id` that is not a uuid makes postgres raise 22P02 — a driver error carrying no refusal
 * marker — so a value naming no project of this workspace is answered as the refusal it is, exactly
 * as `scopedTenantId` refuses a tenant it cannot read (ARCH-03, B-21).
 */
async function requireLifecycle(tx: TenantTx, ctx: ProjectsCtx, projectId: string): Promise<void> {
  if (isUuid(projectId)) {
    const held = await tx
      .select({ userId: participants.userId })
      .from(participants)
      .where(and(eq(participants.projectId, projectId), eq(participants.userId, ctx.userId), eq(participants.tenantId, ctx.tenantId)))
      .limit(1);
    if (held[0] !== undefined) return;
  }
  throw permissionNotHeld(null, LIFECYCLE_PERMISSION);
}
