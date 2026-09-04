/**
 * The manifest memo, across two workspaces (R-UI-043's cache, AC-7's refusal, Q-12's tenancy).
 *
 * Two workspaces can hold the same drawing: content is addressed by the sha256 of its own bytes, so
 * two people who upload the same DXF have records naming one address under two tenant prefixes. The
 * memo that makes the second open of a sheet a hit is keyed by that address and the layout name
 * alone, so what one workspace built is served to the other — including when the second workspace's
 * own store holds nothing at all at that address, which is the case AC-7 fixes: "a missing object
 * answers the registered MANIFEST_NOT_RENDERABLE refusal with the ingest record's facts".
 *
 * The failure this pins is not a slower cache. It is an answer that depends on somebody else's
 * traffic: the same request, from the same workspace, for the same drawing, answers the refusal
 * before a stranger opens their copy and answers a sheet afterwards. Proved on the running app
 * first — one workspace's `?part=head` answered `{"kind":"refusal"}`, then a second workspace opened
 * its own copy, and the first answered `{"kind":"manifest","cache":"hit"}` without its store ever
 * being read.
 *
 * The stage is the merged one, driven exactly as AC-2 and AC-3 drive it (ARCH-02).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { closeStage } from "../../spine/uploads/support/upload-stage";
import { openThumbnailsStage, stageIngested, stagePerson, storageOf } from "../support/thumbnails-stage";
import { MANIFEST_NOT_RENDERABLE, committedArtifactNames, committedGraph, fixedStorage, layoutNamesOf, viewerSeam, type StorageLike } from "./support/viewer-support";

/** The artifact both workspaces hold — the first of the committed corpus, as AC-2 uses it. */
const FIXTURE = committedArtifactNames()[0] as string;

beforeAll(async () => {
  await openThumbnailsStage();
}, 180_000);

afterAll(async () => {
  await closeStage();
});

describe("one workspace's build is not another workspace's answer", () => {
  test("a workspace whose store holds nothing at the record's address is refused, whoever else opened the same content", async () => {
    const { renderManifestOf } = await viewerSeam();
    const layoutName = layoutNamesOf(committedGraph(FIXTURE))[0] as string;

    const first = await stagePerson("viewer-tenancy-one");
    const firstDrawing = await stageIngested(first.person, first.projectId, FIXTURE);
    const second = await stagePerson("viewer-tenancy-two");
    const secondDrawing = await stageIngested(second.person, second.projectId, FIXTURE);

    expect(
      secondDrawing.record.artifactSha256,
      "both workspaces read the same drawing, so both records name one content address — which is what makes this two answers to one key",
    ).toBe(firstDrawing.record.artifactSha256);

    // The first workspace opens its own sheet, from its own store: a build, and a memo entry.
    const built = await renderManifestOf(
      { tenantId: first.person.tenantId, drawingId: firstDrawing.drawing.drawingId, layoutName },
      { storage: (await storageOf()) as StorageLike },
    );
    expect(built.kind, "the first workspace's own sheet is built from its own bytes").toBe("manifest");

    // The second workspace's store answers nothing at that address — the outage AC-7 rules on.
    const theirStorage = fixedStorage(null);
    const head = await renderManifestOf({ tenantId: second.person.tenantId, drawingId: secondDrawing.drawing.drawingId, layoutName }, { storage: theirStorage });

    expect(
      head.kind,
      "an address this workspace's store cannot answer is this workspace's refusal (AC-7), not a sheet assembled out of what somebody else's store held",
    ).toBe("refusal");
    if (head.kind !== "refusal") return;
    expect(head.refusal.code, "and it is the registered code").toBe(MANIFEST_NOT_RENDERABLE);
    expect(head.facts, "with this workspace's own record's facts").toEqual(secondDrawing.record.facts);
    expect(
      theirStorage.gets().length,
      "the store this call was handed is the store the answer comes from: a memo that skips it answers for a workspace out of another's bytes",
    ).toBeGreaterThan(0);
  }, 180_000);
});
