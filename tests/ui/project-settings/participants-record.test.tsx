// @vitest-environment jsdom
/**
 * s-settings-participants I-524 — the record is read by WHEN. The Role history's Recorded cell is
 * 128 px wide; written "by {address} on {day}", every row a person recorded gave its day to the
 * ellipsis (gate 2's participants capture: "by j003p-muefq5r…"). The day now leads the cell and the
 * address follows it, so the part a truncation takes is the part the cell's tooltip gives back.
 *
 * The section is mounted with injected data and settlements (the SignInForm precedent the Decision's
 * §1 names), and every word it is judged by is read off the string table and the format seam — the
 * test transcribes no copy and no date (B-19).
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { formatDate } from "../../../src/core/format";
import { ParticipantsSection, type ParticipantsHistoryRow } from "../../../src/app/(app)/t/[tenant]/p/[project]/settings/participants/participants-section";
import { fill, strings } from "../../../src/ui/strings";
import { TESTIDS } from "../../../src/ui/testids";

afterEach(() => {
  cleanup();
});

const CREATOR = { userId: "00000000-0000-4000-8000-0000000000c1", label: "rahim.uddin@sattva-projects.test" };
const GRANTED_AT = "2026-09-24T10:00:00.000Z";

/** The creating grant (performed by nobody — L-ACT-03's bootstrap) and one a person recorded. */
const HISTORY: readonly ParticipantsHistoryRow[] = [
  { direction: "GRANT", role: "PRINCIPAL", subject: CREATOR, actor: null, occurredAt: GRANTED_AT },
  { direction: "GRANT", role: "MEASURER", subject: CREATOR, actor: CREATOR, occurredAt: GRANTED_AT },
];

/** The day the seam states, computed the way the screen states it (L-FMT-01) — never spelled here. */
function dayOf(occurredAt: string): string {
  const at = new Date(occurredAt);
  return formatDate({ year: at.getFullYear(), month: at.getMonth() + 1, day: at.getDate() });
}

function mountRecord(): HTMLElement[] {
  const refused = async (): Promise<never> => {
    throw new Error("no act is carried in this suite");
  };
  render(
    <ParticipantsSection
      tenantId="00000000-0000-4000-8000-0000000000a1"
      projectId="00000000-0000-4000-8000-0000000000b1"
      roster={[{ ...CREATOR, roles: ["PRINCIPAL", "MEASURER"] }]}
      history={HISTORY}
      subjects={[CREATOR]}
      preview={refused as never}
      commit={refused as never}
    />,
  );
  return [...document.querySelectorAll<HTMLElement>(`[data-testid="${TESTIDS.participants.historyRow}"]`)];
}

/** The Recorded cell of a record row: the grid's fourth, the cell the Decision's §1 heads Recorded. */
function recordedOf(row: HTMLElement): string {
  const cells = [...row.querySelectorAll<HTMLElement>('[role="gridcell"], [role="rowheader"]')];
  expect(cells.length, "the record row draws its four columns").toBe(4);
  return (cells[3]?.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("I-524: the Role history's Recorded cell leads with the day", () => {
  test("a movement a person recorded reads its day first, then who recorded it", () => {
    const rows = mountRecord();
    expect(rows, "one record row per movement, oldest first (I-52)").toHaveLength(2);
    const recorded = recordedOf(rows[1] as HTMLElement);
    const day = dayOf(GRANTED_AT);
    expect(recorded, "the whole sentence is the table's own, filled by the seam's day and the roster's label").toBe(
      fill(strings.spine_participants_history_by, { actor: CREATOR.label, date: day }),
    );
    expect(recorded.startsWith(day), "the day stands first, so a truncation at 128 px never takes it").toBe(true);
    expect(recorded.endsWith(CREATOR.label), "and the recording member follows it — the part the cell's tooltip gives back").toBe(true);
  });

  test("the creating grant, performed by nobody, reads its day and stops (L-ACT-03)", () => {
    const rows = mountRecord();
    expect(recordedOf(rows[0] as HTMLElement)).toBe(dayOf(GRANTED_AT));
  });
});
