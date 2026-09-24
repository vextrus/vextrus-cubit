// @vitest-environment jsdom
/**
 * I-354 (b)(c) — a partly declared schedule says WHAT it leaves out, why, and where that is settled;
 * and the stock readout sets only its figures in the figure face (docs/design/s-bbs.md §0 I-354,
 * I-bbs-9(d); R-UI-020, R-UI-082, R-UI-085).
 *
 * The vision re-look read the `Left out of this schedule:` list as two bare registry sentences: the
 * first ("Two readings of this note disagree…") is why no lap row stands anywhere on the schedule
 * and never said "laps", and neither said where a reader acts. Each line now leads with the line's
 * own COMPONENTS in words (`EnumLabel`), then the registry's message verbatim, then a link to the
 * screen where the omission is settled with the registry's remedy as its tooltip.
 *
 * The registry entries are the REAL registry's (`REFUSALS`), so a message edited there is the message
 * graded here; the chrome is stubs that publish what they were handed (I-170). Nothing here opens a
 * database and nothing here measures time (AM-10 §3).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { REFUSALS, type RefusalEntry } from "../../../src/core/errors";
import type { BbsChrome } from "../../../src/modules/takeoff/bbs-ui/workspace";
import { BbsWorkspace } from "../../../src/modules/takeoff/bbs-ui/workspace";
import type { BbsDocument, BbsView } from "../../../src/modules/takeoff/bbs-ui/view";
import { TESTIDS } from "../../../src/ui/testids";
import { declaredValue } from "../../support/stylesheet";
import { goldenBbsDocument } from "./support/golden-document";

afterEach(() => {
  cleanup();
});

// jsdom answers `import.meta.url` as a page address, not a file: the lane runs from the repo root.
const SHEET = readFileSync(join(process.cwd(), "src/app/(app)/t/[tenant]/p/[project]/takeoff/bbs/bbs.css"), "utf8");

/** A stub that renders its children and every data attribute it was handed. */
function passThrough(tag: keyof HTMLElementTagNameMap): ComponentType<Record<string, unknown>> {
  const Stub = (props: Record<string, unknown>): ReactNode => {
    const Tag = tag as "div";
    const attributes = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children" && key !== "content" && key !== "onClick" && key !== "onRetry"));
    return <Tag {...(attributes as Record<string, string>)}>{props["children"] as ReactNode}</Tag>;
  };
  return Stub;
}

