/**
 * AC-4's inspector half — the selection tab's Trace block (R-UI-022, R-TO-011, X-2).
 *
 * The panel is mounted bare, as inc-111's own suite mounts it, and handed the block the screen's
 * read of `takeoff.lineEvidence` leaves. What is judged is what a reader meets: the ids the test
 * contract closes, the `data-` hooks AC-4 names, the formula verbatim, one row per binding in
 * binding order, and the copy read from the product's own registry by key — never a sentence typed
 * here (R-SPINE-060, B-19).
 *
 * @vitest-environment jsdom
 */
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { fillSlots, productModule, registered, stringTable, type IndexBox } from "./support/inspector-support";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import {
  aCited,
  aCitedLine,
  aTrace,
  all,
  anEvidence,
  keyOf,
  mountInspector,
  one,
  text,
  type TraceEvidence,
} from "./support/trace-support";

afterEach(() => cleanup());

/** Two selected entities, so the Trace block is judged beside a selection and never instead of one. */
const SELECTION: { key: string; type: string; layer: string; box: IndexBox }[] = [
  { key: keyOf(0x1a4), type: "LINE", layer: "S-COL", box: { min: [10, 20], max: [30, 25] } },
  { key: keyOf(0x2b7), type: "LWPOLYLINE", layer: "S-COL", box: { min: [-5, 0], max: [4, 8] } },
];

/** R-UI-002's glyph table, read from its single home (B-19: the pair is never transcribed). */
async function glyphs(): Promise<Record<string, string>> {
  const module = await productModule<{ BASIS_GLYPHS: Record<string, string> }>("src/ui/primitives/core/basis.ts");
  return module.BASIS_GLYPHS;
}

describe("AC-4: the Trace block, ready", () => {
  test("AC-4: the block names its line and its basis, and states the formula verbatim", async () => {
    const evidence = anEvidence();
    const trace = aTrace({ evidence });
    const root = await mountInspector({ selection: SELECTION, trace });
    const block = one(root, "viewer-inspector-trace");

    expect(block.getAttribute("data-line"), "the block names the line the address named").toBe(evidence.lineId);
    expect(block.getAttribute("data-basis"), "and the basis the number was measured on").toBe(evidence.quantityBasis);
    expect(block.getAttribute("data-state"), "the reading stands").toBe("ready");

    const formula = one(root, "viewer-inspector-trace-formula");
    expect(block.contains(formula), "the formula stands inside the Trace block").toBe(true);
    expect(text(formula), "the formula is the line's own, verbatim (I-25)").toBe(evidence.formula);
  });

  test("AC-4: one variable row per binding, in binding order, each stating what it was read as and where", async () => {
    const evidence = anEvidence();
    const root = await mountInspector({ selection: SELECTION, trace: aTrace({ evidence }) });

    const rows = all(root, "viewer-inspector-trace-variable");
    const names = Object.keys(evidence.variables);
    expect(rows.map((row) => row.getAttribute("data-name")), "one row per binding, in binding order").toEqual(names);

    for (const row of rows) {
      const name = row.getAttribute("data-name") as string;
      const binding = evidence.variables[name] as TraceEvidence["variables"][string];
      expect(row.getAttribute("data-value"), `${name}: the value it was read as`).toBe(binding.value);
      expect(row.getAttribute("data-unit"), `${name}: in the unit it was written in`).toBe(binding.unit);
      expect(row.getAttribute("data-basis"), `${name}: on the basis it was read on`).toBe(binding.basis);
      expect(row.getAttribute("data-source"), `${name}: at the key it was read at`).toBe(binding.source);
      expect(text(row), `${name}: and the reader sees the value and its unit, not only the machine`).toContain(binding.value);
    }
  });

  test("AC-4: the injected BasisChip states the line's basis as glyph and word", async () => {
    const table = await glyphs();
    const evidence = anEvidence({ quantityBasis: "TRANSCRIBED" });
    const root = await mountInspector({ selection: SELECTION, trace: aTrace({ evidence }) });
    const block = one(root, "viewer-inspector-trace");

    const chips = [...block.querySelectorAll(testIdSelector(TESTIDS.basis.chip))] as HTMLElement[];
    expect(chips.length, "the block shows the line's basis through the shipped BasisChip, injected (I-170, B-17)").toBe(1);
    expect(text(chips[0] as HTMLElement), "the chip carries the glyph, so the basis survives greyscale (R-UI-002)").toContain(table[evidence.quantityBasis]);
    expect(text(chips[0] as HTMLElement), "and the word beside it").toContain(evidence.quantityBasis);
  });

  test("AC-4: a link back to the origin row, at `originAddress` for that line", async () => {
    const trace = aTrace();
    const root = await mountInspector({ selection: SELECTION, trace });
    const origin = one(root, "viewer-inspector-trace-origin");

    expect(origin.getAttribute("href"), "the way back is the register's own address, plus the line it was traced from").toBe(trace.originHref);
    expect(one(root, "viewer-inspector-trace").contains(origin), "and it stands inside the block it belongs to").toBe(true);
  });

  test("AC-4: the block says its headings from the one string registry", async () => {
    const strings = await stringTable();
    const root = await mountInspector({ selection: SELECTION, trace: aTrace() });
    const said = text(one(root, "viewer-inspector-trace"));

    for (const key of ["trace_heading", "trace_formula_label", "trace_variables_label", "trace_origin"]) {
      expect(said, `the block states \`${key}\` from the registry, never a sentence of its own (R-SPINE-060)`).toContain(registered(strings, key));
    }
  });

  test("AC-4: the selection the address applied is still held and still listed", async () => {
    const root = await mountInspector({ selection: SELECTION, trace: aTrace() });

    expect(all(one(root, "viewer-inspector-selection"), "viewer-inspector-entity").map((row) => row.getAttribute("data-key")), "the Trace stands beside the selection, never instead of it").toEqual(SELECTION.map((entity) => entity.key));
    expect(root.getAttribute("data-count"), "and the panel still counts what is held").toBe(String(SELECTION.length));
  });
});

