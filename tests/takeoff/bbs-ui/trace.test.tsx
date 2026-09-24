// @vitest-environment jsdom
/**
 * I-559 — from the bar schedule, a column's mass flies to that column on its plan, and a bar's mark
 * to the schedule cells it was read off (docs/design/s-bbs.md; R-UI-022; evidence-link I-555).
 *
 * Two halves. The server's pure half (`tracesOver`) is asked over a hand-built record — one model space
 * framed by S-10, the three members of C2 placed on it, the schedule's cells drawn on S-03 — so what is
 * judged is which sheet and which entities each figure selects. The workspace is then mounted over a
 * reading carrying those selections, with a table that draws what it is handed, so what is judged is
 * what a QS meets: the Mass cell is a Trace to the members it weighs, the Mark cell a Trace to the
 * schedule, each in its basis — and a figure the server resolved nothing for stands unlinked.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { REFUSALS, type RefusalEntry } from "../../../src/core/errors";
import { placementKey } from "../../../src/core/identity";
import type { RecordStanding } from "../../../src/core/sheets/frames";
import { barRowKeyOf, type BarRow } from "../../../src/modules/takeoff/rebar/bars";
import { scheduleOf } from "../../../src/modules/takeoff/rebar/store";
import { tracesOver } from "../../../src/modules/takeoff/bbs-ui/server";
import type { BbsDocument, BbsTraces, BbsView } from "../../../src/modules/takeoff/bbs-ui/view";
import { BbsWorkspace, type BbsChrome } from "../../../src/modules/takeoff/bbs-ui/workspace";
import type { PinnedRecord } from "../../../src/modules/takeoff/trace";
import { SELECTION_PARAM, splitSelection } from "../../../src/modules/takeoff/viewer-inspector/selection";
import { TESTIDS } from "../../../src/ui/testids";

afterEach(() => {
  cleanup();
});

const VIEW = { viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: "DXF_HANDLE:9A" } as const;
/** A member's instance key: its placement, then the level it stands on. */
const member = (mark: string, x: number): string => `${placementKey({ view: VIEW, mark, x, y: 0 })}@level:1f`;
const C2_A = member("C2", 0);
const C2_B = member("C2", 4);
const C2_C = member("C2", 8);
/** A member nobody stored a placement for: counted, never selected. */
const C9 = member("C9", 900);

const CELL_MAIN = "DXF_HANDLE:5A";
const CELL_RUN = "DXF_HANDLE:5B";

/** C2's three members placed on S-10's window of model space; the schedule's two cells drawn on S-03. */
function records(): ReadonlyMap<string, PinnedRecord> {
  const outlines = [C2_A, C2_B, C2_C].map((key, at) => [key, `DXF_HANDLE:${(0x10 + at).toString(16).toUpperCase()}`, `DXF_HANDLE:${(0x20 + at).toString(16).toUpperCase()}`] as const);
  const standing: RecordStanding = {
    sheets: [
      { layoutName: "Model", kind: "model" },
      { layoutName: "S-03", kind: "paper" },
      { layoutName: "S-10", kind: "paper" },
    ],
    spaces: new Map([...outlines.flatMap(([, outline, mark]) => [[outline, "Model"] as const, [mark, "Model"] as const]), [CELL_MAIN, "S-03"], [CELL_RUN, "S-03"]]),
    frames: {
      windows: [{ layoutName: "S-10", model: [-1, -1, 20, 20] }],
      standing: new Map(outlines.flatMap(([, outline, mark], at) => [[outline, [at * 4, 0] as const] as const, [mark, [at * 4, 1] as const] as const])),
    },
    members: new Map(outlines.map(([key, outline, mark]) => [key.slice(0, key.indexOf("@level:")), { outlineKey: outline, markKey: mark }])),
  };
  return new Map([["drawing-1", { standing, labelOf: (layoutName: string) => layoutName, gridOf: () => null }]]);
}

/** One member's main bar, stored as the rail stores one: counted at one member. */
function mainBar(objectKey: string, mark: string, sourceKeys: readonly string[]): BarRow {
  return {
    barKey: barRowKeyOf({ objectKey, role: "MAIN", diameterMm: 20, sequence: 0 }),
    objectKey,
    class: "column",
    level: "1F",
    mark,
    barMark: `${mark}-v`,
    role: "MAIN",
    diameterMm: 20,
    shape: "00",
    dimsMm: { A: "3048.000" },
    cuttingRawMm: "3048.000",
    cuttingRoundedMm: "3050",
    cuttingIsAdditiveMm: "3048.000",
    piecesPerBar: 1,
    lapMm: "0",
    lapsPerBar: 0,
    barsPerUnit: 10,
    parentCount: "1",
    bars: "10",
    kgPerMetre: "2.466",
    kgNet: "75.16368",
    kgLap: "0",
    kg: "75.16368",
    sourceKeys: [...sourceKeys],
    detailingSourceKeys: [],
    editionDigest: "edition",
    semantic: `${objectKey}|MAIN`,
  };
}

