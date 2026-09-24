// @vitest-environment jsdom
/**
 * I-534 — the grid states a mark once per floor, and its group row says how many members it counts
 * (docs/design/s-bbs.md §0 I-534 (d), §1, §6; the owner's ruling Q3, BS 8666).
 *
 * The workspace is mounted over a schedule the door answered through its own grouping (`scheduleOf`
 * over three members of one mark on one floor and one member elsewhere), with a DataTable stub that
 * draws every row the workspace hands it: its published attributes, and the text of every cell the
 * workspace's own columns render. So what is graded is the screen's arrangement of the door's count,
 * never a count made here. Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { REFUSALS, type RefusalEntry } from "../../../src/core/errors";
import { barRowKeyOf, type BarRow } from "../../../src/modules/takeoff/rebar/bars";
import { scheduleOf } from "../../../src/modules/takeoff/rebar/store";
import type { BbsChrome } from "../../../src/modules/takeoff/bbs-ui/workspace";
import { BbsWorkspace } from "../../../src/modules/takeoff/bbs-ui/workspace";
import type { BbsDocument, BbsView } from "../../../src/modules/takeoff/bbs-ui/view";
import { TESTIDS } from "../../../src/ui/testids";

afterEach(() => {
  cleanup();
});

/** A stub that renders its children and every data attribute it was handed. */
function passThrough(tag: keyof HTMLElementTagNameMap): ComponentType<Record<string, unknown>> {
  const Stub = (props: Record<string, unknown>): ReactNode => {
    const Tag = tag as "div";
    const attributes = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children" && key !== "content" && key !== "onClick" && key !== "onRetry"));
    return <Tag {...(attributes as Record<string, string>)}>{props["children"] as ReactNode}</Tag>;
  };
  return Stub;
}

type StubColumn = { id: string; cell: (context: { row: { original: unknown } }) => ReactNode };
type StubTable = {
  columns: StubColumn[];
  data: unknown[];
  getRowId: (row: unknown, index: number) => string;
  rowDataOf?: (row: unknown, rowId: string) => Readonly<Record<string, string>>;
};

