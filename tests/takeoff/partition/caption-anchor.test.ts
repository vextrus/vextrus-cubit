/**
 * AC-5(b) — a caption stands where it is drawn, like everything else on the sheet.
 *
 * Every other entity is judged by its centroid, but a caption anchors its view at its FIRST point
 * (debt-src-modules-1iaso5g). A caption drawn as a multi-point text — two lines of title, a
 * justified string the extractor gives both ends of — then anchors its view metres from where the
 * words actually stand, and geometry nearer that caption than any other is handed to a neighbouring
 * view. One rule for where a thing stands, applied to captions too.
 *
 * A pure function over an artifact: no database, no model, no sheet.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "./support/partition-stage";

const ASSIGN_MODULE = "src/modules/takeoff/partition/views/assign.ts";

/** The two captions of the staged sheet, and the thing standing between them. */
const CAPTION_HEIGHT = 5;
const FIRST_CAPTION = "K1";
const SECOND_CAPTION = "K2";
const SUBJECT = "K3";

type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; points: number[][] };

type Partitioned = { views: readonly { viewKey: string; anchorKey: string | null }[]; assignments: ReadonlyMap<string, string> };

/** The door this criterion is about, or a loud absence naming what the product owes. */
async function partitionArtifact(): Promise<(graph: unknown) => Partitioned> {
  const absolute = join(REPO_ROOT, ASSIGN_MODULE);
  expect(existsSync(absolute), `${ASSIGN_MODULE} is missing from the checkout`).toBe(true);
  const module = (await import(absolute)) as Record<string, unknown>;
  expect(typeof module["partitionArtifact"], `${ASSIGN_MODULE} exports partitionArtifact`).toBe("function");
  return module["partitionArtifact"] as (graph: unknown) => Partitioned;
}

/**
 * A model space holding two captions and one line between them.
 *
 * The first caption is drawn from two points, so where it STANDS (the mean, x=10) and where it
 * STARTS (x=0) are different places; the second is drawn from one point at x=16, where the two
 * readings agree. The line stands at x=9 — nearer the first caption's centre than the second's, and
 * nearer the second than the first caption's opening point. Which view it lands in is therefore the
 * whole question the row asks.
 */
function sheet(): { graph: unknown } {
  const entities: Drawn[] = [
    { key: FIRST_CAPTION, type: "TEXT", space: "Model", layer: "CAPTIONS", text: "GROUND FLOOR PLAN", height: CAPTION_HEIGHT, points: [[0, 0], [20, 0]] },
    { key: SECOND_CAPTION, type: "TEXT", space: "Model", layer: "CAPTIONS", text: "SECTION A-A", height: CAPTION_HEIGHT, points: [[16, 0]] },
    { key: SUBJECT, type: "LINE", space: "Model", layer: "STRUCTURE", points: [[8, 0], [10, 0]] },
  ];
  return {
    graph: {
      entitygraph_version: 2,
      ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
      insunits: { code: 4, unit: "mm", unmapped: false },
      layouts: [{ name: "Model", kind: "model", bbox: { min: [-10, -10], max: [30, 10] }, strays_rejected: 0 }],
      dropped_layouts: [],
      entities: entities.map((record) => ({ ...record, colour: { rgb: [0, 0, 0], source: "bylayer" } })),
      derived: [],
      block_attributes: [],
      counters: [],
    },
  };
}

test("AC-5(b): a caption anchors its view where the caption stands, not where its first point is", async () => {
  const partition = await partitionArtifact();

  const partitioned = partition(sheet().graph);

  const first = partitioned.views.find((view) => view.anchorKey === FIRST_CAPTION);
  const second = partitioned.views.find((view) => view.anchorKey === SECOND_CAPTION);
  expect(first, "the two-point caption anchors a view of its own").toBeTruthy();
  expect(second, "the one-point caption anchors a view of its own").toBeTruthy();
  expect(
    partitioned.assignments.get(SUBJECT),
    "the line stands 1 unit from the first caption's centre and 7 from the second's, so it is in the first caption's view",
  ).toBe(first?.viewKey);
});

test("AC-5(b): the caption itself is judged by the same reading, so it stands in its own view", async () => {
  const partition = await partitionArtifact();

  const partitioned = partition(sheet().graph);

  const first = partitioned.views.find((view) => view.anchorKey === FIRST_CAPTION);
  expect(partitioned.assignments.get(FIRST_CAPTION), "one rule for where a thing stands — a caption is nearest to itself").toBe(first?.viewKey);
});
