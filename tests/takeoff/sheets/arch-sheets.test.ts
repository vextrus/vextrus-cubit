// @vitest-environment node
/**
 * F-ARCH (session 8) as a QS meets it: the architect's set of the Bashundhara G+6 read by the
 * SHIPPED `cad/` CLI (L-CAD-01), its sheets proposed by R-TO-004's title-block grammar and its views
 * by L-CAD-06's framed regions — the same pure stages the product runs on upload, no database.
 *
 * What is graded, against the generator's own manifest (fixtures/arch/manifest.json):
 *   · every sheet is proposed ARCHITECTURAL with the number and title its block states (A-01 … A-04);
 *   · the typical floor plan's sheet opens with a LAYOUT_PLAN view "TYPICAL FLOOR PLAN (1ST TO 6TH)"
 *     and a SCHEDULE view "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)";
 *   · every view the manifest lists is typed as the manifest expects — WALL TYPES included, a key of
 *     types the caption grammar reads as a SCHEDULE (T-WALL-TYPES-CAPTION; s-schedules I-502).
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { readTitleBlock } from "@/core/sheets";
import { ingestDrawing } from "@/modules/takeoff/ingest/cli";
import { partitionArtifact } from "@/modules/takeoff/partition/views/assign";

const ARCH_DXF = "fixtures/arch/arch.dxf";
const ARCH_MANIFEST = "fixtures/arch/manifest.json";
const BUDGET_MS = 240_000;

type ManifestSheet = { number: string; title: string; layout_name: string; views: { caption: string; expect: string }[] };

let held: Promise<EntityGraph> | null = null;
function graph(): Promise<EntityGraph> {
  held ??= (async () => {
    const outcome = await ingestDrawing(new Uint8Array(readFileSync(join(process.cwd(), ARCH_DXF))), "dxf", { tempDir: mkdtempSync(join(tmpdir(), "cubit-arch-")) });
    if (!outcome.ok) throw new Error(`the shipped cad CLI refused ${ARCH_DXF}: ${outcome.refusal} — ${outcome.detail}`);
    return outcome.graph;
  })();
  return held;
}

function sheets(): ManifestSheet[] {
  return (JSON.parse(readFileSync(join(process.cwd(), ARCH_MANIFEST), "utf8")) as { sheets: ManifestSheet[] }).sheets;
}

describe("F-ARCH: the sheets a QS uploads offer ARCHITECTURAL", () => {
  test(
    "every manifest sheet is proposed ARCHITECTURAL by its A- number, with the number and title its block states",
    async () => {
      const g = await graph();
      const roster = sheets();
      expect(roster.map((sheet) => sheet.number)).toEqual(["A-01", "A-02", "A-03", "A-04"]);
      for (const sheet of roster) {
        const proposal = readTitleBlock(g, sheet.layout_name);
        expect(proposal.discipline, sheet.number).toBe("ARCHITECTURAL");
        expect(proposal.number).toBe(sheet.number);
        expect(proposal.title).toBe(sheet.title);
        expect(proposal.basis).toBe("GRAMMAR");
      }
    },
    BUDGET_MS,
  );
});

describe("F-ARCH: the typical floor plan opens with its plan and schedule views", () => {
  test(
    "each window the manifest lists is a view of the type it expects, captioned as the paper titles it",
    async () => {
      const g = await graph();
      const views = [...partitionArtifact(g).views.values()];
      for (const sheet of sheets()) {
        for (const expected of sheet.views) {
          const found = views.filter((view) => view.caption.startsWith(expected.caption));
          expect(found.length, `${sheet.number}: no view is captioned ${expected.caption}`).toBeGreaterThan(0);
          expect(
            found.map((view) => view.type),
            `${sheet.number}: ${expected.caption}`,
          ).toContain(expected.expect);
        }
      }
      const typical = views.filter((view) => view.caption.startsWith("TYPICAL FLOOR PLAN (1ST TO 6TH)"));
      expect(typical.map((view) => view.type)).toContain("LAYOUT_PLAN");
      const schedule = views.filter((view) => view.caption.startsWith("DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)"));
      expect(schedule.map((view) => view.type)).toContain("SCHEDULE");
    },
    BUDGET_MS,
  );
});
