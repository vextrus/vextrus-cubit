// The three answers the act seam gives instead of writing, judged as answers (ARCH-03, B-21): each
// travels as the tree's one refusal marker, carries a code the closed register holds, and carries the
// facts its clause says it names. Nothing here reaches a database — the guards these prove are the
// ones that answer before any state is read.
import { describe, expect, it } from "vitest";
import { REFUSALS } from "../../errors";
import { isRefusalMarked, refusalCodeOf } from "../../faults/refusal-marker";
import { preview } from "../index";
import { ACT_PERMISSION, type ActType } from "../law";
import { actorNotHuman, consequencesNotCarried, permissionNotHeld, type ActorKind } from "../refusals";

/** The act type these refusals are raised over, and the input shape its callers pass. */
const ASSIGN_PARTICIPANT_ROLE: ActType = "ASSIGN_PARTICIPANT_ROLE";

const input = {
  type: ASSIGN_PARTICIPANT_ROLE,
  projectId: "00000000-0000-4000-8000-000000000001",
  subjectUserId: "00000000-0000-4000-8000-000000000002",
  role: "REVIEWER",
} as const;

/** A property the refusal carries, read the way a caller reads it. */
const carried = (thrown: unknown, name: string): unknown => (thrown as Record<string, unknown>)[name];

describe("the act seam's refusals are marked, registered and carry what the law says they carry", () => {
  it("PERMISSION_NOT_HELD carries the act type and the missing permission (L-ACT-03)", () => {
    const permission = ACT_PERMISSION[ASSIGN_PARTICIPANT_ROLE];
    const refusal = permissionNotHeld(ASSIGN_PARTICIPANT_ROLE, permission);
    expect(isRefusalMarked(refusal), "a refusal is an answer, and the marker is how every door reads it").toBe(true);
    expect(refusalCodeOf(refusal)).toBe("PERMISSION_NOT_HELD");
    expect(Object.hasOwn(REFUSALS, "PERMISSION_NOT_HELD"), "the code belongs to the closed register (B-17)").toBe(true);
    expect(carried(refusal, "actType")).toBe(ASSIGN_PARTICIPANT_ROLE);
    expect(carried(refusal, "permission")).toBe(permission);
  });

  it("PERMISSION_NOT_HELD on a read path names the permission and no act type — which is lawful (L-ACT-03)", () => {
    const refusal = permissionNotHeld(null, "ADMINISTER_PROJECT");
    expect(refusalCodeOf(refusal)).toBe("PERMISSION_NOT_HELD");
    expect(carried(refusal, "actType"), "a read has no act type to name").toBeNull();
    expect(carried(refusal, "permission")).toBe("ADMINISTER_PROJECT");
  });

  it("CONSEQUENCES_NOT_CARRIED names the digest carried and the one the state produces (L-ACT-02)", () => {
    const refusal = consequencesNotCarried(ASSIGN_PARTICIPANT_ROLE, "carried-digest", "current-digest");
    expect(isRefusalMarked(refusal)).toBe(true);
    expect(refusalCodeOf(refusal)).toBe("CONSEQUENCES_NOT_CARRIED");
    expect(Object.hasOwn(REFUSALS, "CONSEQUENCES_NOT_CARRIED")).toBe(true);
    expect(carried(refusal, "carried")).toBe("carried-digest");
    expect(carried(refusal, "current")).toBe("current-digest");
  });

  it("ACTOR_NOT_HUMAN names the kind of actor that tried (L-ACT-01, SEAM-ACT)", () => {
    const refusal = actorNotHuman(ASSIGN_PARTICIPANT_ROLE, "machine");
    expect(isRefusalMarked(refusal)).toBe(true);
    expect(refusalCodeOf(refusal)).toBe("ACTOR_NOT_HUMAN");
    expect(Object.hasOwn(REFUSALS, "ACTOR_NOT_HUMAN")).toBe(true);
    expect(carried(refusal, "actorKind")).toBe("machine");
  });

  it("the seam refuses a non-human actor before it reads anything at all (SEAM-ACT)", async () => {
    // No database is reached here, and that is the assertion: the log is human-only, so a machine or
    // a model is turned away by type rather than by what it would have been allowed to do.
    for (const actorKind of ["machine", "model"] as const satisfies readonly ActorKind[]) {
      const thrown: unknown = await preview({ tenantId: "00000000-0000-4000-8000-0000000000ff", userId: "00000000-0000-4000-8000-000000000003", actorKind }, input).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(refusalCodeOf(thrown), `a ${actorKind} actor is refused ACTOR_NOT_HUMAN by type`).toBe("ACTOR_NOT_HUMAN");
      expect(carried(thrown, "actorKind")).toBe(actorKind);
      expect(carried(thrown, "actType")).toBe(ASSIGN_PARTICIPANT_ROLE);
    }
  });
});
