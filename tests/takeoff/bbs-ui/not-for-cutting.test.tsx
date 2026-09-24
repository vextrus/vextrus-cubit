// @vitest-environment jsdom
/**
 * I-567, I-568, I-569 — the bar schedule never prints a cutting plan for
 * bars nobody could cut, says what its total covers, and carries the steel no line was published for
 * (docs/design/s-bbs.md §0; walk-1's qs-critic, BLOCKS_SIGNING).
 *
 * The reading is J-000's: every column main bar a storey-height run (shape 00, no lap) because the
 * lines left their laps and ties out, and beam steel published by no line at all. Both faces are
 * graded over one door answer: the screen mounted over it, and the payload the issued schedule is
 * emitted from. Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { BBS_RUN_LABEL, BBS_STOCK_WITHHELD, BBS_STOCK_WITHHELD_NOTE, bbsPayloadSchema } from "../../../src/core/documents/kinds/bbs";
import { REFUSALS, type RefusalEntry } from "../../../src/core/errors";
import { BBS_COPY } from "../../../src/modules/takeoff/bbs-ui/copy";
import { bbsPayloadOf } from "../../../src/modules/takeoff/bbs-ui/emission";
import { cuttingStandingOf, metresOf, totalCoversOf } from "../../../src/modules/takeoff/bbs-ui/present";
import { notInScheduleOf } from "../../../src/modules/takeoff/bbs-ui/server";
import type { BbsChrome } from "../../../src/modules/takeoff/bbs-ui/workspace";
import { BbsWorkspace } from "../../../src/modules/takeoff/bbs-ui/workspace";
import type { BbsDocument, BbsView } from "../../../src/modules/takeoff/bbs-ui/view";
import { barRowKeyOf, type BarRow } from "../../../src/modules/takeoff/rebar/bars";
import { scheduleOf } from "../../../src/modules/takeoff/rebar/store";
import { TESTIDS } from "../../../src/ui/testids";

afterEach(() => {
  cleanup();
});

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
    Tooltip: (({ content, children }: { content: ReactNode; children: ReactNode }) => (
      <span data-tip={String(content)}>{children}</span>
    )) as BbsChrome["Tooltip"],
    Note: (({ label }: { label: string }) => <button aria-label={label} />) as BbsChrome["Note"],
    JobTimeline: (() => <ol />) as BbsChrome["JobTimeline"],
    Button: passThrough("button") as BbsChrome["Button"],
  };
}

const refusalOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

/** A column's main bars at its storey height, no lap — what J-000's campaign stores. */
function run(objectKey: string, level: string, mark: string, diameterMm: number): BarRow {
  return {
    barKey: barRowKeyOf({ objectKey, role: "MAIN", diameterMm, sequence: 0 }),
    objectKey,
    class: "column",
    level,
    mark,
    barMark: `${mark}-v`,
    role: "MAIN",
    diameterMm,
    shape: "00",
    dimsMm: { A: "3352.8" },
    cuttingRawMm: "3352.8",
    cuttingRoundedMm: "3375",
    cuttingIsAdditiveMm: "3352.8",
    piecesPerBar: 1,
    lapMm: "0",
    lapsPerBar: 0,
    barsPerUnit: 8,
    parentCount: "1",
    bars: "8",
    kgPerMetre: "1.578",
    kgNet: "42.3257472",
    kgLap: "0",
    kg: "42.3257472",
    sourceKeys: [`S-10:${mark}#main`],
    detailingSourceKeys: [],
    editionDigest: "edition",
    semantic: `${objectKey}|MAIN`,
  };
}

/** C1 on GF, deferred (its laps left out), in 16; C9 on GF, whose laps a later reading stated, in 20. */
function door(): BbsDocument {
  const rows = [run("k:gf-c1", "GF", "C1", 16), run("k:gf-c9", "GF", "C9", 20)];
  return {
    campaignId: "campaign-1",
    stockMm: "12000",
    roundingMm: 25,
    rows: scheduleOf(rows),
    perDiameterKg: { "16": "42.3257472", "20": "66.13" },
    perMarkKg: { "C1-v": "42.3257472", "C9-v": "66.13" },
    cuttingStock: {
      "16": { stockBars: 164, pieces: 516, offcutMm: "444600", method: "first-fit-decreasing" },
      "20": { stockBars: 3, pieces: 8, offcutMm: "9177.6", method: "first-fit-decreasing" },
    },
    grandTotalKg: "108.4557472",
  };
}

