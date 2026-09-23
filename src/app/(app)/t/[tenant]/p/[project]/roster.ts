// The project's roster as the two readers of a project's people take it — S-Project's participants
// table and both screens' act logs, which name an actor by it (s-project I-146, s-audit I-38). One
// read, through the participants module's own guarded door, so the account a label names is never
// resolved a second way (B-17).
import type { RefusalCode } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { projectParticipants } from "@/modules/spine/participants";
import { presentedValue } from "@/server/auth/folded-key";
import { sessionOf } from "@/server/shell/resolve";
import { presentedSessionToken } from "@/server/shell/session";
import { strings } from "@/ui/strings";
import type { ProjectHomeRoster } from "./home/project-home";

/** Who is asking about the roster: the same three facts the participants door takes first. */
type RosterCtx = { tenantId: string; userId: string; actorKind: "human" };

/** Account id → the label the roster names the person by. */
export type ProjectPeople = Readonly<Record<string, string>>;

/**
 * The address an account presents, read back out of its folded key (I-51) — or null where the account
 * is digest-keyed and has no address to present.
 */
function addressOf(emailKey: string | null): string | null {
  return emailKey === null ? null : presentedValue(emailKey);
}

/**
 * The roster, or the refusal that stands in its place (s-project I-129). A code the register knows is
 * the screen's partial answer; anything else is a fault and rises to the boundary untouched (ARCH-03).
 */
export async function rosterOf(ctx: RosterCtx, projectId: string): Promise<ProjectHomeRoster> {
  try {
    const roster = await projectParticipants(ctx, { projectId });
    return {
      roster: roster.map((row) => ({
        userId: row.member.userId,
        label: addressOf(row.member.emailKey) ?? strings.spine_participants_member_unnamed,
        roles: row.roles,
        named: addressOf(row.member.emailKey) !== null,
      })),
    };
  } catch (thrown) {
    const code = refusalCodeOf(thrown);
    if (code !== "PERMISSION_NOT_HELD") throw thrown;
    return { refusal: code satisfies RefusalCode };
  }
}

/**
 * The people a roster can name, for the act logs. A refused roster names nobody, and an account with
 * no address is not named by the "unnamed" word — an actor the roster cannot name is shown by the id
 * the log recorded, which is at least an identity a person can copy and compare (R-UI-082).
 */
export function peopleOf(roster: ProjectHomeRoster): ProjectPeople {
  if ("refusal" in roster) return {};
  return Object.fromEntries(roster.roster.filter((member) => member.named !== false).map((member) => [member.userId, member.label]));
}

/**
 * The people the signed-in reader may see named on this project — nobody, where there is no session
 * or the roster refuses them. S-Audit's page asks this; S-Project's reads the roster itself, because
 * it renders the roster too.
 */
export async function projectPeople(tenantId: string, projectId: string): Promise<ProjectPeople> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return {};
  return peopleOf(await rosterOf({ tenantId, userId: session.userId, actorKind: "human" }, projectId));
}
