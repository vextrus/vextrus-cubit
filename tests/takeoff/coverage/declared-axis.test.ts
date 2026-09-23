/**
 * COV-ALL over a real store (s-coverage I-479/b/c; L-QTY-05, L-QTY-07): the coverage axis is
 * built from what the pinned drawings DECLARE, read off the stored partition's own captions.
 *
 * A campaign is staged with a register that places columns only, and the manifest's stored partition
 * carries the views a real structural set carries beside its column plan: a slab reinforcement plan,
 * a water tank, a column schedule and a general-notes view. What is judged is the reading the screen
 * and the certificate are drawn from — `residueOf` and `coverageViewOf` — never a fixture of it:
 * - the slab the caption names has its column, every borne kind NOT_ESTABLISHED under the registered
 *   reason COVERAGE_CLASS_NOT_PLACED, the caption named beside it, and a level-less column that says
 *   it stands nowhere yet;
 * - the tank no class measures is named in the measurement statement's own enumeration;
 * - a note talks about a stair and declares nothing;
 * - no measurement row of the certificate stands without a registered reason beside its fall-through.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { lit } from "../../../db/__tests__/support/live-sql";
import { closeStage, productModule, sql, sqlValue, stageCampaign, type StagedCampaign } from "../gate/support/gate-stage";

type Cell = { kind: string; class: string | null; levelId: string | null; measurement: string; reason?: string | null; reasonViews?: readonly string[]; levelSlot?: string | null };
type Row = { kind: string; class: string | null; cause: string; reason?: string | null; views?: readonly string[] };
type Residue = { cells: Cell[]; input: { unclassed?: { word: string; caption: string }[]; sightings: { class: string; declared?: boolean; caption?: string }[] } };

const REASON_NOT_PLACED = "COVERAGE_CLASS_NOT_PLACED";

/** The views the stored partition carries for the manifest's first drawing: class, caption, anchor. */
const VIEWS: readonly (readonly [string, string])[] = [
  ["DETAIL", "TYPICAL SLAB REINFORCEMENT PLAN"],
  ["UNTYPED", "OVERHEAD WATER TANK  SCALE 1:50"],
  ["SCHEDULE", "COLUMN SCHEDULE"],
  ["LEGEND_NOTES", "GENERAL NOTES FOR STAIR AND SLAB"],
];

let staging: Promise<StagedCampaign> | undefined;
const staged = (): Promise<StagedCampaign> =>
  (staging ??= (async () => {
    const it = await stageCampaign("declared-axis", { objects: 1 });
    const drawingId = sqlValue(
      `select (manifest -> 0 ->> 'drawingId') from drawing_set_revisions where tenant_id = ${lit(it.tenantId)} and set_revision_id = ${lit(it.setRevisionId)};`,
    );
    expect(drawingId, "the pinned revision names a drawing its views can stand on").toMatch(/^[0-9a-f-]{36}$/u);
    const ingestId = randomUUID();
    for (const [at, [type, caption]] of VIEWS.entries()) {
      sql(
        `insert into partition_views (tenant_id, project_id, drawing_id, ingest_id, view_key, type, caption, anchor_key) values (${lit(it.tenantId)}, ${lit(it.projectId)}, ${lit(drawingId)}, ${lit(ingestId)}, ${lit(`${type}:DXF_HANDLE:${at}`)}, ${lit(type)}, ${lit(caption)}, ${lit(`DXF_HANDLE:${at}`)});`,
      );
    }
    return it;
  })());

afterAll(async () => {
  await closeStage();
});

async function residueOf(it: StagedCampaign): Promise<Residue> {
  const residue = await productModule<{ residueOf: (scope: { tenantId: string; projectId: string }) => Promise<Residue> }>("src/core/residue/index.ts");
  return residue.residueOf(it.scope);
}

describe("COV-ALL: the coverage axis is what the pinned drawings declare", () => {
  test("the slab a caption names has its cells, each NOT_ESTABLISHED under the registered reason, naming the caption", async () => {
    const it = await staged();
    const residue = await residueOf(it);
    const slab = residue.cells.filter((cell) => cell.class === "slab");
    expect(slab.length, "every kind a slab bears stands as a cell, though the partition placed no slab").toBeGreaterThan(0);
    for (const cell of slab) {
      expect({ kind: cell.kind, level: cell.levelId, measurement: cell.measurement, reason: cell.reason, views: cell.reasonViews, slot: cell.levelSlot }).toEqual({
        kind: cell.kind,
        level: null,
        measurement: "NOT_ESTABLISHED",
        reason: REASON_NOT_PLACED,
        views: ["TYPICAL SLAB REINFORCEMENT PLAN"],
        slot: "UNPLACED",
      });
    }
  });

  test("the declaration is a sighting on the caption, and a note that talks about a stair declares nothing", async () => {
    const it = await staged();
    const residue = await residueOf(it);
    const declared = residue.input.sightings.filter((seen) => seen.declared === true).map((seen) => `${seen.class}:${seen.caption ?? ""}`);
    expect(declared.sort()).toEqual(["column:COLUMN SCHEDULE", "slab:TYPICAL SLAB REINFORCEMENT PLAN"]);
    expect(residue.cells.some((cell) => cell.class === "stair"), "no stair column: the notes only talk about one").toBe(false);
  });

  test("the certificate names the tank no class measures, and every unmeasured row stands with a registered reason", async () => {
    const it = await staged();
    const coverage = await productModule<{
      coverageViewOf: (scope: { tenantId: string; projectId: string }) => Promise<{ measurement: Row[]; unclassed?: { word: string; caption: string; code: string }[] }>;
    }>("src/modules/takeoff/coverage/server.ts");
    const errors = await productModule<{ REFUSALS: Record<string, unknown> }>("src/core/errors.ts");
    const view = await coverage.coverageViewOf(it.scope);
    expect(view.unclassed, "the tank, by its word and its caption, under its registered reason").toEqual([
      { drawingId: expect.any(String), address: expect.any(String), caption: "OVERHEAD WATER TANK  SCALE 1:50", word: "tank", code: "COVERAGE_MEMBER_UNCLASSED" },
    ]);
    const slab = view.measurement.find((row) => row.class === "slab");
    expect({ cause: slab?.cause, reason: slab?.reason, views: slab?.views }).toEqual({ cause: "NOT_ESTABLISHED", reason: REASON_NOT_PLACED, views: ["TYPICAL SLAB REINFORCEMENT PLAN"] });
    for (const row of view.measurement.filter((candidate) => candidate.cause === "NOT_ESTABLISHED")) {
      expect(Object.hasOwn(errors.REFUSALS, row.reason ?? ""), `${row.kind} on ${row.class ?? ""} stands with a registered reason, never "nothing explains"`).toBe(true);
    }
  });
});
