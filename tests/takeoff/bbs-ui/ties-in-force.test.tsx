// @vitest-environment jsdom
/**
 * I-671, I-672 — the bar schedule says what it holds now the ties are in force, and
 * gives the grid the page (docs/design/s-bbs.md §0; walk-2 BD-4).
 *
 * Under synthesis@2 most columns carry their ties and a few do not: a joint whose depth nobody read
 * (the foundation necks, C6) and a round column whose hoop shape the roster does not hold (C7). The
 * total said "Column bars only — ties not counted" over a schedule that listed ties; it now says
 * `bars and ties`, and which members' ties are left out and why. The twelve lines of disclosure
 * above the grid fold behind one line, and the cutting stock folds beneath the total.
 *
 * Every expectation is derived from the fixture below (B-19). Nothing here opens a database and
 * nothing here measures time (AM-10 §3).
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { bbsPayloadSchema } from "../../../src/core/documents/kinds/bbs";
import { REFUSALS, type RefusalEntry } from "../../../src/core/errors";
import { BBS_COPY } from "../../../src/modules/takeoff/bbs-ui/copy";
import { bbsPayloadOf } from "../../../src/modules/takeoff/bbs-ui/emission";
import { entryCoverageOf, totalCoversOf, type BbsLineStanding } from "../../../src/modules/takeoff/bbs-ui/present";
import type { BbsDocument, BbsOmission, BbsView } from "../../../src/modules/takeoff/bbs-ui/view";
import type { BbsChrome } from "../../../src/modules/takeoff/bbs-ui/workspace";
import { BbsWorkspace } from "../../../src/modules/takeoff/bbs-ui/workspace";
import { barRowKeyOf, type BarRow } from "../../../src/modules/takeoff/rebar/bars";
import { scheduleOf } from "../../../src/modules/takeoff/rebar/store";
import { TESTIDS } from "../../../src/ui/testids";

afterEach(() => {
  cleanup();
});

/** A column's main bars, lapped, as synthesis@2 writes them. */
function main(objectKey: string, level: string, mark: string): BarRow {
  return {
    barKey: barRowKeyOf({ objectKey, role: "MAIN", diameterMm: 16, sequence: 0 }),
    objectKey,
    class: "column",
    level,
    mark,
    barMark: `${mark}-v`,
    role: "MAIN",
    diameterMm: 16,
    shape: "00",
    dimsMm: { A: "3352.8" },
    cuttingRawMm: "3352.8",
    cuttingRoundedMm: "3375",
    cuttingIsAdditiveMm: "3352.8",
    piecesPerBar: 1,
    lapMm: "800",
    lapsPerBar: 1,
    barsPerUnit: 8,
    parentCount: "1",
    bars: "8",
    kgPerMetre: "1.578",
    kgNet: "42.3257472",
    kgLap: "10.0992",
    kg: "52.4249472",
    sourceKeys: [`S-10:${mark}#main`],
    detailingSourceKeys: [],
    editionDigest: "edition",
    semantic: `${objectKey}|MAIN`,
  };
}

/** The member's ties, counted at its joint's bound (I-656). */
function ties(objectKey: string, level: string, mark: string): BarRow {
  return {
    ...main(objectKey, level, mark),
    barKey: barRowKeyOf({ objectKey, role: "TIE", diameterMm: 10, sequence: 0 }),
    barMark: `${mark}-t`,
    role: "TIE",
    diameterMm: 10,
    shape: "51",
    lapMm: "0",
    lapsPerBar: 0,
    barsPerUnit: 29,
    bars: "29",
    kgPerMetre: "0.617",
    kgNet: "25.1",
    kgLap: "0",
    kg: "25.1",
    semantic: `${objectKey}|TIE`,
  };
}

const JOINT_UNREAD = "REBAR_TIE_JOINT_UNREAD";
const SHAPE_NOT_HELD = "BAR_SHAPE_NOT_HELD";
const C6_LEVELS = ["GF", "1F", "2F", "3F"];

/**
 * The J-000 shape under synthesis@2, small: two GF C1s whose ties are counted (one entry of two),
 * the foundation necks C1 and C2 whose joints are unread, C6 unread on four floors, and a round C7
 * on GF whose hoops are a shape the roster does not hold.
 */
function billOf(): BarRow[] {
  return [
    main("k:fdn-c1", "FDN", "C1"),
    main("k:fdn-c2", "FDN", "C2"),
    main("k:gf-c1a", "GF", "C1"),
    ties("k:gf-c1a", "GF", "C1"),
    main("k:gf-c1b", "GF", "C1"),
    ties("k:gf-c1b", "GF", "C1"),
    ...C6_LEVELS.map((level) => main(`k:${level}-c6`, level, "C6")),
    main("k:gf-c7", "GF", "C7"),
  ];
}

