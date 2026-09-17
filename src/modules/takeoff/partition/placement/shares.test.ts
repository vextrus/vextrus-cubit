// What the placement stage does when the edition it is pinned to states no share (L-MEA-01, ARCH-03).
//
// The edition is the only thing that varies here: the same project, the same call, one parameter
// taken away. The rule-set view is stubbed because what is graded is the reading, not the store.
import { describe, expect, test, vi } from "vitest";

const view = vi.hoisted(() => ({ answer: { pinned: true, parameters: {} } as { pinned: boolean; parameters: Record<string, { value: string }> } }));

vi.mock("@/core/rulesets/editions", () => ({ projectRulesetView: () => Promise.resolve(view.answer) }));

const { placementSharesOf } = await import("./shares");

const SCOPE = { tenantId: "a-tenant", projectId: "a-project" };

/** The four parameters L-MEA-01's shares are read off, at the seed's own values. */
const WHOLE: Record<string, { value: string }> = {
  placementContainmentMerge: { value: "0.25" },
  placementNearAnchor: { value: "0.5" },
  placementFootprintMin: { value: "0.05" },
  placementFootprintMax: { value: "2" },
};

describe("L-MEA-01: the shares a project's pin states", () => {
  test("an edition stating all four is read whole", async () => {
    view.answer = { pinned: true, parameters: { ...WHOLE } };
    expect(await placementSharesOf(SCOPE), "the shares are the pinned edition's and nothing else").toEqual({
      containmentMerge: "0.25",
      nearAnchor: "0.5",
      footprintMin: "0.05",
      footprintMax: "2",
    });
  });

  test("an edition missing one share answers none, and never throws", async () => {
    const bare: Record<string, { value: string }> = { ...WHOLE };
    delete bare["placementNearAnchor"];
    view.answer = { pinned: true, parameters: bare };

    await expect(
      placementSharesOf(SCOPE),
      "a stage with nothing to scale by places nothing and says so: throwing takes the whole partition down mid-job — the views, the grid and the schedules of a drawing with it (ARCH-03)",
    ).resolves.toBeNull();
  });

  test("a project pinned to no edition answers none", async () => {
    view.answer = { pinned: false, parameters: {} };
    await expect(placementSharesOf(SCOPE), "the same absence, and the same answer").resolves.toBeNull();
  });
});