describe("AC-4: the Trace block's other two cells", () => {
  test("AC-4: a line this project does not hold is `missing`, and the selection stays applied", async () => {
    const strings = await stringTable();
    const trace = aTrace({ state: "missing", evidence: null, lineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    const root = await mountInspector({ selection: SELECTION, trace });
    const block = one(root, "viewer-inspector-trace");

    expect(block.getAttribute("data-state"), "a line nobody published is a fact, not a refusal (I-88's idiom)").toBe("missing");
    expect(block.getAttribute("data-line"), "and the block still names the line the address asked for").toBe(trace.lineId);
    expect(text(block), "the reader is told what is so").toContain(registered(strings, "trace_missing"));
    expect(all(root, "viewer-inspector-trace-formula").length, "there is no formula to state").toBe(0);
    expect(all(one(root, "viewer-inspector-selection"), "viewer-inspector-entity").length, "and the keys that were found stay selected (I-88, shown not hidden)").toBe(SELECTION.length);
  });

  test("AC-4: a door that faulted is `failed`, and offers to read again", async () => {
    const strings = await stringTable();
    let read = 0;
    const trace = aTrace({ state: "failed", evidence: null, onRetry: () => void (read += 1) });
    const root = await mountInspector({ selection: SELECTION, trace });
    const block = one(root, "viewer-inspector-trace");

    expect(block.getAttribute("data-state"), "a read that faulted says so").toBe("failed");
    expect(text(block), "in the registry's own words").toContain(registered(strings, "trace_failed"));

    const retry = one(root, "viewer-inspector-trace-retry");
    expect(text(retry), "the retry says what pressing it does").toBe(registered(strings, "trace_retry"));
    await userEvent.setup().click(retry);
    expect(read, "and pressing it reads the line again").toBe(1);
  });

  test("AC-4: no Trace block stands where the address named no line", async () => {
    const root = await mountInspector({ selection: SELECTION, trace: null });
    expect(all(root, "viewer-inspector-trace").length, "a selection that came from no line has no Trace to show").toBe(0);
  });
});

/* ------------------------------------------------ VD-2: the Trace reads as a quantity surveyor's check */

/** The line as the block names it — the member, its storey and what was measured (I-552). */
function wordsOf(strings: Record<string, string>, mark: string | null, level: string | null, klass: string, kind: string): string {
  const description = fillSlots(registered(strings, "trace_line_description"), { class: klass, kind });
  return [mark ?? "", level ?? "", description].filter((part) => part !== "").join(" · ");
}

/** The identifier chips inside a node, by the whole value each carries (R-UI-082). */
function chipValues(node: HTMLElement): string[] {
  return [...node.querySelectorAll(testIdSelector(TESTIDS.idChip.root))].map((chip) => chip.getAttribute("data-value") ?? "");
}

describe("VD-2: the Trace block reads as a QS check (walk-1 B01)", () => {
  test("VD-2: the traced line is named by member, level and kind in words, with its figure and unit", async () => {
    const strings = await stringTable();
    const evidence = anEvidence();
    const root = await mountInspector({ selection: SELECTION, trace: aTrace({ evidence }) });
    const line = one(root, "viewer-inspector-trace-line");

    expect(text(line), "C4 · GF · Column concrete — the member, its storey and what was measured").toContain(wordsOf(strings, "C4", "GF", "Column", "concrete"));
    const figure = one(root, "viewer-inspector-trace-figure");
    expect(figure.querySelector("[data-value]")?.getAttribute("data-value"), "the figure keeps the exact stored value").toBe(evidence.value);
    expect(text(figure.querySelector(".cx-quantity-figure")), "and states it through the format seam").toBe(evidence.value);
    expect(text(figure.querySelector(testIdSelector(TESTIDS.unit.badge))), "with its unit beside it").toBe(evidence.unit);
  });

  test("VD-2: a line the register holds no member for is named by its class and kind alone, never a guessed mark", async () => {
    const strings = await stringTable();
    const root = await mountInspector({ selection: SELECTION, trace: aTrace({ evidence: anEvidence({ member: null, elementClass: "pile_cap", kind: "rcc.formwork" }) }) });
    const said = text(one(root, "viewer-inspector-trace-line"));
    expect(said, "the class and the trade in words").toContain(wordsOf(strings, null, null, "Pile cap", "formwork"));
    expect(said.startsWith(wordsOf(strings, null, null, "Pile cap", "formwork")), "with no empty member standing before them").toBe(true);
  });

  test("VD-2: keys show only as identifier chips — the object key and every variable's source (R-UI-082)", async () => {
    const evidence = anEvidence();
    const root = await mountInspector({ selection: SELECTION, trace: aTrace({ evidence }) });
    const block = one(root, "viewer-inspector-trace");

    expect(chipValues(block), "the object key rides an IdChip, whole in its data").toContain(evidence.objectKey);
    for (const row of all(block, "viewer-inspector-trace-variable")) {
      const source = row.getAttribute("data-source") as string;
      expect(chipValues(row), `${row.getAttribute("data-name")}: its source key is an IdChip`).toEqual([source]);
      expect(text(row), `${row.getAttribute("data-name")}: and the whole key is never body text`).not.toContain(source);
    }
    expect(text(block), "nor is the object key").not.toContain(evidence.objectKey);
  });

  test("VD-2: each variable's basis is said in words through EnumLabel", async () => {
    const root = await mountInspector({ selection: SELECTION, trace: aTrace({ evidence: anEvidence() }) });
    for (const row of all(one(root, "viewer-inspector-trace"), "viewer-inspector-trace-variable")) {
      const basis = row.getAttribute("data-basis") as string;
      const label = row.querySelector(".cx-enum-label");
      expect(label?.getAttribute("data-value"), `${row.getAttribute("data-name")}: the basis goes through EnumLabel`).toBe(basis);
      expect(text(label), "and reads as a word").toContain(`${basis.charAt(0)}${basis.slice(1).toLowerCase()}`);
    }
  });

  test("VD-2: each variable read on a sheet links to that sheet by its number; one read on none offers no link", async () => {
    const trace = aTrace({ evidence: anEvidence() });
    const root = await mountInspector({ selection: SELECTION, trace });
    const rows = all(one(root, "viewer-inspector-trace"), "viewer-inspector-trace-variable");

    for (const row of rows) {
      const source = row.getAttribute("data-source") as string;
      const expected = trace.sources[source];
      const links = all(row, "viewer-inspector-trace-source");
      if (expected === undefined) {
        expect(links.length, `${row.getAttribute("data-name")}: a key on no sheet offers no link that lands nowhere`).toBe(0);
        continue;
      }
      expect(links.length, `${row.getAttribute("data-name")}: one link to the sheet it was read on`).toBe(1);
      const link = links[0] as HTMLElement;
      expect(link.getAttribute("data-sheet"), "named by the sheet's number").toBe(expected.sheet);
      expect(link.querySelector("a")?.getAttribute("href"), "and opening that sheet at that key").toBe(expected.href);
      expect(text(link), "the link says the sheet").toContain(expected.sheet);
    }
    const breadth = rows.find((row) => row.getAttribute("data-name") === "breadth") as HTMLElement;
    expect(one(breadth, "viewer-inspector-trace-source").getAttribute("data-sheet"), "the schedule-cell reading opens the schedule's own sheet").toBe("S-111");
    const height = rows.find((row) => row.getAttribute("data-name") === "height") as HTMLElement;
    expect(all(height, "viewer-inspector-trace-source").length, "the reading on no sheet offers none").toBe(0);
  });

  test("VD-2: a line kept with no quantity says what it left out — never a bare unit", async () => {
    const strings = await stringTable();
    const evidence = anEvidence({
      kind: "rcc.rebar",
      value: null,
      unit: "kg",
      omitted: [
        { variable: "lap", code: "NOTE_READING_CONTESTED" },
        { variable: "ties", code: "REBAR_TIE_ZONE_UNSTATED" },
      ],
    });
    const root = await mountInspector({ selection: SELECTION, trace: aTrace({ evidence }) });
    const figure = one(root, "viewer-inspector-trace-figure");
    expect(text(figure), "the components it left out, by name").toBe(fillSlots(registered(strings, "trace_figure_omitted"), { variables: "lap, ties" }));
    expect(figure.querySelector(testIdSelector(TESTIDS.unit.badge)), "and no unit stands alone where a figure is not").toBeNull();
    cleanup();

    const bare = await mountInspector({ selection: SELECTION, trace: aTrace({ evidence: anEvidence({ value: null, omitted: [] }) }) });
    expect(text(one(bare, "viewer-inspector-trace-figure")), "a line naming no component says no figure stands").toBe(registered(strings, "trace_figure_unstated"));
  });
});

describe("VD-2: the Cited-by rows read in QS words (walk-1 B15)", () => {
  test("VD-2: each citing row is named by member, level and kind, its figure is formatted, and its key is a chip", async () => {
    const strings = await stringTable();
    const concrete = aCitedLine();
    const rebar = aCitedLine({ lineId: "b1d6f0aa-0000-4000-8000-000000000002", kind: "rcc.rebar", value: null, unit: "kg", omitted: [{ variable: "lap", code: "NOTE_READING_CONTESTED" }] });
    const root = await mountInspector({ selection: SELECTION, cited: aCited([concrete, rebar]) });
    const rows = all(one(root, "viewer-inspector-cited"), "viewer-inspector-cited-line");

    const first = rows[0] as HTMLElement;
    expect(text(first.querySelector("a")), "the way back is labelled as the register names the row").toContain(wordsOf(strings, "C4", "GF", "Column", "concrete"));
    expect(text(first.querySelector(".cx-viewer-cited-figure .cx-quantity-figure")), "the figure").toBe(concrete.value);
    expect(text(first.querySelector(`.cx-viewer-cited-figure ${testIdSelector(TESTIDS.unit.badge)}`)), "with its unit").toBe(concrete.unit);
    expect(chipValues(first), "the object key is an IdChip").toEqual([concrete.objectKey]);
    expect(text(first), "and never body text").not.toContain(concrete.objectKey);

    const second = rows[1] as HTMLElement;
    expect(text(second.querySelector("a")), "the rebar row names its kind in words").toContain(wordsOf(strings, "C4", "GF", "Column", "rebar"));
    expect(text(second), "and says what it left out, never a bare kg").toContain(fillSlots(registered(strings, "trace_figure_omitted"), { variables: "lap" }));
    expect(second.querySelector(testIdSelector(TESTIDS.unit.badge)), "no unit stands alone").toBeNull();
  });
});

describe("VD-2: the missing cell is R-UI-050's partial", () => {
  test("VD-2: it counts what it lacks, and names and opens the sheet a key does stand on", async () => {
    const strings = await stringTable();
    const trace = aTrace({ evidence: anEvidence() });
    const elsewhere = keyOf(0x2b7);
    const nowhere = keyOf(0xfff);
    const root = await mountInspector({ selection: SELECTION.slice(0, 1), missing: [elsewhere, nowhere], trace });

    expect(text(one(root, "viewer-inspector-missing-count")), "the partial is counted").toBe(fillSlots(registered(strings, "viewer_inspector_missing_count"), { count: "2" }));
    const rows = all(one(root, "viewer-inspector-missing"), "viewer-inspector-missing-key");
    const found = rows.find((row) => row.getAttribute("data-key") === elsewhere) as HTMLElement;
    const sheet = one(found, "viewer-inspector-missing-sheet");
    expect(sheet.getAttribute("data-sheet"), "the key read on the schedule is said to stand on the schedule's sheet").toBe("S-111");
    expect(text(sheet), "in the registry's words").toContain(fillSlots(registered(strings, "viewer_inspector_missing_elsewhere"), { sheet: "S-111" }));
    expect(sheet.querySelector("a")?.getAttribute("href"), "and it opens that sheet").toBe(trace.sources[elsewhere]?.href);
    const lost = rows.find((row) => row.getAttribute("data-key") === nowhere) as HTMLElement;
    expect(all(lost, "viewer-inspector-missing-sheet").length, "a key the Trace answers no sheet for claims none").toBe(0);
  });
});

describe("VD-2: sourceLinksOf — where each cited key is followed to (I-553)", () => {
  test("VD-2: a source key opens its own sheet at itself; a placement opens the member's; a view, an edition and a key on no sheet are not offered", async () => {
    const address = await productModule<{
      sourceLinksOf: (tenant: string, project: string, line: Record<string, unknown>) => Record<string, { sheet: string; href: string }>;
      selectionAddress: (tenant: string, project: string, sheet: { drawingId: string; layoutName: string; sourceKeys: readonly string[] }) => string;
    }>("src/modules/takeoff/trace/address.ts");
    const view = "v:LAYOUT_PLAN:DXF_HANDLE:20B6";
    const placement = `${view}|C1|1220421.6,-400000.0`;
    const cell = "DXF_HANDLE:9DC";
    const note = "DXF_HANDLE:1D90";
    const drawingId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const line = {
      drawingId,
      layoutName: "S-10 Plan",
      traceKeys: ["DXF_HANDLE:988", "DXF_HANDLE:989"],
      sourceSheets: { [view]: "S-10 Plan", [placement]: "S-10 Plan", [cell]: "S-11 Schedule", [note]: null, "edition:IS1200_IN@2027.05": null },
      sheetLabels: { "S-10 Plan": "S-10", "S-11 Schedule": "S-11" },
    };
    const links = address.sourceLinksOf("t", "p", line);

    expect(Object.keys(links).sort(), "only the keys a reader can land on").toEqual([cell, placement].sort());
    expect(links[cell], "the schedule cell opens S-11 with the cell selected").toEqual({ sheet: "S-11", href: address.selectionAddress("t", "p", { drawingId, layoutName: "S-11 Schedule", sourceKeys: [cell] }) });
    expect(links[placement], "the placement opens the member's sheet with the member selected").toEqual({
      sheet: "S-10",
      href: address.selectionAddress("t", "p", { drawingId, layoutName: "S-10 Plan", sourceKeys: line.traceKeys }),
    });

    const unnumbered = address.sourceLinksOf("t", "p", { ...line, sheetLabels: {} });
    expect(unnumbered[cell]?.sheet, "a sheet the record numbers nowhere is named by its layout").toBe("S-11 Schedule");
  });
});