/** Each member's published line: whole where its ties are counted, and why not where they are not. */
function linesOf(): BbsLineStanding[] {
  const partly = (objectKey: string, code: string, extra: readonly string[] = []): BbsLineStanding => ({
    objectKey,
    coverage: "PARTIAL_DECLARED",
    omitted: [...extra.map((variable) => ({ code: "NOTE_READING_CONTESTED", variable })), { code, variable: "ties" }],
  });
  return [
    partly("k:fdn-c1", JOINT_UNREAD),
    partly("k:fdn-c2", JOINT_UNREAD),
    { objectKey: "k:gf-c1a", coverage: "COMPLETE", omitted: [] },
    { objectKey: "k:gf-c1b", coverage: "COMPLETE", omitted: [] },
    ...C6_LEVELS.map((level) => partly(`k:${level}-c6`, JOINT_UNREAD)),
    partly("k:gf-c7", SHAPE_NOT_HELD),
  ];
}

const OMITTED: readonly BbsOmission[] = [
  { code: JOINT_UNREAD, components: ["ties"] },
  { code: SHAPE_NOT_HELD, components: ["ties"] },
];

function door(rows: readonly BarRow[] = billOf()): BbsDocument {
  return {
    campaignId: "campaign-1",
    stockMm: "12000",
    roundingMm: 25,
    rows: scheduleOf(rows),
    perDiameterKg: { "10": "50.2", "16": "471.8245248" },
    perMarkKg: { "C1-v": "157.2748416", "C1-t": "50.2", "C2-v": "52.4249472", "C6-v": "209.6997888", "C7-v": "52.4249472" },
    cuttingStock: {
      "10": { stockBars: 5, pieces: 58, offcutMm: "1200", method: "first-fit-decreasing" },
      "16": { stockBars: 30, pieces: 72, offcutMm: "4800", method: "first-fit-decreasing" },
    },
    grandTotalKg: "522.0245248",
    declared: [],
    declaredKg: "0",
  };
}

const TIES_LEFT_OUT = "ties of 7 members not counted: joint depth unread (C1, C2 at FDN; C6 at 4 levels) · shape not held (C7 at GF)";

describe("I-671: the total says what the schedule holds, and which members' ties it leaves out and why", () => {
  it("ties in the schedule are said as bars and ties, and the members whose ties are left out are counted and named by reason", () => {
    const document_ = door();
    const entries = entryCoverageOf(document_, linesOf());
    expect(totalCoversOf(document_, { partial: true, omitted: OMITTED, notInSchedule: 1, entries })).toBe(`Column bars and ties only — ${TIES_LEFT_OUT}`);
  });

  it("a component every entry leaves out is said once, before the ones only some leave out", () => {
    const document_ = door();
    const lines = linesOf().map((line) => ({ ...line, coverage: "PARTIAL_DECLARED", omitted: [{ code: "NOTE_READING_CONTESTED", variable: "lap" }, ...line.omitted] }));
    const omitted = [{ code: "NOTE_READING_CONTESTED", components: ["lap"] }, ...OMITTED];
    expect(totalCoversOf(document_, { partial: true, omitted, notInSchedule: 0, entries: entryCoverageOf(document_, lines) })).toBe(
      `Column bars and ties only — laps not counted; ${TIES_LEFT_OUT}`,
    );
  });

  it("a schedule with no tie in it says main bars, and ties left out by every entry are said once", () => {
    const rows = billOf().filter((row) => row.role !== "TIE");
    const document_ = door(rows);
    const lines = linesOf().map((line) => (line.coverage === "COMPLETE" ? { ...line, coverage: "PARTIAL_DECLARED", omitted: [{ code: JOINT_UNREAD, variable: "ties" }] } : line));
    expect(totalCoversOf(document_, { partial: true, omitted: OMITTED, notInSchedule: 0, entries: entryCoverageOf(document_, lines) })).toBe(
      "Column main bars only — ties not counted",
    );
  });

  it("with no entry standing read, the total says the components alone, as it always did", () => {
    expect(totalCoversOf(door(), { partial: true, omitted: OMITTED, notInSchedule: 0 })).toBe("Column bars and ties only — ties not counted");
  });

  it("the issued schedule's total is the screen's, word for word, and the kind's schema reads it", () => {
    const document_ = door();
    const entries = entryCoverageOf(document_, linesOf());
    const payload = bbsPayloadOf(document_, {
      title: "Bar bending schedule",
      project: "Bashundhara G+6",
      particulars: { code: null, client: null, site: null, drawingSet: "Structural", revision: 1, pinnedOn: { year: 2026, month: 9, day: 22 }, issuedOn: { year: 2026, month: 9, day: 24 } },
      partial: true,
      omitted: OMITTED,
      entries,
    });
    expect(payload.totalCovers).toBe(`Column bars and ties only — ${TIES_LEFT_OUT}`);
    expect(bbsPayloadSchema.safeParse(payload).success).toBe(true);
  });
});

/* ------------------------------------------------------------------------------------ the screen */

function passThrough(tag: keyof HTMLElementTagNameMap): ComponentType<Record<string, unknown>> {
  const Stub = (props: Record<string, unknown>): ReactNode => {
    const Tag = tag as "div";
    const attributes = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children" && key !== "content" && key !== "onClick" && key !== "onRetry"));
    return <Tag {...(attributes as Record<string, string>)}>{props["children"] as ReactNode}</Tag>;
  };
  return Stub;
}

