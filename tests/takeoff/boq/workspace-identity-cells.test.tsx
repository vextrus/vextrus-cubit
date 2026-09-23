// @vitest-environment jsdom
/**
 * I-355 — the draft says its taxonomy as a person can use it, a lawful-null level as a word, and a
 * member's mark muted beside its description (docs/design/s-boq.md §0 I-355, I-boq-1(c), §1's
 * wireframe `taxonomy 2026-09-16`; R-UI-082, R-UI-085).
 *
 * The vision re-look found the taxonomy chip reading `bill-ta` — the first seven characters of
 * `bill-taxonomy/2026-09-16`, which is neither a usable id nor a word — the `Foundation` slot set in
 * the mono face because it borrowed the level column's class, and the mark `PC1` at the description's
 * own ink. The mount is the SHIPPED workspace over a draft the product's own emission composes
 * (`boqDraftPayloadOf`, `numberItems`), with chrome stubs that publish what they were handed (I-170);
 * what the sheet states is read off the screen's own stylesheet. Nothing here opens a database and
 * nothing here measures time (AM-10 §3).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { boqDraftPayloadOf } from "../../../src/modules/takeoff/boq/emission";
import { numberItems } from "../../../src/modules/takeoff/boq/numbering";
import { BILL_TAXONOMY } from "../../../src/modules/takeoff/boq/taxonomy";
import type { BoqView } from "../../../src/modules/takeoff/boq/view";
import { BoqWorkspace, type BoqChrome } from "../../../src/modules/takeoff/boq/workspace";
import { TESTIDS } from "../../../src/ui/testids";
import { declaredValue } from "../../support/stylesheet";

afterEach(() => {
  cleanup();
});

// jsdom answers `import.meta.url` as a page address, not a file: the lane runs from the repo root.
const SHEET = readFileSync(join(process.cwd(), "src/app/(app)/t/[tenant]/p/[project]/takeoff/boq/boq.css"), "utf8");

/** The lawful-null slot a member stands in where it stands on no level (L-REG-04). */
const FOUNDATION = "FOUNDATION";

/**
 * A pile cap standing on no level of the stack (the foundation's slot) and a column on the ground
 * floor — two items. TEST_AMENDED (session 8, BOQ-SHAPE, I-528): an item's members and their
 * marks are the payload's own now (the details of measurement), so the view carries no `lineFacts`
 * beside it; the slot an item's members stand in is the item's.
 */
function aView(): BoqView {
  const line = (lineId: string, objectKey: string, klass: string, levelId: string | null, slot: string | null) => ({
    lineId,
    objectKey,
    class: klass as never,
    kind: "rcc.concrete" as never,
    levelId,
    value: "4.225",
    unit: "m3",
    quantityBasis: "MEASURED",
    selectionBasis: "TRANSCRIBED",
    coverage: "COMPLETE",
    mark: objectKey.split("/").pop() ?? "",
    slot,
  });
  const lines = [line("l-1", "cap/PC1", "pile_cap", null, FOUNDATION), line("l-2", "column/C1", "column", "lvl-gf", null)];
  const payload = boqDraftPayloadOf({ project: "p", campaignId: "campaign-1", setRevisionId: "revision-1", levels: [{ levelId: "lvl-gf", ordinal: 0, label: "GF" }], lines, coverageComplete: true });
  return {
    campaignId: "campaign-1",
    setRevisionId: "revision-1",
    taxonomyVersion: payload.taxonomyVersion,
    coverage: "COMPLETE",
    payload,
    items: numberItems(payload.sections),
  };
}

/** A stub that renders its children and every data attribute it was handed. */
function passThrough(tag: keyof HTMLElementTagNameMap): ComponentType<Record<string, unknown>> {
  const Stub = (props: Record<string, unknown>): ReactNode => {
    const Tag = tag as "div";
    const attributes = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children" && key !== "content" && key !== "onClick" && key !== "onRetry"));
    return <Tag {...(attributes as Record<string, string>)}>{props["children"] as ReactNode}</Tag>;
  };
  return Stub;
}

