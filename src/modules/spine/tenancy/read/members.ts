// R-SPINE-003's members list, server-held: who belongs to this workspace, what role each holds and
// when they joined. Reading a workspace's roster is itself a permission — a signed-in stranger to
// the workspace is refused rather than answered with an empty list, because an empty list is an
// answer about a workspace they may not read at all.
import { workspacePermissionNotHeld } from "../refusals";
import { membershipsOf, roleHeld, type WorkspaceMembership } from "../roles/store";
import type { TenancyActor } from "../scope";

/** One member of a workspace, as this module answers with them. */
export type WorkspaceMember = WorkspaceMembership;

/**
 * The membership that admits a read of this workspace. Any role admits it: R-SPINE-006 guards who
 * may MOVE a role, while who may SEE the roster is membership itself — a person can hardly work
 * inside a workspace whose people they may not name.
 */
export async function requireMembership(actor: TenancyActor): Promise<void> {
  if ((await roleHeld(actor.tenantId, actor.userId)) === null) throw workspacePermissionNotHeld({});
}

/**
 * The workspace's members, in ascending code-point order of the id the store holds each under. The
 * order is total and it is the store's own — two members can no more share an id than one member can
 * hold two — so the list a person leaves is the list they come back to, whatever collation a
 * database or a browser happens to be configured with.
 */
export async function membersOf(actor: TenancyActor): Promise<readonly WorkspaceMember[]> {
  await requireMembership(actor);
  const held = await membershipsOf(actor.tenantId);
  return [...held].sort((left, right) => (left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0));
}
