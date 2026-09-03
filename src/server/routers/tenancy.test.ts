// The narrowing each mutation's input reader does (B-17): `assignRoleInput` hands its resolver the
// move it names and no other. The module answers the kind it was asked for today, so the guard that
// says so only fires if the module ever answered another — which is exactly why it is here, and why
// it is proved against a module that does answer another rather than against a body the module's own
// reader already rejects. A body nobody could read is a fault; so is a move that is not the one the
// resolver dispatches (ARCH-03: nobody was judged and found wanting).
import { describe, expect, test, vi } from "vitest";

import { refusalCodeOf } from "../../core/faults/refusal-marker";

vi.mock("../../modules/spine/tenancy", async (importOriginal) => {
  const shipped = await importOriginal<typeof import("../../modules/spine/tenancy")>();
  return {
    ...shipped,
    // The module as it would be if a later change crossed the two moves: everything else shipped,
    // and the reader answering the kind the caller did NOT ask for.
    tenancyMutationFrom: (kind: "assignRole" | "removeMember", body: unknown) =>
      shipped.tenancyMutationFrom(kind === "assignRole" ? "removeMember" : "assignRole", body),
  };
});

const READABLE_BODY = { subjectUserId: "u", role: "MEMBER" };

/** What a reader threw, as a value — a reader that returned instead fails here rather than later. */
function thrownBy(read: () => unknown): Promise<unknown> {
  return Promise.resolve()
    .then(read)
    .then(
      () => {
        throw new Error("the reader dispatched a move it was not asked for");
      },
      (thrown: unknown) => thrown,
    );
}

describe("a move the module read as another kind is stopped by the reader that asked for it", () => {
  test("assignRoleInput throws an unmarked failure naming the kind it was handed", async () => {
    const { assignRoleInput } = await import("./tenancy");

    const failure = await thrownBy(() => assignRoleInput(READABLE_BODY));
    expect(failure, "a body the module read as a removal is not dispatched as an assignment").toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("removeMember");
    expect(refusalCodeOf(failure), "a move nobody stated is a fault, never a registered refusal").toBeNull();
  });

  test("removeMemberInput throws the same way", async () => {
    const { removeMemberInput } = await import("./tenancy");

    const failure = await thrownBy(() => removeMemberInput(READABLE_BODY));
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("assignRole");
    expect(refusalCodeOf(failure)).toBeNull();
  });
});
