// @vitest-environment jsdom
/**
 * viewer.md Part 6 § 1–3 — the legend on the sheet (R-TO-044): one row per condition with its
 * measured placements and its measured-scope totals (L-QTY-07), the unmeasured with their reason and
 * no figure, the bases keyed by glyph, the other sheets named, and every R-UI-050 cell.
 *
 * The copy is the registry's own, handed in exactly as the screen hands it (I-636), so a sentence
 * asserted here is the one a reader reads. Every figure is recomputed with decimal.js (B-07).
 */
import Decimal from "decimal.js";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { placesOf } from "@/core/documents/kinds/boq-draft-law";
import { formatUserFigure } from "@/core/format";
import { QUANTITY_COPY_KEYS, type QuantityCopy } from "@/modules/takeoff/viewer-quantity-overlay/copy";
import { QuantityLegend, type QuantityLegendProps } from "@/modules/takeoff/viewer-quantity-overlay/legend";
import { classCondition, figuresOf } from "@/modules/takeoff/viewer-quantity-overlay/scene";
import type { QuantityOverlay, QuantityPlacement } from "@/modules/takeoff/viewer-quantity-overlay/types";
import { statedAt } from "@/modules/takeoff/bbs-ui/present";
import { BASIS_GLYPHS } from "@/ui/primitives/core/basis";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";

afterEach(cleanup);

const COPY: QuantityCopy = Object.fromEntries(QUANTITY_COPY_KEYS.map((key) => [key, strings[key]])) as QuantityCopy;

const TEST_IDS = {
  legend: TESTIDS.viewer.quantityLegend,
  row: TESTIDS.viewer.quantityLegendRow,
  total: TESTIDS.viewer.quantityLegendTotal,
  unmeasured: TESTIDS.viewer.quantityLegendUnmeasured,
  basis: TESTIDS.viewer.quantityLegendBasis,
  elsewhere: TESTIDS.viewer.quantityLegendElsewhere,
  retry: TESTIDS.viewer.quantityRetry,
};

const CONCRETE = "rcc.concrete" as const;
const COLUMN_VALUES = ["0.451500", "0.451500", "0.362880"];

function member(key: string, klass: "column" | "beam", lines: Parameters<typeof figuresOf>[0]): QuantityPlacement {
  return { key, source: "rail", class: klass, mark: key, condition: classCondition(klass), keys: [], box: { min: [0, 0], max: [1, 1] }, rings: [], ...figuresOf(lines) };
}

const OVERLAY: QuantityOverlay = {
  campaignId: "campaign",
  placements: [
    member("C1", "column", [
      { kind: CONCRETE, coverage: "COMPLETE", value: COLUMN_VALUES[0] as string, unit: "m3", quantityBasis: "MEASURED", omitted: [] },
      { kind: CONCRETE, coverage: "COMPLETE", value: COLUMN_VALUES[1] as string, unit: "m3", quantityBasis: "MEASURED", omitted: [] },
    ]),
    member("C2", "column", [{ kind: CONCRETE, coverage: "COMPLETE", value: COLUMN_VALUES[2] as string, unit: "m3", quantityBasis: "DERIVED", omitted: [] }]),
    member("B1", "beam", [{ kind: CONCRETE, coverage: "PARTIAL_DECLARED", value: null, unit: "m3", quantityBasis: "MEASURED", omitted: [{ variable: "depth", code: "BEAM_DEPTH_UNSTATED" }] }]),
  ],
  elsewhere: [{ layoutName: "S-11 BEAM LAYOUT", label: "S-11", placements: 4 }],
};

function Swatch({ colour, hatch }: { colour: string; hatch: string }) {
  return <span data-swatch={`${colour}/${hatch}`} />;
}

function mount(over: Partial<QuantityLegendProps> = {}) {
  const props: QuantityLegendProps = {
    copy: COPY,
    humanise: humaniseEnum,
    glyphs: BASIS_GLYPHS,
    Swatch,
    phase: "ready",
    overlay: OVERLAY,
    toggles: { quantities: true, unmeasured: false },
    faultId: null,
    onRetry: () => undefined,
    refusal: null,
    testIds: TEST_IDS,
    ...over,
  };
  return render(<QuantityLegend {...props} />);
}

