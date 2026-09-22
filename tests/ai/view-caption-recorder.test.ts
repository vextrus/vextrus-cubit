// @vitest-environment node
/**
 * One spelling of "which captions the product asks a model about" (R-TO-030, L-AI-01, B-17).
 *
 * Session 7's map found the product's J-000 M3 run asking ten view-caption questions on F-RCC6-BNBC
 * and every one refusing FIXTURE_MISSING, while the corpus answered nine captions nobody asked any
 * more: the recorder and the partition's rebuild each chose their subjects by a filter of their own,
 * and the corpus was recorded when the two happened to agree. The choice now has one home —
 * `captionsAskedOf` (`src/modules/takeoff/partition/views/asked-captions.ts`) — and both callers
 * reach it. What is proved here, with no database and no extractor: the selection is the product's
 * law (the grammar first, a caption to ask about); the recorder composes exactly the requests the
 * product composes over it, once each; and neither caller spells a filter of its own beside it.
 *
 * That the recorder's hashes EQUAL the hashes the shipped rebuild asks over the real BNBC artifact —
 * and that the committed corpus answers every one — is `tests/takeoff/partition/view-caption-corpus.test.ts`,
 * in the database lane, because the rebuild is a job over a stored ingest.
 */
import { describe, expect, test } from "vitest";
import { JEV_MODEL, requestHash } from "@/core/model";
import { viewCaptionRequest } from "@/core/view-captions";
import { captionsAskedOf } from "@/modules/takeoff/partition/views/asked-captions";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import { codeOf } from "../../src/core/__tests__/support/read-source";
import { captionSubjectsOf } from "../../scripts/model-corpus/view-caption";

const REBUILD = "src/modules/takeoff/partition/rebuild.ts";
const RECORDER = "scripts/model-corpus/view-caption.ts";
const SELECTION = "src/modules/takeoff/partition/views/asked-captions.ts";

function view(type: PartitionedView["type"], caption: string, anchorKey: string | null): PartitionedView {
  return { viewKey: `${type}:${anchorKey ?? "none"}:${caption}`, type, reason: null, caption, anchorKey };
}

/** A partition as the grammar leaves one: classified views, silent ones, and the one no caption anchors. */
const VIEWS: readonly PartitionedView[] = [
  view(VIEW_TYPE.LAYOUT_PLAN, "COLUMN LAYOUT PLAN  SCALE 1:100", "DXF_HANDLE:20B6"),
  view(VIEW_TYPE.UNTYPED, "TYPICAL SLAB BAR CRANK  SCALE 1:20", "DXF_HANDLE:1FC3"),
  view(VIEW_TYPE.SCHEDULE, "PILE SCHEDULE  SCALE 1:50", "DXF_HANDLE:200A"),
  view(VIEW_TYPE.UNTYPED, "SEPTIC TANK  SCALE 1:50", "DXF_HANDLE:2266"),
  view(VIEW_TYPE.UNASSIGNED, "", null),
  view(VIEW_TYPE.UNTYPED, "", null),
];

describe("which captions a model is asked about has one home", () => {
  test("the grammar answers first: only a silent view with a caption anchor is asked about, in partition order", () => {
    expect(captionsAskedOf(VIEWS)).toEqual([
      { viewKey: VIEWS[1]?.viewKey, caption: "TYPICAL SLAB BAR CRANK  SCALE 1:20", anchorKey: "DXF_HANDLE:1FC3" },
      { viewKey: VIEWS[3]?.viewKey, caption: "SEPTIC TANK  SCALE 1:50", anchorKey: "DXF_HANDLE:2266" },
    ]);
  });

  test("the recorder asks exactly the requests the product composes over that selection, once each, pinned to Jev", () => {
    // A second view carrying the same caption on the same entity is the same request, and a request is recorded once.
    const twice = [...VIEWS, { ...view(VIEW_TYPE.UNTYPED, "SEPTIC TANK  SCALE 1:50", "DXF_HANDLE:2266"), viewKey: "UNTYPED:again" }];
    const asked = captionSubjectsOf(twice, "fixtures/rcc6-bnbc/rcc6-bnbc.dxf");
    const product = captionsAskedOf(twice).map((caption) => requestHash(viewCaptionRequest(caption.caption, caption.anchorKey)));
    expect(asked.map((one) => requestHash(one.request)), "the product's requests, hash for hash, with the repeat asked once").toEqual([...new Set(product)]);
    expect(asked.map((one) => one.subject)).toEqual(["rcc6-bnbc.dxf · DXF_HANDLE:1FC3 · TYPICAL SLAB BAR CRANK  SCALE 1:20", "rcc6-bnbc.dxf · DXF_HANDLE:2266 · SEPTIC TANK  SCALE 1:50"]);
    expect(new Set(asked.map((one) => one.request.modelId)), "every request is pinned to Jev's id (D-002)").toEqual(new Set([JEV_MODEL]));
  });

  test("neither the rebuild nor the recorder spells a filter of its own beside the one selection", () => {
    for (const caller of [REBUILD, RECORDER]) {
      const code = codeOf(caller, "a caller of the one caption selection");
      expect(code, `${caller} chooses its captions through captionsAskedOf`).toContain("captionsAskedOf(");
      // The two spellings this replaced: the rebuild's `asksAModel` and the recorder's own `view.type !== VIEW_TYPE.UNTYPED`.
      expect(code, `${caller} names no silent-view test of its own`).not.toMatch(/asksAModel|\.type(?:\s+as\s+ViewType\))?\s*[!=]==\s*VIEW_TYPE\.UNTYPED/u);
    }
    expect(codeOf(RECORDER, "the recorder"), "the recorder reads no view class at all — which captions is the product's").not.toContain("VIEW_TYPE");
    expect(codeOf(SELECTION, "the selection's home"), "and the home is the one place the silent class is read").toContain("VIEW_TYPE.UNTYPED");
  });
});
