// A member's project-role history, gathered across the workspace's projects. What a role history IS
// — which ledgers it reads, what an entry carries, who may read one — belongs to the participants
// module, which is the one home of it (ARCH-02, B-17); this file asks that home the same question
// once per project the member stands on and says which project each answer came from, because an
// entry read out of its project is an entry nobody can place.
import { eq, forTenant, isUuid, participants } from "../../../../core/db";
import { roleHistory, type RoleHistoryEntry } from "../../participants";
import { requireMembership } from "./members";
import type { TenancyActor } from "../scope";

/** One movement on a member's record, with the project it happened on. */
export interface MemberRoleHistoryEntry {
  readonly projectId: string;
  readonly entry: RoleHistoryEntry;
}

/**
 * Every role movement the workspace's ledgers hold about one member, project by project. The
 * projects are visited in ascending code-point order of their ids, so the record reads the same way
 * twice; inside a project the order is the participants module's own, which is the record's order.
 *
 * The reading is done as the ASKING member, not as the subject: `roleHistory` refuses a caller who
 * neither stands on the project nor administers the workspace, and that guard is the one that
 * decides — a second judgement here would be a second answer to a question that has one.
 */
export async function memberRoleHistory(actor: TenancyActor, subjectUserId: string): Promise<readonly MemberRoleHistoryEntry[]> {
  await requireMembership(actor);
  if (!isUuid(subjectUserId)) return [];

  const standing = await forTenant(actor).select({ projectId: participants.projectId }).from(participants).where(eq(participants.userId, subjectUserId));
  const projectIds = [...new Set(standing.map((row) => row.projectId))].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

  const gathered: MemberRoleHistoryEntry[] = [];
  for (const projectId of projectIds) {
    const history = await roleHistory({ tenantId: actor.tenantId, userId: actor.userId }, { projectId });
    for (const entry of history) {
      if (entry.subject.userId === subjectUserId) gathered.push({ projectId, entry });
    }
  }
  return gathered;
}
