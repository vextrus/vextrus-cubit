// @vitest-environment node
/**
 * R-TO-004's title-block grammar on both fixtures, read by the SHIPPED `cad/` CLI (L-CAD-01), and on
 * built blocks that isolate each rule (I-364, I-365). The unit lane: no database, no store — the
 * grammar is pure over an artifact, so the artifact is all it is graded on.
 *
 * What the drawings state, and what is graded here:
 *   · F-RCC6-BNBC's title block writes each sheet as ONE line, `S-01  GENERAL NOTES (1 OF 2)` (layer
 *     Sheet, 3.2), under a stock `DO NOT SCALE` (5), the project's name (6) and view captions (4) —
 *     every one of them taller. The manifest's roster (`fixtures/rcc6-bnbc/manifest.json`, the
 *     generator's own) states each sheet's number and title, and the grammar proposes exactly those.
 *   · F-RCC6 (byte-frozen at v1.1) writes no numbered line: its title is the tallest text, its number
 *     `SHEET n OF m`, and the project's name stands on every sheet below the title. Nothing of its
 *     proposals moves — title, number, discipline, basis, and the whole cited block.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph/schema";
import { readTitleBlock } from "@/core/sheets";
import { ingestDrawing } from "@/modules/takeoff/ingest/cli";

/** The two fixtures, never a replacement (AM-01). */
const BNBC_DXF = "fixtures/rcc6-bnbc/rcc6-bnbc.dxf";
const BNBC_MANIFEST = "fixtures/rcc6-bnbc/manifest.json";
const RCC6_DXF = "fixtures/rcc6/rcc6.dxf";
const RCC6_MANIFEST = "fixtures/rcc6/manifest.json";

/** How long a drawing's reading may take: a cold `uv run` and the mirror's validation. */
const BUDGET_MS = 240_000;

/** One drawing, read by the shipped CLI once per file. */
const read = new Map<string, Promise<EntityGraph>>();
function graphOf(relative: string): Promise<EntityGraph> {
  let held = read.get(relative);
  if (held === undefined) {
    held = (async () => {
      const outcome = await ingestDrawing(new Uint8Array(readFileSync(join(process.cwd(), relative))), "dxf", { tempDir: mkdtempSync(join(tmpdir(), "cubit-titles-")) });
      if (!outcome.ok) throw new Error(`the shipped cad CLI refused ${relative}: ${outcome.refusal} — ${outcome.detail}`);
      return outcome.graph;
    })();
    read.set(relative, held);
  }
  return held;
}

/** A fixture's manifest, parsed. */
function manifestOf<T>(relative: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), relative), "utf8")) as T;
}

/** Every text key the artifact puts on one layout, in artifact order — the block a proposal cites. */
function textKeysOn(graph: EntityGraph, layoutName: string): string[] {
  return graph.entities
    .filter((entity) => (entity.type === "TEXT" || entity.type === "MTEXT") && entity.space === layoutName && (entity.text ?? "").replace(/%%\w?/g, "").trim() !== "")
    .map((entity) => entity.key);
}

/** The texts EVERY paper layout of the artifact carries, word for word. */
function onEverySheet(graph: EntityGraph): Set<string> {
  const sheets = graph.layouts.filter((layout) => layout.kind === "paper").map((layout) => layout.name);
  const own = sheets.map((name) => new Set(graph.entities.filter((entity) => entity.space === name && entity.text !== undefined).map((entity) => (entity.text ?? "").trim())));
  const [first, ...rest] = own;
  return new Set([...(first ?? [])].filter((text) => rest.every((set) => set.has(text))));
}

