// @vitest-environment jsdom
/**
 * BOQ-SHAPE — S-BOQ reads like a Dhaka bill (the owner's ruling, s-boq I-528, I-529,
 * I-532): a row per ITEM — one description at one level band, its figure the members' register
 * sum rounded once — a trade heading per group that states no figure, a closing section that says
 * what the draft does not measure, and an empty state that leads where the reader actually is.
 *
 * The mount is the SHIPPED workspace over a draft the product's own emission composes, with chrome
 * stubs that publish what they were handed (I-170). Nothing here opens a database and nothing here
 * measures time (AM-10 §3).
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { REFUSALS, type RefusalEntry } from "../../../src/core/errors";
import { boqDraftPayloadOf, type BoqReadingLine } from "../../../src/modules/takeoff/boq/emission";
import { numberItems } from "../../../src/modules/takeoff/boq/numbering";
import { BILL_TAXONOMY } from "../../../src/modules/takeoff/boq/taxonomy";
import type { BoqView } from "../../../src/modules/takeoff/boq/view";
import { BoqWorkspace, type BoqChrome } from "../../../src/modules/takeoff/boq/workspace";
import { TESTIDS } from "../../../src/ui/testids";

afterEach(() => {
  cleanup();
});

const LEVELS = [
  { levelId: "l-gf", ordinal: 0, label: "GF" },
  { levelId: "l-1f", ordinal: 1, label: "1F" },
];

function line(overrides: Partial<BoqReadingLine> & Pick<BoqReadingLine, "lineId" | "objectKey">): BoqReadingLine {
  return { class: "column", kind: "rcc.concrete", levelId: "l-gf", value: "0.4572", unit: "m3", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: "COMPLETE", ...overrides };
}

/** Three GF columns and two 1F columns — two items — and a slab the campaign never measured. */
function aView(): BoqView {
  const payload = boqDraftPayloadOf({
    project: "Bashundhara G+6",
    campaignId: "campaign-1",
    setRevisionId: "revision-1",
    levels: LEVELS,
    coverageComplete: false,
    notMeasured: [{ class: "slab", kind: "rcc.concrete", levels: "GF–6F", cause: "NOT_ESTABLISHED" }],
    lines: [
      line({ lineId: "a", objectKey: "C1@GF" }),
      line({ lineId: "b", objectKey: "C2@GF" }),
      line({ lineId: "c", objectKey: "C3@GF", value: "0.36576" }),
      line({ lineId: "d", objectKey: "C1@1F", levelId: "l-1f", value: "0.32004" }),
      line({ lineId: "e", objectKey: "C2@1F", levelId: "l-1f", value: null, coverage: "PARTIAL_DECLARED", omitted: ["STOREY_HEIGHT_UNSTATED"] }),
    ],
  });
  return { campaignId: "campaign-1", setRevisionId: "revision-1", taxonomyVersion: payload.taxonomyVersion, coverage: "INCOMPLETE", payload, items: numberItems(payload.sections) };
}

/** What the grid stub was handed, so a case can ask what the group row would sum. */
const handed: { group?: { valueOf?: (row: never) => string | null }; rows: unknown[] } = { rows: [] };

function passThrough(tag: keyof HTMLElementTagNameMap): ComponentType<Record<string, unknown>> {
  const Stub = (props: Record<string, unknown>): ReactNode => {
    const Tag = tag as "div";
    const attributes = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children" && key !== "content" && key !== "onClick" && key !== "onRetry"));
    return <Tag {...(attributes as Record<string, string>)}>{props["children"] as ReactNode}</Tag>;
  };
  return Stub;
}

