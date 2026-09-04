/**
 * AC-2 and AC-3's server half — `renderManifestOf` over a live stage: a drawing recorded through the
 * shipped ingest door from a committed artifact, its manifest built once and served from the
 * content-keyed cache thereafter (R-UI-043), and a damaged reading answered as the registered
 * refusal with the record's own fidelity facts rather than as a thrown fault.
 *
 * The stage is the merged one (`tests/spine/uploads/support/upload-stage.ts` through
 * `tests/takeoff/support/thumbnails-stage.ts#stageIngested`): a scratch database built by the tree's
 * own migration lane, a scratch storage root, real accounts through the shipped sign-up door, and an
 * ingest record written by the shipped job. Nothing here invents a second way to record an ingest
 * (ARCH-02), and the fixtures are read from the declared corpus rather than named by hand (B-19).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { closeStage } from "../../spine/uploads/support/upload-stage";
import { openThumbnailsStage, stageIngested, stagePerson, storageOf } from "../support/thumbnails-stage";
import {
  ERRORS_MODULE,
  MANIFEST_NOT_RENDERABLE,
  committedArtifactNames,
  committedGraph,
  countingStorage,
  fixedStorage,
  layoutNamesOf,
  productModule,
  viewerSeam,
  type ErrorsModule,
  type StorageLike,
} from "./support/viewer-support";

/**
 * The corpus, in its own order. AC-2's subject is the first artifact; AC-3's damaged reading must be a
 * *different* content, because R-UI-043's two halves meet on one content: a manifest already built for
 * a sha is served from the content-hash memo the clause orders, so a damaged reading of that same sha
 * would grade honoured caching as a missing refusal. The damaged fixture is therefore chosen by
 * distinctness rather than by position in the list, and where the corpus cannot supply a second
 * content the AC-3 test says so by name instead of blaming the product.
 */
const CORPUS = committedArtifactNames();
const CACHED_FIXTURE = CORPUS[0] as string;
const DAMAGED_FIXTURE = CORPUS.find((name) => name !== CACHED_FIXTURE);

/** Bytes that are JSON and are not an EntityGraph — what a damaged reading leaves behind. */
const DAMAGED_BYTES = new TextEncoder().encode(JSON.stringify({ entitygraph_version: 2, this: "is not the artifact the mirror parses" }));

beforeAll(async () => {
  await openThumbnailsStage();
}, 180_000);

afterAll(async () => {
  await closeStage();
});

describe("AC-2: the manifest is built once and served from the content-keyed cache", () => {
  test("AC-2: the first call misses and builds, the second hits with the same manifest, and the artifact is read once", async () => {
    const { renderManifestOf } = await viewerSeam();
    const { person, projectId } = await stagePerson("viewer-cache");
    const { drawing, record } = await stageIngested(person, projectId, CACHED_FIXTURE);
    const layoutName = layoutNamesOf(committedGraph(CACHED_FIXTURE))[0] as string;
    const scope = { tenantId: person.tenantId, drawingId: drawing.drawingId, layoutName };
    const storage = countingStorage((await storageOf()) as StorageLike);

    const first = await renderManifestOf(scope, { storage });
    expect(first.kind, `${CACHED_FIXTURE} / ${layoutName}: a recorded drawing answers with its manifest`).toBe("manifest");
    if (first.kind !== "manifest") return;
    expect(first.cache, "the first call for a content builds it").toBe("miss");
    expect(first.facts, "the head carries the ingest record's own facts (R-TO-001)").toEqual(record.facts);
    expect(first.manifest.layoutName, "the manifest is of the layout that was asked for").toBe(layoutName);

    const second = await renderManifestOf(scope, { storage });
    expect(second.kind, "the second call answers the same way").toBe("manifest");
    if (second.kind !== "manifest") return;
    expect(second.cache, "the second call for the same content is served from the cache").toBe("hit");
    expect(second.manifest, "and it is the same manifest, whole").toEqual(first.manifest);

    expect(
      storage.getsOf(record.artifactSha256),
      `the artifact at ${record.artifactSha256} is read once across both calls — a cache that re-read the bytes is not a cache (R-UI-043)`,
    ).toBe(1);
  }, 180_000);

  test("AC-2: the cache key is deterministic for one content and one layout, and differs by layout", async () => {
    const { manifestCacheKey } = await viewerSeam();
    const artifactSha256 = "a".repeat(64);
    const [one, other] = [layoutNamesOf(committedGraph(CACHED_FIXTURE))[0] as string, "another sheet of the same drawing"];

    expect(manifestCacheKey(artifactSha256, one), "one content and one layout key the same way every time").toBe(manifestCacheKey(artifactSha256, one));
    expect(manifestCacheKey(artifactSha256, one), "two layouts of one content are two manifests, so two keys").not.toBe(manifestCacheKey(artifactSha256, other));
    expect(manifestCacheKey(artifactSha256, one), "two contents are two manifests, so two keys").not.toBe(manifestCacheKey("b".repeat(64), one));
  });
});

describe("AC-3: a reading the mirror cannot parse is refused in place, with the facts", () => {
  test("AC-3: renderManifestOf answers the registered refusal and the record's facts, never a fault", async () => {
    expect(DAMAGED_FIXTURE, "AC-3 needs a fixture whose content the AC-2 cache never built").toBeDefined();
    const damagedFixture = DAMAGED_FIXTURE as string;

    const { renderManifestOf } = await viewerSeam();
    const { refusalOf } = await productModule<ErrorsModule>(ERRORS_MODULE);
    const { person, projectId } = await stagePerson("viewer-damaged");
    const { drawing, record } = await stageIngested(person, projectId, damagedFixture);
    const layoutName = layoutNamesOf(committedGraph(damagedFixture))[0] as string;

    const entry = refusalOf(MANIFEST_NOT_RENDERABLE);
    expect(entry.severity, `${MANIFEST_NOT_RENDERABLE} is registered as an error (R-SPINE-062)`).toBe("error");
    expect(entry.surface, "and rendered on the banner surface").toBe("banner");

    // The storage answers bytes the mirror does not parse for the address the record names: this is
    // what a damaged reading is, seen from the seam that must answer for it. The reading is counted, so
    // the refusal below is graded against bytes the seam really opened for this content — never against
    // a content-hash memo already holding a manifest, which is the other half of R-UI-043, not this one.
    const storage = countingStorage(fixedStorage(DAMAGED_BYTES));
    const head = await renderManifestOf({ tenantId: person.tenantId, drawingId: drawing.drawingId, layoutName }, { storage });

    expect(
      storage.getsOf(record.artifactSha256),
      `the seam read the bytes at ${record.artifactSha256} once: this content was never built into the cache, so the refusal that follows is a reading of these bytes (R-UI-043)`,
    ).toBe(1);
    expect(head.kind, "a damaged reading is a refusal, not a thrown fault (R-UI-043)").toBe("refusal");
    if (head.kind !== "refusal") return;
    expect(head.refusal.code, "and it is the registered code").toBe(MANIFEST_NOT_RENDERABLE);
    expect(head.refusal, "carried whole from the register — the screen renders no copy of its own (R-UI-020)").toEqual(entry);
    expect(head.facts, "with the ingest record's own facts, so a reader learns what the reading did recover").toEqual(record.facts);
  }, 180_000);
});
