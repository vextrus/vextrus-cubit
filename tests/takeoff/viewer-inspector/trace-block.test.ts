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
import { productModule, registered, stringTable, type IndexBox } from "./support/inspector-support";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import {
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