function chrome(): BoqChrome {
  const DataTable = ({
    columns,
    data,
    rowDataOf,
    rowTestId,
    group,
  }: {
    columns: { id: string; cell: (context: { row: { original: unknown } }) => ReactNode }[];
    data: unknown[];
    rowDataOf?: (row: unknown, rowId: string) => Record<string, string>;
    rowTestId?: string;
    group?: { valueOf?: (row: never) => string | null };
  }) => {
    handed.group = group;
    handed.rows.push(...data);
    return (
      <table>
        <tbody>
          {data.map((row, at) => (
            <tr key={at} data-testid={rowTestId} {...(rowDataOf?.(row, String(at)) ?? {})}>
              {columns.map((column) => (
                <td key={column.id} data-column={column.id}>
                  {column.cell({ row: { original: row } })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
  return {
    DataTable: DataTable as unknown as BoqChrome["DataTable"],
    EmptyState: passThrough("section") as BoqChrome["EmptyState"],
    ErrorState: passThrough("section") as BoqChrome["ErrorState"],
    RefusalState: (({ refusal }: { refusal: { code: string } }) => <div data-code={refusal.code} />) as BoqChrome["RefusalState"],
    IdChip: (({ value, className, "data-testid": testId }: { value: string; className?: string; "data-testid"?: string }) => (
      <span className={className} data-testid={testId} data-value={value}>
        {value}
      </span>
    )) as BoqChrome["IdChip"],
    EnumLabel: (({ value, label, className }: { value: string; label?: string; className?: string }) => (
      <span className={className} data-value={value}>
        {label ?? value}
      </span>
    )) as BoqChrome["EnumLabel"],
    BasisChip: (() => <span />) as BoqChrome["BasisChip"],
    CoverageChip: (() => <span />) as BoqChrome["CoverageChip"],
    UnitBadge: (({ unit }: { unit: string }) => <span>{unit}</span>) as BoqChrome["UnitBadge"],
    Skeleton: passThrough("span") as BoqChrome["Skeleton"],
    JobTimeline: (() => <ol />) as BoqChrome["JobTimeline"],
    Tooltip: (({ children }: { children: ReactNode }) => <>{children}</>) as BoqChrome["Tooltip"],
    Button: passThrough("button") as BoqChrome["Button"],
  };
}

const refusalOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry>>)[code];

describe("I-528: a row is an item — one description at one band — never a member line", () => {
  it("five member lines on two storeys stand as two numbered items, each carrying its figure rounded once", () => {
    const { container } = render(<BoqWorkspace view={aView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const rows = [...container.querySelectorAll(`[data-testid="${TESTIDS.boq.line}"]`)];
    expect(rows.length, "one row per item, not per member line").toBe(2);
    expect(rows.map((row) => [row.getAttribute("data-item"), row.getAttribute("data-level"), row.getAttribute("data-members"), row.getAttribute("data-quantity")]), "GF then 1F, each its members' sum").toEqual([
      ["2.1.1", "GF", "3", "1.280"],
      ["2.1.2", "1F", "2", "0.320"],
    ]);
    for (const row of rows) expect(row.hasAttribute("data-line"), "an item is many lines and names none of them").toBe(false);
  });

  it("a partly measured item says how much its figure covers, in its description cell", () => {
    const { container } = render(<BoqWorkspace view={aView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const upper = container.querySelector(`[data-item="2.1.2"] td[data-column="description"]`);
    expect(upper?.querySelector(".cx-boq-qualifier")?.textContent, "1 of 2 measured, and why, in words").toBe("(1 of 2 measured; 1 not measured — storey height unstated)");
    const whole = container.querySelector(`[data-item="2.1.1"] td[data-column="description"]`);
    expect(whole?.querySelector(".cx-boq-qualifier"), "a whole item carries no qualification").toBeNull();
  });
});

describe("I-571: the coverage cell says `Not measured` where no member states a figure", () => {
  it("an item measured in part reads Partly declared; an item measured not at all reads Not measured", () => {
    const view = aView();
    const payload = boqDraftPayloadOf({
      project: "Bashundhara G+6",
      campaignId: "campaign-1",
      setRevisionId: "revision-1",
      levels: LEVELS,
      coverageComplete: false,
      lines: [
        line({ lineId: "d", objectKey: "C1@1F", levelId: "l-1f", value: "0.32004" }),
        line({ lineId: "e", objectKey: "C2@1F", levelId: "l-1f", value: null, coverage: "PARTIAL_DECLARED", omitted: ["STOREY_HEIGHT_UNSTATED"] }),
        line({ lineId: "r1", objectKey: "C1@GF", kind: "rcc.rebar", unit: "kg", value: null, coverage: "PARTIAL_DECLARED", omitted: ["REBAR_TIE_ZONE_UNSTATED"] }),
        line({ lineId: "r2", objectKey: "C2@GF", kind: "rcc.rebar", unit: "kg", value: null, coverage: "PARTIAL_DECLARED", omitted: ["REBAR_TIE_ZONE_UNSTATED"] }),
      ],
    });
    const mixed = { ...view, payload, items: numberItems(payload.sections) };
    const { container } = render(<BoqWorkspace view={mixed} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const coverageOf = (kind: string): (string | null)[] =>
      [...container.querySelectorAll(`[data-testid="${TESTIDS.boq.line}"][data-kind="${kind}"] td[data-column="coverage"]`)].map((cell) => cell.textContent);
    expect(coverageOf("rcc.concrete"), "one of two members measured: partly declared").toEqual(["Partly declared"]);
    expect(coverageOf("rcc.rebar"), "none of two members measured: not measured, never partly declared").toEqual(["Not measured"]);
  });
});

describe("I-529: the group row names the trade and states no figure", () => {
  it("the grid is handed a grouping that sums nothing, and the screen draws no section foot", () => {
    handed.rows = [];
    const { container } = render(<BoqWorkspace view={aView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const valueOf = handed.group?.valueOf;
    expect(typeof valueOf, "the grouping states what a row adds to its group's sum").toBe("function");
    for (const row of handed.rows) expect(valueOf?.(row as never), "and no row adds anything: no quantity subtotal crosses descriptions").toBeNull();
    expect(container.querySelectorAll(`[data-testid="${TESTIDS.boq.subtotal}"]`).length, "no measured-scope foot adds unlike items").toBe(0);
  });
});

describe("I-532: the screen closes on what the draft does not measure", () => {
  it("each statement row says what, over which levels, and why in the registry's own sentence", () => {
    render(<BoqWorkspace view={aView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const closing = screen.getByTestId(TESTIDS.boq.notMeasured);
    expect(closing.querySelector("h2")?.textContent, "under the words the document closes with").toBe("Not measured in this draft");
    const rows = [...closing.querySelectorAll("li")].map((row) => [...row.children].map((part) => part.textContent));
    expect(rows, "the slab the campaign never measured").toEqual([["Slab · Concrete", "GF–6F", REFUSALS.NOT_ESTABLISHED.message]]);
  });

  it("a draft that left nothing out carries no closing section", () => {
    const view = aView();
    const whole = { ...view, payload: { ...(view.payload as NonNullable<BoqView["payload"]>), notMeasured: [] } };
    render(<BoqWorkspace view={whole} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    expect(screen.queryByTestId(TESTIDS.boq.notMeasured), "a heading over nothing would be a claim with no content").toBeNull();
  });
});

describe("the empty state leads where the reader is (walk-0, MEASURE-REFUSE)", () => {
  const empty = (campaignId: string | null): BoqView => ({ campaignId, setRevisionId: campaignId === null ? null : "revision-1", taxonomyVersion: BILL_TAXONOMY.version, coverage: "INCOMPLETE", payload: null, items: new Map() });

  it("no campaign pinned: the chain starts at the drawing sets", () => {
    render(<BoqWorkspace view={empty(null)} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const state = screen.getByTestId(TESTIDS.boq.empty);
    expect(state.getAttribute("heading")).toBe("Nothing published yet");
    expect(state.querySelector("a")?.getAttribute("href"), "one action, to the drawing sets").toBe("/t/t/p/p/drawings/sets");
  });

  it("a pinned campaign that published nothing: the register, where Measure says what it deferred and why", () => {
    render(<BoqWorkspace view={empty("campaign-1")} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const state = screen.getByTestId(TESTIDS.boq.empty);
    expect(state.getAttribute("heading"), "the heading says nothing was measured, not that nothing was pinned").toBe("Nothing measured yet");
    expect(state.getAttribute("body"), "and the body names the reasons a run defers under").toContain("a sheet with no scale of record, a storey with no height");
    const actions = state.querySelectorAll("a");
    expect(actions.length, "exactly one thing to do (R-UI-050)").toBe(1);
    expect(actions[0]?.getAttribute("href"), "and it leads to the register's deferrals, never back to a set already pinned").toBe("/t/t/p/p/takeoff/register");
  });
});
