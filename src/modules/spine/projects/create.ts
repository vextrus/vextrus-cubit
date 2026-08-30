// R-SPINE-010's creation, in ONE transaction: the project row, the rule-set edition it pins, the
// participation its creator holds, and the PRINCIPAL grant that participation carries. L-REG-07
// makes an unpinned project unrepresentable and L-ACT-03 says "project creation inserts its creator
// as PRINCIPAL in the same transaction" — so a creation that cannot finish any one of the four
// writes nothing at all.
//
// The grant is written here rather than through the act seam: `participant_roles.act_id` is nullable
// because "a project's first PRINCIPAL is installed by project creation, which is not an act
// somebody performed" (src/core/db.ts), and L-ACT-03's closed act enum holds no creation act to
// route through. Routing it through the seam would refuse PERMISSION_NOT_HELD on a project that
// holds no participant yet, which is the bootstrap this nullable column exists for.
import { forTenant, participantRoles, participants, projects } from "../../../core/db";
import type { Role } from "../../../core/acts";
import { creationColumnsOf, type ProjectFields } from "./draft";
import { pinRulesetForProject, type PinnedEdition } from "./ruleset-pin";
import type { ProjectsCtx } from "./scope";

/** L-ACT-03's all-permissions bundle — the role a project's creator is installed in. */
const PRINCIPAL: Role = "PRINCIPAL";

/** What creation answers with: the project it wrote, and the edition it pinned (L-REG-07). */
export interface CreatedProject {
  readonly projectId: string;
  readonly pin: PinnedEdition;
}

export async function createProject(ctx: ProjectsCtx, draft: ProjectFields): Promise<CreatedProject> {
  const columns = creationColumnsOf(draft);
  return forTenant(ctx).transaction(async (tx) => {
    const written = await tx.insert(projects).values({ ...columns, tenantId: ctx.tenantId }).returning({ projectId: projects.projectId });
    const row = written[0];
    if (row === undefined) throw new Error("the store accepted no project row — a project nobody can point at is not a project (R-SPINE-010)");
    const projectId = row.projectId;

    // Before the participation, because a pin that cannot be forked is the whole creation's answer:
    // the throw travels out of the transaction and the project row goes with it (L-REG-07).
    const pin = await pinRulesetForProject(tx, { tenantId: ctx.tenantId, projectId });

    await tx.insert(participants).values({ tenantId: ctx.tenantId, projectId, userId: ctx.userId });
    await tx.insert(participantRoles).values({ tenantId: ctx.tenantId, projectId, userId: ctx.userId, role: PRINCIPAL, actId: null });

    return { projectId, pin };
  });
}