/** C2 three times on 1F with one bar set, read off the schedule's two cells; C9 alone, read off nothing drawn. */
function door(): BbsDocument {
  const rows = [
    mainBar(C2_A, "C2", [CELL_MAIN, CELL_RUN]),
    mainBar(C2_B, "C2", [CELL_MAIN, CELL_RUN]),
    mainBar(C2_C, "C2", [CELL_MAIN, CELL_RUN]),
    mainBar(C9, "C9", ["DXF_HANDLE:FFF"]),
  ];
  return {
    campaignId: "campaign-1",
    stockMm: "12000",
    roundingMm: 25,
    rows: scheduleOf(rows),
    perDiameterKg: { "20": "300.65472" },
    perMarkKg: { "C2-v": "225.49104", "C9-v": "75.16368" },
    cuttingStock: { "20": { stockBars: 12, pieces: 40, offcutMm: "22000", method: "first-fit-decreasing" } },
    grandTotalKg: "300.65472",
  };
}

describe("I-559: what a schedule's figures select (the server's pure half)", () => {
  it("an entry's mass selects every member it weighs on its plan; a bar's mark selects its schedule cells on their sheet", () => {
    const document_ = door();
    const traces = tracesOver(document_, records());
    const c2 = document_.rows.find((line) => line.mark === "C2") as BbsDocument["rows"][number];
    expect(traces.members[c2.objectKey], "C2's mass: the three members' outlines and marks, on S-10").toEqual({
      drawingId: "drawing-1",
      layoutName: "S-10",
      sourceKeys: ["DXF_HANDLE:10", "DXF_HANDLE:20", "DXF_HANDLE:11", "DXF_HANDLE:21", "DXF_HANDLE:12", "DXF_HANDLE:22"],
    });
    expect(traces.bars[c2.barKey], "C2's bar: the two schedule cells it was read off, on S-03").toEqual({ drawingId: "drawing-1", layoutName: "S-03", sourceKeys: [CELL_MAIN, CELL_RUN] });

    const c9 = document_.rows.find((line) => line.mark === "C9") as BbsDocument["rows"][number];
    expect(traces.members[c9.objectKey], "a member no stored placement names is never guessed at").toBeUndefined();
    expect(traces.bars[c9.barKey], "nor a cell no drawing holds").toBeUndefined();
  });
});

/* ------------------------------------------------------------------------------ the workspace */

/** A stub that renders its children and every data attribute it was handed. */
function passThrough(tag: keyof HTMLElementTagNameMap): ComponentType<Record<string, unknown>> {
  const Stub = (props: Record<string, unknown>): ReactNode => {
    const Tag = tag as "div";
    const attributes = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children" && key !== "content" && key !== "onClick" && key !== "onRetry"));
    return <Tag {...(attributes as Record<string, string>)}>{props["children"] as ReactNode}</Tag>;
  };
  return Stub;
}

type StubTable = {
  columns: { id: string; cell: (context: { row: { original: unknown } }) => ReactNode }[];
  data: unknown[];
  getRowId: (row: unknown, index: number) => string;
  rowDataOf?: (row: unknown, rowId: string) => Readonly<Record<string, string>>;
};