/** The chrome the workspace declares; EnumLabel says its words and keeps the raw value technical. */
function chrome(): BbsChrome {
  return {
    DataTable: (({ data }: { data: unknown[] }) => <div data-testid={TESTIDS.datatable.root} data-rows-rendered={String(data.length)} />) as BbsChrome["DataTable"],
    EmptyState: passThrough("section") as BbsChrome["EmptyState"],
    ErrorState: passThrough("section") as BbsChrome["ErrorState"],
    RefusalState: (({ refusal }: { refusal: { code: string } }) => <div data-testid={TESTIDS.refusal.state} data-code={refusal.code} />) as BbsChrome["RefusalState"],
    IdChip: (({ value, "data-testid": testId }: { value: string; "data-testid"?: string }) => <span data-testid={testId} data-value={value} />) as BbsChrome["IdChip"],
    EnumLabel: (({ value, label }: { value: string; label?: string }) => (
      <span className="enum" data-value={value}>
        {label ?? value}
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

/** The real registry, looked up by code — the words graded are the words a reader reads. */
const refusalOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

/** A partly declared reading over the fixture's golden schedule, leaving out what it is handed. */
function partialView(omitted: BbsView["omitted"]): BbsView {
  return { campaignId: "campaign-1", setRevisionId: "revision-1", document: goldenBbsDocument() as unknown as BbsDocument, partial: true, omitted };
}

/** What a node says, less its technical disclosures. */
function said(node: Element): string {
  const clone = node.cloneNode(true) as Element;
  for (const technical of Array.from(clone.querySelectorAll("[data-technical]"))) technical.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The omitted list's lines, as the answer slot holds them. */
function omittedLines(): HTMLLIElement[] {
  return [...screen.getByTestId(TESTIDS.bbs.answer).querySelectorAll("li")];
}

describe("I-354: a partial schedule says what it leaves out, why, and where that is settled", () => {
  it("each line leads with the components in words, then the registry's own message, then the place a reader acts", () => {
    const contested = REFUSALS.NOTE_READING_CONTESTED;
    const ties = REFUSALS.REBAR_TIE_ZONE_UNSTATED;
    render(
      <BbsWorkspace
        view={partialView([
          { code: contested.code, components: ["lap"] },
          { code: ties.code, components: ["ties"] },
        ])}
        permitted
        tenantId="t"
        projectId="p"
        chrome={chrome()}
        doors={{ refusalOf }}
      />,
    );
    const [lap, tie] = omittedLines();
    expect(said(lap as Element), "the contested note is why no LAP row stands — so the line says Laps first").toBe(`Laps ${contested.message} Open the schedules`);
    expect(said(tie as Element)).toBe(`Ties ${ties.message} Open the schedules`);

    for (const [line, entry] of [
      [lap, contested],
      [tie, ties],
    ] as const) {
      const where = (line as Element).querySelector("a") as HTMLAnchorElement;
      expect(where.getAttribute("href"), `${entry.code} is settled where the sheets' schedules and notes are read`).toBe("/t/t/p/p/takeoff/schedules");
      expect(where.closest("[data-tip]")?.getAttribute("data-tip"), "with the registry's remedy a hover or a focus away").toBe(entry.remedy);
      expect(line?.querySelector("[data-technical]")?.textContent, "and the component's raw name kept technical, never said").toMatch(/^(lap|ties)$/);
    }
  });

  it("a code stated for two components names both, and an unstored storey height is settled on the level stack", () => {
    const run = REFUSALS.REBAR_STOREY_RUN_UNSTATED;
    render(<BbsWorkspace view={partialView([{ code: run.code, components: ["net", "lap"] }])} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const [line] = omittedLines();
    expect(said(line as Element)).toBe(`Bars · Laps ${run.message} Open the levels`);
    expect((line as Element).querySelector("a")?.getAttribute("href")).toBe("/t/t/p/p/takeoff/levels");
  });

  it("a code whose place this screen does not know is said without a link — never sent somewhere it is not settled", () => {
    const unplaced = REFUSALS.BBS_NO_BAR_ROW;
    render(<BbsWorkspace view={partialView([{ code: unplaced.code, components: [] }])} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const [line] = omittedLines();
    expect(said(line as Element)).toBe(unplaced.message);
    expect((line as Element).querySelector("a")).toBeNull();
  });
});

describe("I-354: the stock readout's words are words, and only its figures are mono", () => {
  it("says `Stock bar 12,000 mm · rounded 25 mm` with the two figures in their own figure spans", () => {
    render(<BbsWorkspace view={partialView([])} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const stock = screen.getByTestId(TESTIDS.bbs.stock);
    const document_ = goldenBbsDocument() as unknown as BbsDocument;
    expect(stock.getAttribute("data-stock-mm"), "the machine still reads the stored figure (§6)").toBe(document_.stockMm);
    expect([...stock.querySelectorAll(".cx-bbs-stock-figure")].map((figure) => figure.textContent)).toEqual(["12,000", String(document_.roundingMm)]);
    expect(said(stock)).toBe(`Stock bar 12,000 mm · rounded ${String(document_.roundingMm)} mm`);
  });

  it("the sheet sets the figure face on the figures and not on the readout", () => {
    expect(declaredValue(SHEET, ".cx-bbs-stock", "font-family"), "the readout keeps the interface's face").toBeNull();
    expect(declaredValue(SHEET, ".cx-bbs-stock-figure", "font-family")).toBe("var(--font-mono)");
  });
});