describe("F-RCC6-BNBC: the title block's numbered line names each sheet (I-364)", () => {
  test(
    "every manifest sheet is proposed with the number and title its block states, STRUCTURAL by its S- number (I-365)",
    async () => {
      const graph = await graphOf(BNBC_DXF);
      const { sheets } = manifestOf<{ sheets: { number: string; title: string; layout_name: string }[] }>(BNBC_MANIFEST);
      expect(sheets.length, `${BNBC_MANIFEST} declares the sheets F-RCC6-BNBC carries`).toBeGreaterThan(0);

      for (const sheet of sheets) {
        expect(
          graph.layouts.some((layout) => layout.name === sheet.layout_name),
          `the manifest's ${sheet.number} stands on a layout named "${sheet.layout_name}"`,
        ).toBe(true);
        const proposal = readTitleBlock(graph, sheet.layout_name);
        expect(proposal.number, `${sheet.layout_name}: the number is the block's own, not "No sheet number"`).toBe(sheet.number);
        expect(proposal.title, `${sheet.layout_name}: the title is the block's line — never the stamp, the project's name or a view caption`).toBe(sheet.title);
        expect(proposal.discipline, `${sheet.layout_name}: an S- sheet of a structural set is STRUCTURAL`).toBe("STRUCTURAL");
        expect(proposal.basis).toBe("GRAMMAR");
        expect(proposal.cited, `${sheet.layout_name}: the proposal cites the whole block it was read out of`).toEqual(textKeysOn(graph, sheet.layout_name));
      }
    },
    BUDGET_MS,
  );

  test(
    "a QS can tell one sheet from another: no two paper sheets share a title or a number",
    async () => {
      const graph = await graphOf(BNBC_DXF);
      const proposals = graph.layouts.filter((layout) => layout.kind === "paper").map((layout) => readTitleBlock(graph, layout.name));
      expect(new Set(proposals.map((proposal) => proposal.title)).size, "one title per paper sheet").toBe(proposals.length);
      expect(new Set(proposals.map((proposal) => proposal.number)).size, "one number per paper sheet").toBe(proposals.length);
      for (const stamp of ["DO NOT SCALE", "PROPOSED G+6 STORIED RESIDENTIAL BUILDING"]) {
        expect(
          proposals.map((proposal) => proposal.title),
          `"${stamp}" is a stamp or the project's name, never a sheet's title`,
        ).not.toContain(stamp);
      }
    },
    BUDGET_MS,
  );
});

describe("F-RCC6 (byte-frozen): nothing of its proposals moves", () => {
  test(
    "every manifest sheet keeps its title, its SHEET n OF m number, STRUCTURAL off its S- layer, and its whole cited block",
    async () => {
      const graph = await graphOf(RCC6_DXF);
      const { sheets } = manifestOf<{ sheets: { name: string }[] }>(RCC6_MANIFEST);
      expect(sheets.length, `${RCC6_MANIFEST} declares the sheets F-RCC6 carries`).toBeGreaterThan(0);
      const standing = onEverySheet(graph);
      expect(standing.size, "F-RCC6's project name stands on every sheet — the rule that skips it is armed here").toBeGreaterThan(0);

      for (const [index, sheet] of sheets.entries()) {
        const proposal = readTitleBlock(graph, sheet.name);
        expect(proposal.title, `${sheet.name} is titled by its own block`).toBe(sheet.name);
        expect(proposal.number, `${sheet.name} is numbered by its SHEET n OF m line`).toBe(String(index + 1));
        expect(proposal.discipline, `${sheet.name}'s title stands on S-TEXT`).toBe("STRUCTURAL");
        expect(proposal.basis).toBe("GRAMMAR");
        expect(proposal.cited, `${sheet.name} cites every text of its block, the project's name included`).toEqual(textKeysOn(graph, sheet.name));
        expect(standing.has(proposal.title), `${sheet.name} is not titled by a text every sheet carries`).toBe(false);
      }
    },
    BUDGET_MS,
  );

  test(
    "model space is proposed as before: its tallest text, no number",
    async () => {
      const graph = await graphOf(RCC6_DXF);
      const model = graph.layouts.find((layout) => layout.kind === "model");
      expect(model, "F-RCC6 carries model space").toBeDefined();
      const proposal = readTitleBlock(graph, (model as { name: string }).name);
      expect(proposal).toMatchObject({ number: null, title: "FOUNDATION PLAN", discipline: "STRUCTURAL", basis: "GRAMMAR" });
    },
    BUDGET_MS,
  );
});

/* ------------------------------------------------------------------ built blocks, one rule each */

/** One text a built artifact carries. */
type Spec = { layout: string; text: string; height: number; layer?: string };

/** An artifact holding these paper layouts and texts, validated against the one mirror. */
function built(layouts: readonly string[], texts: readonly Spec[]): EntityGraph {
  return entityGraphSchema.parse({
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-grammar", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: "Model", kind: "model", bbox: { min: [0, 0], max: [1, 1] }, strays_rejected: 0 },
      ...layouts.map((name) => ({ name, kind: "paper", bbox: { min: [0, 0], max: [1, 1] }, strays_rejected: 0 })),
    ],
    dropped_layouts: [],
    entities: texts.map((spec, index) => ({
      key: `DXF_HANDLE:${(0x100 + index).toString(16).toUpperCase()}`,
      type: "TEXT",
      space: spec.layout,
      layer: spec.layer ?? "0",
      colour: { rgb: [0, 0, 0], source: "bylayer" },
      text: spec.text,
      height: spec.height,
    })),
    derived: [],
    block_attributes: [],
    counters: [],
  });
}

