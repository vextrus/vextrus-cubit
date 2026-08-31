// A member's project-role history, gathered across the workspace's projects. What a role history IS
// — which ledgers it reads, what an entry carries, who may read one — belongs to the participants
// module, which is the one home of it (ARCH-02, B-17); this file asks that home the same question
// once per project the workspace holds and says which project each answer came from, because an
// entry read out of its project is an entry nobody can place.
import { forTenant, isUuid, projects } from "../../../../core/db";
import { refusalOf } from "../../../../core/errors";
import { refusalCodeOf } from "../../../../core/faults/refusal-marker";
import { roleHistory, type RoleHistoryEntry } from "../../participants";
import { requireMembership } from "./members";
import type { TenancyActor } from "../scope";

/** One movement on a member's record, with the project it happened on. */
export interface MemberRoleHistoryEntry {
  readonly projectId: string;
  readonly entry: RoleHistoryEntry;
}

/**
 * The participants module's answer when the asking member may not read one project's history. The
 * code is read off the closed register in value position rather than re-spelled here, so this seam
 * and the registry entry cannot come to disagree (Q-07, ARCH-02).
 */
const PROJECT_PERMISSION_NOT_HELD = refusalOf("PERMISSION_NOT_HELD").code;

/**
 * Every role movement the workspace's ledgers hold about one member, project by project.
 *
 * The projects enumerated are the WORKSPACE's, read through the tenant handle: which projects a
 * member has a record on is exactly what this read answers, so it cannot be asked of the attachment
 * rows the answer is about — a project whose ledger names the member but whose attachment row was
 * never written, or was taken away, would silently drop out of their record. The projects are
 * visited in ascending code-point order of their ids, so the record reads the same way twice; inside
 * a project the order is the participants module's own, which is the record's order.
 *
 * The reading is done as the ASKING member, not as the subject: `roleHistory` refuses a caller who
 * neither stands on the project nor administers the workspace, and that guard is the one that
 * decides — a second judgement here would be a second answer to a question that has one. A project
 * it refuses is a project this reader is not entitled to and therefore contributes nothing; it is
 * passed over rather than turned into a refusal of the whole read, which would answer a member who
 * may read four of five projects with a project-scoped code about the fifth instead of the record
 * they may have. Membership of the workspace, checked above, is what admits the read at all.
 */
export async function memberRoleHistory(actor: TenancyActor, subjectUserId: string): Promise<readonly MemberRoleHistoryEntry[]> {
  await requireMembership(actor);
  if (!isUuid(subjectUserId)) return [];

  const held = await forTenant(actor).select({ projectId: projects.projectId }).from(projects);
  const projectIds = [...new Set(held.map((row) => row.projectId))].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

  const gathered: MemberRoleHistoryEntry[] = [];
  for (const projectId of projectIds) {
    let history: readonly RoleHistoryEntry[];
    try {
      history = await roleHistory({ tenantId: actor.tenantId, userId: actor.userId }, { projectId });
    } catch (thrown) {
      if (refusalCodeOf(thrown) === PROJECT_PERMISSION_NOT_HELD) continue;
      throw thrown;
    }
    for (const entry of history) {
      if (entry.subject.userId === subjectUserId) gathered.push({ projectId, entry });
    }
  }
  return gathered;
}
