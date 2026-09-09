/**
 * AC-5(e) — one label, one bubble.
 *
 * Draughtsmen ring a grid bubble twice: an inner circle and an outer one around the same letter. Each
 * ring encloses exactly that text, so each is read as a bubble of its own and one axis is stored
 * twice (debt-src-modules-ea2qrw) — a duplicate axis at the same position, and a backbone that says
 * the drawing has twice the grid lines it has. Among the rings enclosing one text, the smallest is
 * the bubble.
 *
 * The artifact is hand-drawn here and the profile comes from the product's own resolver, so what is
 * judged is the detection and nothing upstream of it.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "../support/partition-stage";

const ASSIGN_MODULE = "src/modules/takeoff/partition/views/assign.ts";
const CENSUS_MODULE = "src/modules/takeoff/partition/conventions/census.ts";
const RESOLVE_MODULE = "src/core/rulesets/methods/conventions/resolve.ts";
const DETECT_MODULE = "src/modules/takeoff/partition/grid/detect.ts";

const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_BUBBLES = "GRID-BUBBLES";
const LAYER_LABELS = "GRID-LABELS";
const LAYER_LINES = "GRID-LINES";
const CAPTION = "TYPICAL FLOOR PLAN";
const CAPTION_HEIGHT = 5;
const LABEL_HEIGHT = 1.5;

/** The two radii one bubble is ringed at, and how many vertices a circle crosses the seam as. */
const INNER = 3;
const OUTER = 6;
const VERTICES = 16;

type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; points: number[][]; closed?: boolean };
type AxisRow = { viewKey: string; family: string; label: string; axis: string; position: number; bubbleKey: string; labelKey: string; minSpacing: number };

async function moduleAt<T>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return (await import(absolute)) as T;
}

/** A closed ring of evenly spaced vertices about a centre — a circle, as the seam carries one. */
function ring(key: string, centre: readonly [number, number], radius: number): Drawn {
  return {
    key,
    type: "LWPOLYLINE",
    space: "Model",
    layer: LAYER_BUBBLES,
    closed: true,
    points: Array.from({ length: VERTICES }, (_unused, index) => {
      const angle = (2 * Math.PI * index) / VERTICES;
      return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
    }),
  };
}

function label(key: string, text: string, centre: readonly [number, number]): Drawn {
  return { key, type: "TEXT", space: "Model", layer: LAYER_LABELS, text, height: LABEL_HEIGHT, points: [[...centre]] };
}

function line(key: string, from: readonly [number, number], to: readonly [number, number]): Drawn {
  return { key, type: "LINE", space: "Model", layer: LAYER_LINES, points: [[...from], [...to]] };
}

/** A layout plan whose two bubbles are each ringed twice, about the same letter. */
function sheet(): { graph: unknown; inner: readonly string[] } {
  const entities: Drawn[] = [
    { key: "T1", type: "TEXT", space: "Model", layer: LAYER_CAPTIONS, text: CAPTION, height: CAPTION_HEIGHT, points: [[0, 0]] },
    ring("A-INNER", [0, -30], INNER),
    ring("A-OUTER", [0, -30], OUTER),
    label("A-LABEL", "A", [0, -30]),
    ring("B-INNER", [20, -30], INNER),
    ring("B-OUTER", [20, -30], OUTER),
    label("B-LABEL", "B", [20, -30]),
    line("L1", [-5, -30], [25, -30]),
    line("L2", [0, -35], [0, -5]),
    line("L3", [20, -35], [20, -5]),
  ];
  return {
    graph: {
      entitygraph_version: 2,
      ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
      insunits: { code: 4, unit: "mm", unmapped: false },
      layouts: [{ name: "Model", kind: "model", bbox: { min: [-40, -40], max: [40, 10] }, strays_rejected: 0 }],
      dropped_layouts: [],
      entities: entities.map((record) => ({ ...record, colour: { rgb: [0, 0, 0], source: "bylayer" } })),
      derived: [],
      block_attributes: [],
      counters: [],
    },
    inner: ["A-INNER", "B-INNER"],
  };
}

/** The evidence the detection is handed, assembled the way the rebuild assembles it. */
async function detect(graph: unknown): Promise<{ axes: readonly AxisRow[] }> {
  const assign = await moduleAt<{ partitionArtifact: (graph: unknown) => { views: readonly unknown[]; assignments: ReadonlyMap<string, string> } }>(ASSIGN_MODULE);
  const census = await moduleAt<{ censusOf: (graph: unknown, views: readonly unknown[]) => unknown }>(CENSUS_MODULE);
  const conventions = await moduleAt<{ resolve: (census: unknown) => unknown }>(RESOLVE_MODULE);
  const grid = await moduleAt<{ detectGrid: (evidence: unknown) => { axes: readonly AxisRow[] } }>(DETECT_MODULE);

  const partitioned = assign.partitionArtifact(graph);
  const profile = conventions.resolve(census.censusOf(graph, partitioned.views));
  return grid.detectGrid({ graph, views: partitioned.views, assignments: partitioned.assignments, profile });
}

test("AC-5(e): two rings about one letter are one bubble, not two", async () => {
  const staged = sheet();

  const detected = await detect(staged.graph);

  expect(detected.axes.length, "two labels on the plan, so two axes — a second ring about a letter is how a bubble is drawn, not a second axis").toBe(2);
  expect([...detected.axes].map((row) => row.label).sort(), "the axes are the letters the drawing bubbles").toEqual(["A", "B"]);
});

test("AC-5(e): the bubble cited is the smallest ring enclosing the label", async () => {
  const staged = sheet();

  const detected = await detect(staged.graph);

  expect(
    [...detected.axes].map((row) => row.bubbleKey).sort(),
    "the inner ring is the bubble: it is the one the smallest reading of 'inside this circle' names",
  ).toEqual([...staged.inner].sort());
});
