// @vitest-environment jsdom
/**
 * I-37 (L-AI-01, L-AI-02, R-AI-005): the model ledger panel reads itself. Armed with rows, it lists
 * the calls as a grid — ids through IdChip, enums through EnumLabel, the person's outcome beside
 * the call or the awaiting copy where nobody has judged it — and one calibration line per question
 * in the Decision's own words. Armed with no rows, it is the count and caption it was before this
 * Interpretation and nothing else, so the committed picture of a fresh project did not move.
 *
 * Mounted under jsdom over fixture rows; no store, no seam. The grid is the shipped DataTable, which
 * asks the document for a ResizeObserver jsdom does not ship — the gallery's stubs answer it.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { formatUserFigure } from "../../../src/core/format";
import { fill } from "../../../src/ui/strings";
import { installGalleryDomStubs } from "../s-design/support/gallery-contract";
import { TESTID, decisionCopy, productModule } from "./support/decision";

const PANELS_MODULE = "src/app/(app)/t/[tenant]/p/[project]/audit/audit-panels.tsx";

type Call = {
  callId: string;
  modelId: string;
  question: string | null;
  transport: string;
  outcome: string;
  refusalCode: string | null;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
  confidence: string | null;
  judged: string | null;
  calledAt: Date;
};

type Line = {
  question: string;
  proposed: number;
  refused: number;
  confirmed: number;
  overruled: number;
  repudiated: number;
  affirmed: number;
  awaiting: number;
  meanConfidenceWhenRight: string | null;
  meanConfidenceWhenWrong: string | null;
};

type Panels = (props: { modelLedger: { armed: true; rowCount: number } | { armed: false }; jobs: { armed: false }; ledger: { calls: Call[]; calibration: Line[] } }) => React.ReactElement;

const CONFIRMED_CALL = "0f3f1a2b-0000-4000-8000-000000000001";
const AWAITING_CALL = "0f3f1a2b-0000-4000-8000-000000000002";
const REFUSED_CALL = "0f3f1a2b-0000-4000-8000-000000000003";

function call(over: Partial<Call> & Pick<Call, "callId">): Call {
  return {
    modelId: "claude-sonnet-5",
    question: "view-caption",
    transport: "fixture",
    outcome: "proposed",
    refusalCode: null,
    inputTokens: 90,
    outputTokens: 5,
    attributedCost: "0.00042",
    confidence: "0.910",
    judged: null,
    calledAt: new Date("2026-09-21T04:00:00Z"),
    ...over,
  };
}

const LINE: Line = { question: "view-caption", proposed: 2, refused: 1, confirmed: 1, overruled: 0, repudiated: 0, affirmed: 0, awaiting: 1, meanConfidenceWhenRight: "0.910", meanConfidenceWhenWrong: null };

async function panels(): Promise<Panels> {
  const module = await productModule<{ AuditPanels?: Panels }>(PANELS_MODULE);
  expect(typeof module.AuditPanels, `${PANELS_MODULE} exports AuditPanels`).toBe("function");
  return module.AuditPanels as Panels;
}

afterEach(cleanup);

describe("I-37 — the armed ledger panel with rows", () => {
  test("lists every call as a grid row carrying its id, question and judgment, and spells the outcome as the Decision rules it", async () => {
    installGalleryDomStubs();
    const AuditPanels = await panels();
    const copy = decisionCopy();
    const calls = [
      call({ callId: REFUSED_CALL, outcome: "refused", refusalCode: "FIXTURE_MISSING", confidence: null, inputTokens: 0, outputTokens: 0, attributedCost: "0" }),
      call({ callId: AWAITING_CALL, confidence: "0.400" }),
      call({ callId: CONFIRMED_CALL, judged: "CONFIRMED" }),
    ];
    render(<AuditPanels jobs={{ armed: false }} ledger={{ calls, calibration: [LINE] }} modelLedger={{ armed: true, rowCount: 3 }} />);

    const panel = screen.getByTestId(TESTID.panelModelLedger);
    expect(panel.getAttribute("data-rows"), "the section states how many calls it lists").toBe("3");
    expect(panel.className, "a panel that lists spans both columns").toContain("cx-audit-panel-ledger");
    const grid = within(panel).getByTestId(TESTID.ledgerGrid);
    expect(grid.getAttribute("data-rows")).toBe("3");

    const rows = within(grid).getAllByTestId(TESTID.ledgerRow);
    expect(rows.map((row) => row.getAttribute("data-call")), "one row per call, in the order the module answered them").toEqual([REFUSED_CALL, AWAITING_CALL, CONFIRMED_CALL]);
    expect(rows.map((row) => row.getAttribute("data-judged"))).toEqual(["", "", "CONFIRMED"]);
    expect(rows.map((row) => row.getAttribute("data-question"))).toEqual(["view-caption", "view-caption", "view-caption"]);

    // The outcome cell: the refusal's code as an enum, the awaiting copy, the person's outcome as an enum.
    expect(within(rows[0] as HTMLElement).getByText("Fixture missing")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText(copy["audit_ledger_outcome_awaiting"] ?? "")).toBeTruthy();
    expect(within(rows[2] as HTMLElement).getByText("Confirmed")).toBeTruthy();

    // Ids through IdChip, never as body text: the full uuid appears in no row's visible text.
    for (const row of rows) expect(row.textContent).not.toContain(CONFIRMED_CALL);
    expect(within(rows[2] as HTMLElement).getByText(CONFIRMED_CALL.slice(0, 7), { exact: false })).toBeTruthy();

    // The confidence to three places, and the awaiting copy's dash where none was stated.
    expect(within(rows[2] as HTMLElement).getByText("0.910")).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByText(copy["audit_ledger_no_confidence"] ?? "—")).toBeTruthy();
  });

  test("states one calibration line per question in the Decision's words, every figure grouped by the format seam", async () => {
    installGalleryDomStubs();
    const AuditPanels = await panels();
    const copy = decisionCopy();
    const both: Line = { ...LINE, question: "sheet-reading", overruled: 1, meanConfidenceWhenWrong: "0.610" };
    const none: Line = { ...LINE, question: "unnamed", meanConfidenceWhenRight: null };
    render(<AuditPanels jobs={{ armed: false }} ledger={{ calls: [call({ callId: CONFIRMED_CALL })], calibration: [both, LINE, none] }} modelLedger={{ armed: true, rowCount: 1 }} />);

    const calibration = screen.getByTestId(TESTID.ledgerCalibration);
    expect(within(calibration).getByText(copy["audit_ledger_calibration_heading"] ?? "")).toBeTruthy();
    const lines = within(calibration).getAllByTestId(TESTID.ledgerCalibrationLine);
    expect(lines.map((line) => line.getAttribute("data-question"))).toEqual(["sheet-reading", "view-caption", "unnamed"]);

    const counts = fill(copy["audit_ledger_calibration_counts"] ?? "", {
      proposed: formatUserFigure("2"),
      confirmed: formatUserFigure("1"),
      overruled: formatUserFigure("1"),
      repudiated: formatUserFigure("0"),
      affirmed: formatUserFigure("0"),
      awaiting: formatUserFigure("1"),
      refused: formatUserFigure("1"),
    });
    expect(within(lines[0] as HTMLElement).getByText(counts)).toBeTruthy();
    expect(within(lines[0] as HTMLElement).getByText(fill(copy["audit_ledger_calibration_confidence"] ?? "", { right: "0.910", wrong: "0.610" }))).toBeTruthy();
    expect(within(lines[1] as HTMLElement).getByText(fill(copy["audit_ledger_calibration_confidence_partial"] ?? "", { stated: "0.910" }))).toBeTruthy();
    expect(within(lines[2] as HTMLElement).getByText(copy["audit_ledger_calibration_no_confidence"] ?? "")).toBeTruthy();
  });

  test("armed with no rows, the panel is the count and caption it was before — no grid, no line, its half of the measure", async () => {
    const AuditPanels = await panels();
    render(<AuditPanels jobs={{ armed: false }} ledger={{ calls: [], calibration: [] }} modelLedger={{ armed: true, rowCount: 0 }} />);
    const panel = screen.getByTestId(TESTID.panelModelLedger);
    expect(panel.getAttribute("data-armed")).toBe("true");
    expect(panel.getAttribute("data-rows")).toBe("0");
    expect(panel.className).not.toContain("cx-audit-panel-ledger");
    expect(within(panel).queryByTestId(TESTID.ledgerGrid)).toBeNull();
    expect(within(panel).queryByTestId(TESTID.ledgerCalibration)).toBeNull();
    expect(within(panel).getByText(formatUserFigure("0"))).toBeTruthy();
  });
});
