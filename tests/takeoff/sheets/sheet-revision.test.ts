// @vitest-environment node
/**
 * The revision a sheet's title block marks, read for the draft BOQ's drawing register (s-boq
 * I-689). F-RCC6-BNBC's `TITLE_BLOCK` carries a `REV` attribute on every sheet, and the
 * generator's manifest states the revision each sheet was issued at; the reader answers exactly that,
 * off the shipped `cad/` CLI's artifact (L-CAD-01). Then the rules one at a time, on the same artifact
 * changed where the rule bites: an empty box marks nothing, and a box on another sheet is not this
 * sheet's.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { readSheetRevision } from "@/core/sheets";
import { ingestDrawing } from "@/modules/takeoff/ingest/cli";

const BNBC_DXF = "fixtures/rcc6-bnbc/rcc6-bnbc.dxf";
const BNBC_MANIFEST = "fixtures/rcc6-bnbc/manifest.json";

/** A cold `uv run` and the mirror's validation. */
const BUDGET_MS = 240_000;

let reading: Promise<EntityGraph> | undefined;
function bnbc(): Promise<EntityGraph> {
  reading ??= (async () => {
    const outcome = await ingestDrawing(new Uint8Array(readFileSync(join(process.cwd(), BNBC_DXF))), "dxf", { tempDir: mkdtempSync(join(tmpdir(), "cubit-revision-")) });
    if (!outcome.ok) throw new Error(`the shipped cad CLI refused ${BNBC_DXF}: ${outcome.refusal} — ${outcome.detail}`);
    return outcome.graph;
  })();
  return reading;
}

/** The manifest's sheets, as the generator states them. */
function manifestSheets(): { number: string; layout_name: string; revision: string }[] {
  return (JSON.parse(readFileSync(join(process.cwd(), BNBC_MANIFEST), "utf8")) as { sheets: { number: string; layout_name: string; revision: string }[] }).sheets;
}

/** The layout a sheet number stands on in the artifact. */
function layoutOf(number: string): string {
  const sheet = manifestSheets().find((one) => one.number === number);
  if (sheet === undefined) throw new Error(`${BNBC_MANIFEST} states no sheet ${number}`);
  return sheet.layout_name;
}

describe("F-RCC6-BNBC: each sheet's revision is the one its title block marks", () => {
  test(
    "every manifest sheet reads the revision the manifest states",
    async () => {
      const graph = await bnbc();
      const sheets = manifestSheets();
      expect(sheets.length).toBeGreaterThan(0);
      for (const sheet of sheets) expect(readSheetRevision(graph, sheet.layout_name), `${sheet.number}'s REV box`).toBe(sheet.revision);
    },
    BUDGET_MS,
  );

  test(
    "model space carries no title block, and marks no revision",
    async () => {
      const graph = await bnbc();
      const model = graph.layouts.find((layout) => layout.kind === "model");
      expect(readSheetRevision(graph, (model as { name: string }).name)).toBeNull();
    },
    BUDGET_MS,
  );

  test(
    "an empty REV box marks nothing, rather than a revision guessed from elsewhere",
    async () => {
      const graph = await bnbc();
      const layout = layoutOf("S-10");
      const inserts = new Set(graph.entities.filter((entity) => entity.type === "INSERT" && entity.space === layout).map((entity) => entity.key));
      const emptied: EntityGraph = {
        ...graph,
        block_attributes: graph.block_attributes.map((attribute) => (inserts.has(attribute.src) && attribute.tag === "REV" ? { ...attribute, text: " " } : attribute)),
      };
      expect(readSheetRevision(emptied, layout)).toBeNull();
      expect(readSheetRevision(emptied, layoutOf("S-11")), "and another sheet's box still reads").toBe("B");
    },
    BUDGET_MS,
  );

  test(
    "the box is read only off an insert standing on the sheet asked about",
    async () => {
      const graph = await bnbc();
      const layout = layoutOf("S-10");
      const moved: EntityGraph = { ...graph, entities: graph.entities.map((entity) => (entity.type === "INSERT" && entity.space === layout ? { ...entity, space: "elsewhere" } : entity)) };
      expect(readSheetRevision(moved, layout)).toBeNull();
    },
    BUDGET_MS,
  );
});
