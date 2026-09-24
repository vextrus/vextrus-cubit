// @vitest-environment jsdom
/**
 * s-coverage I-613: a beam a plan draws and no mark names is named on the measurement boundary
 * — by the plan that draws it and its grid reference, under the one registered reason — enumerated,
 * never counted (L-QTY-04, L-QTY-07). The statement stands on the certificate whatever the class's
 * cells read, because a cell the class's other members made quantity-bearing says nothing of these.
 * The enumeration itself is graded in tests/residue/unnamed-statement.test.ts.
 */
import { afterEach, describe, expect, test } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { REFUSALS } from "@/core/errors";
import { unnamedStatementOf, type UnnamedPair } from "@/core/residue";
import { CoverageWorkspace } from "@/modules/takeoff/coverage/coverage-workspace";
import { COVERAGE_COPY } from "@/modules/takeoff/coverage/copy";
import type { CoverageView } from "@/modules/takeoff/coverage/view";
import { TESTIDS, testIdSelector } from "@/ui/testids";

afterEach(cleanup);

const GRADE_BEAMS = "GRADE BEAM LAYOUT & GF SLAB ON GRADE  SCALE 1:100";
const TYPICAL = "TYPICAL FLOOR BEAM LAYOUT";

const pair = (over: Partial<UnnamedPair>): UnnamedPair => ({
  drawingId: "drawing-1",
  viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:2073",
  caption: GRADE_BEAMS,
  layoutName: "S-12",
  edgeKeys: ["DXF_HANDLE:7BA", "DXF_HANDLE:7BB"],
  width: "300.0",
  gridLetter: "B",
  gridNumeral: "1",
  ...over,
});

/** Three pairs on two sheets, handed out of order. */
const PAIRS: readonly UnnamedPair[] = [
  pair({ viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:F31", caption: TYPICAL, layoutName: "S-14", edgeKeys: ["DXF_HANDLE:EEE", "DXF_HANDLE:EEF"], width: "250.0", gridLetter: "A", gridNumeral: "5" }),
  pair({ edgeKeys: ["DXF_HANDLE:7C8", "DXF_HANDLE:7C9"], gridLetter: "A", gridNumeral: "1" }),
  pair({}),
];

function view(over: Partial<CoverageView> = {}): CoverageView {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    campaignId: "campaign-1",
    setRevisionId: "rev-1",
    input: { bears: [], workItems: [], levels: [], sightings: [], lines: [], declarations: [], truncated: [], observations: [] },
    cells: [],
    measurement: [],
    partial: [],
    unclassed: [],
    bill: [],
    declaredLineIds: [],
    ...over,
  };
}

async function mount(of: CoverageView): Promise<HTMLElement> {
  const rendered = render(<CoverageWorkspace permitted view={of} cell={null} />);
  await act(async () => {
    await Promise.resolve();
  });
  return rendered.container;
}

describe("the certificate preview names each unnamed beam", () => {
  test("one row a pair: the plan's caption, its grid reference and the registry's reason — and no none sentence", async () => {
    const root = await mount(view({ unnamed: unnamedStatementOf(PAIRS) }));
    const measurement = root.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.coverage.statement)}[data-axis="MEASUREMENT"]`);
    const rows = [...(measurement?.querySelectorAll<HTMLElement>(".cx-coverage-statement-unnamed") ?? [])];
    expect(rows.map((row) => row.getAttribute("data-source")), "each pair by its first edge line, in the certificate's order").toEqual(["DXF_HANDLE:7C8", "DXF_HANDLE:7BA", "DXF_HANDLE:EEE"]);
    expect(rows.every((row) => row.getAttribute("data-code") === REFUSALS.FRAMED_PAIR_UNNAMED.code)).toBe(true);
    const first = rows[0];
    expect(first?.textContent).toContain(COVERAGE_COPY.takeoff_coverage_statement_unnamed_label);
    expect(first?.textContent).toContain(GRADE_BEAMS);
    expect(first?.textContent).toContain("Grid A/1");
    expect(first?.textContent).toContain(REFUSALS.FRAMED_PAIR_UNNAMED.message);
    expect(measurement?.querySelector(testIdSelector(TESTIDS.coverage.statementNone)), "a boundary with a beam outside it is no complete boundary").toBeNull();
    // L-QTY-07: enumerations, never cardinalities.
    expect(measurement?.textContent ?? "").not.toMatch(/\b3\b/);
  });

  test("with nothing unnamed, nothing is said of it", async () => {
    const root = await mount(view());
    expect(root.querySelectorAll(".cx-coverage-statement-unnamed")).toHaveLength(0);
  });
});