type StubColumn = { id: string; cell: (context: { row: { original: unknown } }) => ReactNode };
type StubTable = { columns: StubColumn[]; data: unknown[]; getRowId: (row: unknown, index: number) => string; rowDataOf?: (row: unknown, rowId: string) => Readonly<Record<string, string>> };

function chrome(): BbsChrome {
  const DataTable = ({ columns, data, getRowId, rowDataOf }: StubTable): ReactNode => (
    <div data-testid={TESTIDS.datatable.root}>
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
  return {
    DataTable: DataTable as unknown as BbsChrome["DataTable"],
    EmptyState: passThrough("section") as BbsChrome["EmptyState"],
    ErrorState: passThrough("section") as BbsChrome["ErrorState"],
    RefusalState: (({ refusal }: { refusal: { code: string } }) => <div data-code={refusal.code} />) as BbsChrome["RefusalState"],
    IdChip: (({ value, "data-testid": testId }: { value: string; "data-testid"?: string }) => <span data-testid={testId} data-value={value} />) as BbsChrome["IdChip"],
    EnumLabel: (({ value, label }: { value: string; label?: string }) => <span data-value={value}>{label ?? value}</span>) as BbsChrome["EnumLabel"],
    Skeleton: passThrough("span") as BbsChrome["Skeleton"],
    Tooltip: (({ content, children }: { content: ReactNode; children: ReactNode }) => <span data-tip={String(content)}>{children}</span>) as BbsChrome["Tooltip"],
    Note: (({ label }: { label: string }) => <button aria-label={label} />) as BbsChrome["Note"],
    JobTimeline: (() => <ol />) as BbsChrome["JobTimeline"],
    Button: passThrough("button") as BbsChrome["Button"],
  };
}

const refusalOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];
const BEAMS = { about: "Beam · Rebar", levels: "GF–6F", why: REFUSALS.NOT_ESTABLISHED.message };

function view(): BbsView {
  const document_ = door();
  return {
    campaignId: "campaign-1",
    setRevisionId: "revision-1",
    document: document_,
    partial: true,
    omitted: OMITTED,
    entries: entryCoverageOf(document_, linesOf()),
    deferred: [],
    notInSchedule: [BEAMS],
  };
}

const said = (node: Element | null | undefined): string => (node?.textContent ?? "").replace(/\s+/gu, " ").trim();

describe("I-672: the disclosures fold behind one line, and the grid has the page", () => {
  it("the helper line opens the list of what the schedule leaves out, closed until a reader opens it", () => {
    render(<BbsWorkspace view={view()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const answer = screen.getByTestId(TESTIDS.bbs.answer);
    const folds = answer.querySelectorAll("details");
    expect(folds.length, "one fold in the answer slot").toBe(1);
    const fold = folds[0] as HTMLDetailsElement;
    expect(fold.open, "closed at rest, so the grid starts right under one line").toBe(false);
    const line = said(fold.querySelector("summary"));
    expect(line, "the line leads with the helper sentence").toContain(BBS_COPY.bbs_partial);
    // Two registered codes the lines left out, and the beam steel no line was published for.
    expect(line, "and says how many things the list holds").toContain("3 items not in this schedule");
    const body = said(fold.querySelector(".cx-bbs-disclosure-body"));
    expect(body, "the list holds what the lines left out, in the register's words").toContain(REFUSALS[JOINT_UNREAD].message);
    expect(body, "and the steel no line was published for").toContain(BEAMS.why);
    expect([...answer.querySelectorAll(".cx-bbs-omitted")].every((block) => fold.contains(block)), "no list stands outside the fold").toBe(true);
  });

  it("a schedule that leaves nothing out says its helper line alone, with no fold", () => {
    const whole: BbsView = { ...view(), partial: false, omitted: [], notInSchedule: [] };
    render(<BbsWorkspace view={whole} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const answer = screen.getByTestId(TESTIDS.bbs.answer);
    expect(answer.querySelector("details"), "nothing to open").toBeNull();
    expect(said(answer)).toBe(BBS_COPY.bbs_complete);
  });

  it("the total stands open beneath the grid with its words, and the cutting stock folds beneath it", () => {
    render(<BbsWorkspace view={view()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const summary = screen.getByTestId(TESTIDS.bbs.summary);
    const total = summary.querySelector(".cx-bbs-summary-total");
    expect(total?.closest("details"), "the total is never folded away").toBeNull();
    expect(said(total), "it says what it covers").toContain(TIES_LEFT_OUT);
    const fold = summary.querySelector("details.cx-bbs-stock-fold") as HTMLDetailsElement | null;
    expect(fold?.open, "the cutting stock is folded at rest").toBe(false);
    expect(said(fold?.querySelector("summary")), "under its own heading").toBe(BBS_COPY.bbs_summary_heading);
    const lines = [...summary.querySelectorAll(`[data-testid="${TESTIDS.bbs.summaryRow}"]`)];
    expect(lines.map((one) => one.getAttribute("data-diameter")), "every diameter's line stays in the DOM, one press away").toEqual(["10", "16"]);
    expect(lines.every((one) => fold?.contains(one)), "all of them inside the fold").toBe(true);
  });
});