describe("the grammar's order, one rule at a time (I-364, I-365)", () => {
  test("a numbered line is the answer, whatever is set taller", () => {
    const graph = built(["Layout1"], [
      { layout: "Layout1", text: "DO NOT SCALE", height: 5 },
      { layout: "Layout1", text: "S-01  GENERAL NOTES (1 OF 2)", height: 3.2, layer: "TITLE" },
    ]);
    expect(readTitleBlock(graph, "Layout1")).toMatchObject({ number: "S-01", title: "GENERAL NOTES (1 OF 2)", discipline: "STRUCTURAL", basis: "GRAMMAR" });
  });

  test("the number's designator names the discipline before the layer does", () => {
    const graph = built(["Layout1"], [{ layout: "Layout1", text: "A-101 GROUND FLOOR PLAN", height: 3, layer: "S-TEXT" }]);
    expect(readTitleBlock(graph, "Layout1")).toMatchObject({ number: "A-101", title: "GROUND FLOOR PLAN", discipline: "ARCHITECTURAL" });
  });

  test("a designator the convention does not map leaves the discipline to the layer and the words", () => {
    const graph = built(["Layout1"], [{ layout: "Layout1", text: "GA-01 GENERAL ARRANGEMENT", height: 3, layer: "TITLE" }]);
    expect(readTitleBlock(graph, "Layout1")).toMatchObject({ number: "GA-01", title: "GENERAL ARRANGEMENT", discipline: "OTHER" });
  });

  test("the layout's own number picks this sheet's line out of a drawing index", () => {
    const graph = built(["S-00 COVER"], [
      { layout: "S-00 COVER", text: "S-01  GENERAL NOTES", height: 4 },
      { layout: "S-00 COVER", text: "S-00  COVER", height: 3.2 },
      { layout: "S-00 COVER", text: "S-02  PILE LAYOUT PLAN", height: 4 },
    ]);
    expect(readTitleBlock(graph, "S-00 COVER")).toMatchObject({ number: "S-00", title: "COVER" });
  });

  test("where no line states the layout's own number, a line naming another sheet is not taken", () => {
    const graph = built(["S-10 COLUMN LAYOUT PLAN"], [
      { layout: "S-10 COLUMN LAYOUT PLAN", text: "COLUMN LAYOUT PLAN", height: 5, layer: "S-TEXT" },
      { layout: "S-10 COLUMN LAYOUT PLAN", text: "GB-12 LONG SECTION", height: 4 },
    ]);
    expect(readTitleBlock(graph, "S-10 COLUMN LAYOUT PLAN")).toMatchObject({ number: "S-10", title: "COLUMN LAYOUT PLAN", discipline: "STRUCTURAL" });
  });

  test("a text every sheet carries names no sheet; the next tallest does", () => {
    const graph = built(["ONE", "TWO"], [
      { layout: "ONE", text: "RIVERSIDE TOWER", height: 8 },
      { layout: "ONE", text: "FOUNDATION PLAN", height: 5, layer: "S-TEXT" },
      { layout: "ONE", text: "SHEET 1 OF 2", height: 2 },
      { layout: "TWO", text: "RIVERSIDE TOWER", height: 8 },
      { layout: "TWO", text: "ROOF PLAN", height: 5, layer: "S-TEXT" },
      { layout: "TWO", text: "SHEET 2 OF 2", height: 2 },
    ]);
    expect(readTitleBlock(graph, "ONE")).toMatchObject({ number: "1", title: "FOUNDATION PLAN", discipline: "STRUCTURAL" });
    expect(readTitleBlock(graph, "TWO").cited, "the block is cited whole, the set's words included").toHaveLength(3);
  });

  test("a lone sheet keeps every word it carries", () => {
    const graph = built(["ONE"], [
      { layout: "ONE", text: "RIVERSIDE TOWER", height: 8 },
      { layout: "ONE", text: "FOUNDATION PLAN", height: 5 },
    ]);
    expect(readTitleBlock(graph, "ONE").title).toBe("RIVERSIDE TOWER");
  });

  test("a sheet carrying nothing but the set's words is named by what it carries, not by nothing", () => {
    const graph = built(["ONE", "TWO"], [
      { layout: "ONE", text: "RIVERSIDE TOWER", height: 8 },
      { layout: "TWO", text: "RIVERSIDE TOWER", height: 8 },
      { layout: "TWO", text: "ROOF PLAN", height: 5 },
    ]);
    expect(readTitleBlock(graph, "ONE")).toMatchObject({ title: "RIVERSIDE TOWER", basis: "GRAMMAR" });
    expect(readTitleBlock(graph, "TWO").title).toBe("ROOF PLAN");
  });

  test("a layout with no text is still named by itself at no basis", () => {
    const graph = built(["EMPTY", "ONE"], [{ layout: "ONE", text: "ROOF PLAN", height: 5 }]);
    expect(readTitleBlock(graph, "EMPTY")).toEqual({ number: null, title: "EMPTY", discipline: "OTHER", basis: "NONE", cited: [] });
  });
});