/** The chrome the workspace declares, with a table that DRAWS what it is handed and the link's contract. */
function chrome(): BbsChrome {
  const DataTable = ({ columns, data, getRowId, rowDataOf }: StubTable): ReactNode => (
    <div data-testid={TESTIDS.datatable.root} data-rows-rendered={String(data.length)}>
      {data.map((row, index) => {
        const id = getRowId(row, index);
        return (
          <div key={id} role="row" {...(rowDataOf?.(row, id) ?? {})}>
            {columns.map((column) => (
              <span key={column.id} role="gridcell" data-column={column.id}>
                {column.cell({ row: { original: row } })}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
  const EvidenceLink: BbsChrome["EvidenceLink"] = ({ href, basis, label, ...rest }) => (
    <a data-testid={TESTIDS.evidence.link} href={href} data-basis={basis} {...rest}>
      {label}
    </a>
  );
  return {
    DataTable: DataTable as unknown as BbsChrome["DataTable"],
    EmptyState: passThrough("section") as BbsChrome["EmptyState"],
    ErrorState: passThrough("section") as BbsChrome["ErrorState"],
    RefusalState: (() => <div />) as BbsChrome["RefusalState"],
    IdChip: (({ value }: { value: string }) => <span data-value={value} />) as BbsChrome["IdChip"],
    EnumLabel: (({ value, label }: { value: string; label?: string }) => <span>{label ?? value}</span>) as BbsChrome["EnumLabel"],
    EvidenceLink,
    Skeleton: passThrough("span") as BbsChrome["Skeleton"],
    Tooltip: (({ children }: { content: ReactNode; children: ReactNode }) => <>{children}</>) as BbsChrome["Tooltip"],
    Note: (({ label }: { label: string }) => <button aria-label={label} />) as BbsChrome["Note"],
    JobTimeline: (() => <ol />) as BbsChrome["JobTimeline"],
    Button: passThrough("button") as BbsChrome["Button"],
  };
}

const refusalOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

function viewWith(traces: BbsTraces | undefined): BbsView {
  const document_ = door();
  return { campaignId: "campaign-1", setRevisionId: "revision-1", document: document_, partial: false, omitted: [], ...(traces === undefined ? {} : { traces }) };
}

function barRow(mark: string): Element {
  const rows = [...screen.getByTestId(TESTIDS.bbs.grid).querySelectorAll(`[data-testid="${TESTIDS.bbs.row}"]`)];
  return rows.find((row) => row.getAttribute("data-bar-mark") === `${mark}-v`) as Element;
}

describe("I-559: a column's mass flies to that column on its plan", () => {
  it("the Mass cell is a DERIVED Trace to the members it weighs, the Mark cell a TRANSCRIBED Trace to the schedule", () => {
    const view = viewWith(tracesOver(door(), records()));
    render(<BbsWorkspace view={view} permitted tenantId="tenant-1" projectId="project-1" chrome={chrome()} doors={{ refusalOf }} />);
    const c2 = barRow("C2");

    const mass = c2.querySelector(`[data-column="kg"] [data-testid="${TESTIDS.evidence.link}"]`) as HTMLAnchorElement | null;
    expect(mass, "C2's mass is a Trace").not.toBeNull();
    const massHref = mass?.getAttribute("href") ?? "";
    expect(massHref, "to the viewer at the plan the members stand on").toMatch(/^\/t\/tenant-1\/p\/project-1\/viewer\/drawing-1\/S-10\?/u);
    expect(splitSelection(new URL(massHref, "http://cubit.test").searchParams.get(SELECTION_PARAM)), "selecting all three members' outlines and marks").toHaveLength(6);
    expect(mass?.getAttribute("data-basis"), "a mass is worked from the bars, so it is DERIVED").toBe("DERIVED");
    expect(mass?.getAttribute("data-member"), "and says which entry it weighs").toBe(C2_A);
    expect(mass?.textContent, "the figure as the schedule states it, to the gramme").toBe("225.491");
    expect(massHref, "no origin row: the schedule is no quantity line").not.toContain("line=");

    const markLink = c2.querySelector(`[data-column="mark"] [data-testid="${TESTIDS.evidence.link}"]`) as HTMLAnchorElement | null;
    expect(markLink?.getAttribute("href") ?? "", "the bar mark opens the schedule's sheet").toMatch(/\/viewer\/drawing-1\/S-03\?/u);
    expect(markLink?.getAttribute("data-basis"), "a bar is read off the schedule, so it is TRANSCRIBED").toBe("TRANSCRIBED");
    expect(markLink?.textContent).toBe("C2-v");

    const c9 = barRow("C9");
    expect(c9.querySelector(`[data-testid="${TESTIDS.evidence.link}"]`), "a figure the server resolved nothing for stands unlinked").toBeNull();
    expect(c9.querySelector('[data-column="kg"]')?.textContent, "and still states its mass").toBe("75.164");
  });

  it("a reading with no traces links nothing, and a denied reader is shown no schedule to follow", () => {
    render(<BbsWorkspace view={viewWith(undefined)} permitted tenantId="tenant-1" projectId="project-1" chrome={chrome()} doors={{ refusalOf }} />);
    expect(screen.getByTestId(TESTIDS.bbs.grid).querySelector(`[data-testid="${TESTIDS.evidence.link}"]`)).toBeNull();
  });
});