/** The chrome the workspace declares; the table draws every cell its columns render, row by row. */
function chrome(): BoqChrome {
  const DataTable = ({ columns, data }: { columns: { id: string; cell: (context: { row: { original: unknown } }) => ReactNode }[]; data: unknown[] }) => (
    <table>
      <tbody>
        {data.map((row, at) => (
          <tr key={at}>
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
  return {
    DataTable: DataTable as unknown as BoqChrome["DataTable"],
    EmptyState: passThrough("section") as BoqChrome["EmptyState"],
    ErrorState: passThrough("section") as BoqChrome["ErrorState"],
    RefusalState: (({ refusal }: { refusal: { code: string } }) => <div data-code={refusal.code} />) as BoqChrome["RefusalState"],
    IdChip: (({ value, short, className, "data-testid": testId }: { value: string; short?: string; className?: string; "data-testid"?: string }) => (
      <span className={className} data-testid={testId} data-value={value} data-short={short ?? ""}>
        {short ?? value.slice(0, 7)}
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

const refusalOf = (): undefined => undefined;

describe("I-355: the taxonomy chip says the edition a person can tell taxonomies apart by", () => {
  it("shows the version's edition and keeps the whole version as its value", () => {
    render(<BoqWorkspace view={aView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const chip = screen.getByTestId(TESTIDS.boq.taxonomyVersion);
    expect(chip.getAttribute("data-value"), "the whole version stays the chip's value, tooltip and copy (R-UI-082)").toBe(BILL_TAXONOMY.version);
    expect(BILL_TAXONOMY.version.endsWith(`/${chip.getAttribute("data-short") ?? ""}`), `the short form is the edition after the family's slash: ${BILL_TAXONOMY.version}`).toBe(true);
    expect(chip.getAttribute("data-short"), "and it is a date, never the family's first seven characters").toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("I-355: a lawful-null level is a word, and an item's qualification is muted", () => {
  it("an item on no level says its slot through EnumLabel under its own class — never the level column's mono class", () => {
    const { container } = render(<BoqWorkspace view={aView()} permitted tenantId="t" projectId="p" chrome={chrome()} doors={{ refusalOf }} />);
    const levels = [...container.querySelectorAll('td[data-column="level"]')];
    const slot = levels.map((cell) => cell.querySelector(`[data-value="${FOUNDATION}"]`)).find((found) => found !== null) as Element;
    expect(slot, "the foundation line says its slot").toBeTruthy();
    expect(slot.classList.contains("cx-boq-slot"), "under the slot's own class").toBe(true);
    expect(slot.classList.contains("cx-boq-level"), "and not the level label's, which sets the mono face").toBe(false);
    const label = levels.map((cell) => cell.querySelector(".cx-boq-level")).find((found) => found !== null);
    expect(label?.textContent, "a line on a level still says the label verbatim, in the level column's face").toBe("GF");
  });

  // TEST_AMENDED (session 8, BOQ-SHAPE, I-528): a member's mark moved off the screen's rows —
  // a row is an item now, and the marks stand in its details of measurement — so the muted ink this
  // case guarded is asked of what now follows a description on its row: the item's qualification.
  it("the sheet states the slot in the interface's face and the slot and an item's qualification in the muted ink", () => {
    expect(declaredValue(SHEET, ".cx-boq-slot.cx-boq-enum", "font-family"), "the slot keeps the EnumLabel's own face").toBeNull();
    expect(declaredValue(SHEET, ".cx-boq-slot.cx-boq-enum", "color")).toBe("var(--ink-muted)");
    expect(declaredValue(SHEET, ".cx-boq-qualifier", "color"), "the qualification is muted so the description leads (I-450)").toBe("var(--ink-muted)");
  });
});