const OMITTED = [{ code: "NOTE_READING_CONTESTED", components: ["lap"] }, { code: "REBAR_TIE_ZONE_UNSTATED", components: ["ties"] }];
const BEAMS = { about: "Beam · Rebar", levels: "GF–6F", why: REFUSALS.NOT_ESTABLISHED.message };

const view = (): BbsView => ({
  campaignId: "campaign-1",
  setRevisionId: "revision-1",
  document: door(),
  partial: true,
  omitted: OMITTED,
  deferred: ["k:gf-c1"],
  notInSchedule: [BEAMS],
});

describe("I-567: which bars are runs, and whose cutting stock is withheld", () => {
  it("a deferred member's running bars are runs and their diameter is withheld; a stated member's are not", () => {
    const standing = cuttingStandingOf(door(), ["k:gf-c1"]);
    expect([...standing.runs], "C1's entry holds runs").toEqual(["k:gf-c1"]);
    expect(standing.withheld, "16 mm is withheld and 20 mm is not").toEqual([16]);
    expect(cuttingStandingOf(door(), []).withheld, "nothing deferred, nothing withheld").toEqual([]);
  });

  it("a link is not a run: a deferred member's ties keep their diameter's stock", () => {
    const tie: BarRow = { ...run("k:gf-c1", "GF", "C1", 10), barKey: barRowKeyOf({ objectKey: "k:gf-c1", role: "TIE", diameterMm: 10, sequence: 0 }), role: "TIE", barMark: "C1-t", shape: "51" };
    const document_ = { ...door(), rows: scheduleOf([run("k:gf-c1", "GF", "C1", 16), tie]) };
    expect(cuttingStandingOf(document_, ["k:gf-c1"]).withheld, "the ties' 10 mm is a length the section states").toEqual([16]);
  });

  it("the total says what it covers, from the classes, the links and the components left out", () => {
    expect(totalCoversOf(door(), { partial: true, omitted: OMITTED, notInSchedule: 1 }), "J-000's words").toBe("Column main bars only — laps and ties not counted");
    expect(totalCoversOf(door(), { partial: false, omitted: [], notInSchedule: 1 }), "whole, but not the building's steel").toBe("Column main bars only");
    expect(totalCoversOf(door(), { partial: false, omitted: [], notInSchedule: 0 }), "the whole of the steel needs no cover").toBe("");
  });

  it("an offcut is read in metres, the canon's conversion stated to the millimetre", () => {
    expect(metresOf("444600")).toBe("444.600");
    expect(metresOf("9177.6")).toBe("9.178");
  });
});

describe("I-567 · b · c: the issued schedule's payload", () => {
  const meta = {
    title: "Bar bending schedule",
    project: "Bashundhara G+6",
    particulars: { code: null, client: null, site: null, drawingSet: "Structural", revision: 1, pinnedOn: { year: 2026, month: 9, day: 22 }, issuedOn: { year: 2026, month: 9, day: 24 } },
    partial: true,
    omitted: OMITTED,
    deferred: ["k:gf-c1"],
    notInSchedule: [BEAMS],
  };

  it("withholds the packing of a run's diameter, marks the entry, says what the total covers, and parses", () => {
    const payload = bbsPayloadOf(door(), meta);
    expect(Object.keys(payload.cuttingStock), "no packing of 16 mm crosses to the page").toEqual(["20"]);
    expect(payload.stockWithheld, "16 mm is named as withheld").toEqual([16]);
    expect(payload.cuttingStock["20"]?.offcutM, "the offcut crosses in metres").toBe("9.178");
    expect(payload.schedule.map((entry) => [entry.mark, entry.notForCutting])).toEqual([
      ["C1", true],
      ["C9", false],
    ]);
    expect(payload.totalCovers).toBe("Column main bars only — laps and ties not counted");
    expect(payload.notInSchedule, "the beam steel, in the draft's words").toEqual([BEAMS]);
    expect(bbsPayloadSchema.safeParse(payload).success, "the kind's strict schema reads it").toBe(true);
  });

  it("a reading that deferred nothing withholds nothing", () => {
    const payload = bbsPayloadOf(door(), { ...meta, deferred: [] });
    expect(payload.stockWithheld).toEqual([]);
    expect(Object.keys(payload.cuttingStock)).toEqual(["16", "20"]);
  });
});

