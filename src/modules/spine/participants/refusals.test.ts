// The two refusals this module and its screen stand on, exercised by name (Q-07, R-SPINE-062).
//
// Neither is a fault: R-SPINE-011 protects a project's last PRINCIPAL and L-ACT-03 holds the role
// history behind one guard, and both of those are answers a person is owed — so both travel as the
// settled marker, carrying the facts the law says they name, and both are registered entries with
// copy the one renderer shows (ARCH-03, B-21).
import { describe, expect, test } from "vitest";
import { permissionNotHeld, projectWouldHaveNoPrincipal } from "../../../core/acts";
import { REFUSALS } from "../../../core/errors";
import { refusalCodeOf } from "../../../core/faults/refusal-marker";

const ASSIGN_PARTICIPANT_ROLE = "ASSIGN_PARTICIPANT_ROLE";
const ADMINISTER_PROJECT = "ADMINISTER_PROJECT";
const PROJECT_WOULD_HAVE_NO_PRINCIPAL = "PROJECT_WOULD_HAVE_NO_PRINCIPAL";
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** One fact of the thrown marker, read the way a transport and a screen read it. */
function fact(thrown: unknown, name: string): unknown {
  return (thrown as Record<string, unknown>)[name];
}

describe("R-SPINE-011: the refusals the participants surface answers with", () => {
  test(`${PROJECT_WOULD_HAVE_NO_PRINCIPAL} is registered, and the seam's refusal carries it`, () => {
    const entry = REFUSALS[PROJECT_WOULD_HAVE_NO_PRINCIPAL];
    expect(entry.code, "the registry is keyed by the code itself").toBe(PROJECT_WOULD_HAVE_NO_PRINCIPAL);
    expect(entry.message.trim().length, "a refusal says what was refused and why").toBeGreaterThan(0);
    expect(entry.remedy.trim().length, "…and one sentence that resolves it").toBeGreaterThan(0);
    expect(entry.message, "the taxonomy code is never user-facing copy (refusal-state § 3)").not.toContain(PROJECT_WOULD_HAVE_NO_PRINCIPAL);
    expect(entry.remedy, "nor is it the remedy").not.toContain(PROJECT_WOULD_HAVE_NO_PRINCIPAL);

    const thrown = projectWouldHaveNoPrincipal(ASSIGN_PARTICIPANT_ROLE, "a-project", "a-subject");
    expect(refusalCodeOf(thrown), "it travels as the settled refusal marker, which is what makes it an answer").toBe(PROJECT_WOULD_HAVE_NO_PRINCIPAL);
    expect(fact(thrown, "actType"), "and it names the act that would have left the project without one").toBe(ASSIGN_PARTICIPANT_ROLE);
    expect(fact(thrown, "subjectUserId"), "…and the subject whose grant it protected").toBe("a-subject");
  });

  test(`the read path's ${PERMISSION_NOT_HELD} names ${ADMINISTER_PROJECT} and no act type`, () => {
    // L-ACT-03: "a read-path `PERMISSION_NOT_HELD` names the missing permission (it has no act type
    // to name, and that is lawful)" — which is exactly what the role-history guard raises.
    const thrown = permissionNotHeld(null, ADMINISTER_PROJECT);
    expect(refusalCodeOf(thrown)).toBe(PERMISSION_NOT_HELD);
    expect(fact(thrown, "permission"), "the missing permission is named").toBe(ADMINISTER_PROJECT);
    expect(fact(thrown, "actType"), "a read moves nothing, so there is no act type to name").toBeNull();
  });
});