describe("the legend on the sheet", () => {
  test("the overlay off, no legend stands", () => {
    mount({ toggles: { quantities: false, unmeasured: false } });
    expect(screen.queryByTestId(TESTIDS.viewer.quantityLegend)).toBeNull();
  });

  test("a condition's row reads 'Column · 2 · <measured scope> m3', the exact sum on its data-value, under the measured-scope heading", () => {
    mount();
    const legend = screen.getByTestId(TESTIDS.viewer.quantityLegend);
    expect(within(legend).getByText(strings.viewer_quantity_measured_scope), "the totals are labelled measured scope (L-QTY-07)").toBeTruthy();
    const rows = within(legend).getAllByTestId(TESTIDS.viewer.quantityLegendRow);
    expect(rows.map((row) => row.dataset.condition), "the beam, measured nowhere, has no measured row").toEqual(["class:column"]);
    const exact = COLUMN_VALUES.reduce((sum, value) => sum.plus(value), new Decimal(0)).toFixed();
    const total = within(rows[0] as HTMLElement).getByTestId(TESTIDS.viewer.quantityLegendTotal);
    expect(total.dataset.value, "the exact sum travels whole").toBe(exact);
    expect(rows[0]?.textContent).toBe(`${humaniseEnum("column")} · 2 · ${formatUserFigure(statedAt(exact, placesOf(CONCRETE)))} m3`);
    expect(rows[0]?.querySelector("[data-swatch]")?.getAttribute("data-swatch"), "keyed by the condition's colour and hatch").toBe("column/solid");
  });

  test("the bases the paint uses are keyed by glyph and word, each once, in the palette's order", () => {
    mount();
    const bases = screen.getAllByTestId(TESTIDS.viewer.quantityLegendBasis);
    expect(bases.map((basis) => basis.dataset.basis)).toEqual(["MEASURED", "DERIVED"]);
    expect(bases[0]?.textContent).toBe(`${BASIS_GLYPHS.MEASURED}${humaniseEnum("MEASURED")}`);
  });

  test("with the unmeasured shown, the beams stand with their count and their reason, and no figure", () => {
    mount({ toggles: { quantities: true, unmeasured: true } });
    const row = screen.getByTestId(TESTIDS.viewer.quantityLegendUnmeasured);
    expect(row.dataset.condition).toBe("class:beam");
    expect(row.dataset.codes).toBe("BEAM_DEPTH_UNSTATED");
    expect(row.textContent).toContain(COPY.viewer_quantity_omitted.replace("{variables}", "depth"));
    expect(within(row).queryByTestId(TESTIDS.viewer.quantityLegendTotal), "never totalled").toBeNull();
  });

  test("the other sheets the campaign's members stand on are named, by their numbers", () => {
    mount();
    expect(screen.getByTestId(TESTIDS.viewer.quantityLegendElsewhere).textContent).toContain(COPY.viewer_quantity_elsewhere_row.replace("{sheet}", "S-11").replace("{count}", "4"));
  });

  test("every R-UI-050 cell: loading, empty, failed with its id and a retry, refused through the one RefusalState", () => {
    mount({ phase: "loading", overlay: null });
    expect(screen.getByTestId(TESTIDS.viewer.quantityLegend).dataset.state).toBe("loading");
    expect(screen.getByRole("status").textContent).toBe(COPY.viewer_quantity_loading);
    cleanup();

    mount({ phase: "empty", overlay: { campaignId: "c", placements: [], elsewhere: [] } });
    expect(screen.getByText(COPY.viewer_quantity_empty)).toBeTruthy();
    cleanup();

    const onRetry = vi.fn();
    mount({ phase: "failed", overlay: null, faultId: "F-1", onRetry });
    expect(screen.getByRole("alert").textContent).toContain(COPY.viewer_quantity_failed);
    expect(screen.getByRole("alert").textContent).toContain("F-1");
    fireEvent.click(screen.getByTestId(TESTIDS.viewer.quantityRetry));
    expect(onRetry).toHaveBeenCalledTimes(1);
    cleanup();

    mount({ phase: "refused", overlay: null, refusal: <p data-refusal="WORKSPACE_PERMISSION_NOT_HELD" /> });
    expect(document.querySelector("[data-refusal]")).not.toBeNull();
  });
});