describe("I-569: the steel no line was published for is the measurement statement's rebar, in the draft's words", () => {
  it("keeps the rcc.rebar rows and says them as the draft's closing block does", () => {
    const rows = notInScheduleOf([
      { class: "beam", kind: "rcc.rebar", levels: "GF–6F", cause: "NOT_ESTABLISHED" },
      { class: "slab", kind: "rcc.concrete", levels: "GF–6F", cause: "NOT_ESTABLISHED" },
      { class: "pile", kind: "rcc.rebar", levels: "", cause: "NOT_ESTABLISHED", reason: "NO_BEARER_SIGHTED" },
    ]);
    expect(rows).toEqual([BEAMS, { about: "Pile · Rebar", levels: "", why: REFUSALS.NO_BEARER_SIGHTED.message }]);
  });
});

describe("I-567 · c: the screen", () => {
  it("labels the run entry, withholds its diameter's stock in words, names it beneath, and says what the total covers", () => {
    render(<BbsWorkspace view={view()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const groups = [...screen.getByTestId(TESTIDS.bbs.grid).querySelectorAll(`[data-testid="${TESTIDS.bbs.member}"]`)];
    expect(groups.map((group) => [group.getAttribute("data-mark"), group.getAttribute("data-not-for-cutting")])).toEqual([
      ["C1", "true"],
      ["C9", null],
    ]);
    expect(groups[0]?.textContent, "the run entry says so in words").toContain(BBS_COPY.bbs_run_label);
    expect(groups[1]?.textContent, "a stated entry does not").not.toContain(BBS_COPY.bbs_run_label);

    const summary = screen.getByTestId(TESTIDS.bbs.summary);
    const lines = [...summary.querySelectorAll(`[data-testid="${TESTIDS.bbs.summaryRow}"]`)];
    const sixteen = lines.find((line) => line.getAttribute("data-diameter") === "16") as Element;
    const twenty = lines.find((line) => line.getAttribute("data-diameter") === "20") as Element;
    expect(sixteen.getAttribute("data-withheld"), "16 mm is withheld").toBe("true");
    expect(sixteen.textContent, "and says why, instead of 164 stock bars").toContain(BBS_COPY.bbs_stock_withheld);
    expect([...sixteen.querySelectorAll('[role="cell"]')].map((cell) => cell.textContent), "no packing figure stands on it: diameter, mass, and the words").toEqual([
      "16",
      "42.326",
      BBS_COPY.bbs_stock_withheld,
    ]);
    expect(twenty.getAttribute("data-withheld"), "20 mm is not").toBeNull();
    expect(twenty.textContent, "its offcut reads in metres").toContain("9.178");
    expect(summary.textContent, "the sentence beneath names the withheld diameter").toContain("Cutting stock is not computed for 16 mm");
    expect(summary.textContent, "the total says what it covers").toContain("Column main bars only — laps and ties not counted");
  });

  it("lists the steel no line was published for", () => {
    render(<BbsWorkspace view={view()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    expect(document.body.textContent, "under its own heading").toContain(BBS_COPY.bbs_not_in_schedule);
    expect(document.body.textContent, "with what, over which levels, and why").toContain(BEAMS.why);
  });
});

describe("the page's sentences are the screen's (B-17)", () => {
  it("the kind's mirrored words equal the copy table's", () => {
    expect(BBS_RUN_LABEL).toBe(BBS_COPY.bbs_run_label);
    expect(BBS_STOCK_WITHHELD).toBe(BBS_COPY.bbs_stock_withheld);
    expect(BBS_STOCK_WITHHELD_NOTE).toBe(BBS_COPY.bbs_stock_withheld_note);
  });
});
