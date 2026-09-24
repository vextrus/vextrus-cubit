/**
 * What S-Ask's page reads on arrival, live (docs/design/s-ask.md I-403, §2 Empty): a project with no
 * campaign answers no campaign and the stamp of nothing — the empty cell's truth, never a fault. The
 * stamp over a pinned campaign is walked by J-043, whose stage pins one.
 *
 * The world is a scratch database the committed migrations built; the person is enrolled through the
 * shipped sign-up door and the project is staged the upload lane's way.
 */
import { afterAll, describe, expect, it } from "vitest";
import { closeStage, enrol, openStage, productModule, stageProject } from "../../spine/uploads/support/upload-stage";

interface ArrivalModule {
  askArrivalOf(scope: { tenantId: string; projectId: string }): Promise<{ campaign: unknown; stamp: string; example: unknown }>;
}

afterAll(async () => {
  await closeStage();
});

describe("askArrivalOf, against a live store", () => {
  it("a project with no campaign answers no campaign, the stamp of nothing, and no example", async () => {
    await openStage();
    const person = await enrol("ask-arrival");
    const projectId = stageProject(person.tenantId, "Ask — arrival");
    const arrival = await productModule<ArrivalModule>("src/modules/takeoff/ask/arrival.ts");
    const read = await arrival.askArrivalOf({ tenantId: person.tenantId, projectId });
    expect(read.campaign, "nothing is pinned, so nothing can be asked").toBeNull();
    expect(read.example).toBeNull();
    expect(read.stamp).toBe("none");
  }, 300_000);
});