/** The chrome the workspace declares, with a table that DRAWS what it is handed. */
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
  return {
    DataTable: DataTable as unknown as BbsChrome["DataTable"],
    EmptyState: passThrough("section") as BbsChrome["EmptyState"],
    ErrorState: passThrough("section") as BbsChrome["ErrorState"],
    RefusalState: (({ refusal }: { refusal: { code: string } }) => <div data-testid={TESTIDS.refusal.state} data-code={refusal.code} />) as BbsChrome["RefusalState"],
    IdChip: (({ value, "data-testid": testId }: { value: string; "data-testid"?: string }) => <span data-testid={testId} data-value={value} />) as BbsChrome["IdChip"],
    EnumLabel: (({ value, label }: { value: string; label?: string }) => (
      <span className="enum" data-value={value}>
        {label ?? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase().replace(/_/gu, " ")}`}
        <span data-technical="">{value}</span>
      </span>
    )) as BbsChrome["EnumLabel"],
    EvidenceLink: (({ href, label }: { href: string; label: string }) => <a href={href}>{label}</a>) as BbsChrome["EvidenceLink"],
    Skeleton: passThrough("span") as BbsChrome["Skeleton"],
    Tooltip: (({ content, children }: { content: ReactNode; children: ReactNode }) => (
      <span className="tip" data-tip={String(content)}>
        {children}
      </span>
    )) as BbsChrome["Tooltip"],
    Note: (({ label }: { label: string }) => <button aria-label={label} />) as BbsChrome["Note"],
    JobTimeline: (() => <ol />) as BbsChrome["JobTimeline"],
    Button: passThrough("button") as BbsChrome["Button"],
  };
}

/** The real registry, looked up by code. */
const refusalOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

/** One member's main bar, stored as the rail stores one: counted at one member. */
function mainBar(objectKey: string, level: string, mark: string): BarRow {
  return {
    barKey: barRowKeyOf({ objectKey, role: "MAIN", diameterMm: 20, sequence: 0 }),
    objectKey,
    class: "column",
    level,
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
    lapMm: "1000",
    lapsPerBar: 1,
    barsPerUnit: 10,
    parentCount: "1",
    bars: "10",
    kgPerMetre: "2.466",
    kgNet: "75.16368",
    kgLap: "24.66",
    kg: "99.82368",
    sourceKeys: [`S-03:${mark}#main`, `S-02:${level}#run`],
    detailingSourceKeys: ["S-01:lap"],
    editionDigest: "edition",
    semantic: `${objectKey}|MAIN`,
  };
}

/** A schedule the door answered: C2 three times on 1F with one bar set, and C1 once on GF. */
function door(): BbsDocument {
  const rows = [mainBar("k:gf-c1", "GF", "C1"), mainBar("k:1f-c2-a", "1F", "C2"), mainBar("k:1f-c2-b", "1F", "C2"), mainBar("k:1f-c2-c", "1F", "C2")];
  return {
    campaignId: "campaign-1",
    stockMm: "12000",
    roundingMm: 25,
    rows: scheduleOf(rows),
    perDiameterKg: { "20": "399.29472" },
    perMarkKg: { "C1-v": "99.82368", "C2-v": "299.47104" },
    cuttingStock: { "20": { stockBars: 12, pieces: 40, offcutMm: "22000", method: "first-fit-decreasing" } },
    grandTotalKg: "399.29472",
  };
}

const view = (): BbsView => ({ campaignId: "campaign-1", setRevisionId: "revision-1", document: door(), partial: false, omitted: [] });

/** What a node says, less its technical disclosures. */
function said(node: Element): string {
  const clone = node.cloneNode(true) as Element;
  for (const technical of Array.from(clone.querySelectorAll("[data-technical]"))) technical.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("I-534: the grid states a mark once per floor, with its number of members", () => {
  it("one group row per entry, saying the level, the class, the mark and the count, and publishing the count", () => {
    render(<BbsWorkspace view={view()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const groups = [...screen.getByTestId(TESTIDS.bbs.grid).querySelectorAll(`[data-testid="${TESTIDS.bbs.member}"]`)];
    expect(groups.map((group) => [group.getAttribute("data-member"), group.getAttribute("data-members")]), "C2's three members are ONE entry, named by its first").toEqual([
      ["k:gf-c1", "1"],
      ["k:1f-c2-a", "3"],
    ]);
    expect(groups.map((group) => said(group.querySelector('[data-column="mark"]') as Element))).toEqual(["GF · Column · C1 · 1 member", "1F · Column · C2 · 3 members"]);
    expect(screen.getByTestId(TESTIDS.bbs.screen).getAttribute("data-rows"), "the screen states the door's lines, not the members' rows").toBe("2");
  });

  it("a line counting several members states the total a site cuts, and what one member takes a hover away", () => {
    render(<BbsWorkspace view={view()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const rows = [...screen.getByTestId(TESTIDS.bbs.grid).querySelectorAll(`[data-testid="${TESTIDS.bbs.row}"]`)];
    const c2 = rows.find((row) => row.getAttribute("data-bar-mark") === "C2-v") as Element;
    expect(c2.getAttribute("data-bars"), "the attribute carries the door's total, verbatim").toBe("30");
    expect(c2.getAttribute("data-kg"), "and the entry's net mass, the members' own summed exactly").toBe("225.49104");
    const bars = c2.querySelector('[data-column="bars"]') as Element;
    expect(said(bars)).toBe("30");
    expect(bars.querySelector("[data-tip]")?.getAttribute("data-tip"), "BS 8666's No. in each, said in words").toBe("10 in each of 3 members");

    const c1 = rows.find((row) => row.getAttribute("data-bar-mark") === "C1-v") as Element;
    expect(c1.querySelector('[data-column="bars"] [data-tip]'), "a line of one member has nothing to multiply, so it says nothing more").toBeNull();
  });
});
