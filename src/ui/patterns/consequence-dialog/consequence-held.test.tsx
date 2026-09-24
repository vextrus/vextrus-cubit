// @vitest-environment jsdom
/**
 * DLG-2 — every consequence dialog speaks a quantity surveyor's words (docs/design/consequence-dialog.md,
 * I-560, I-561, I-562). Walk-1 opened two dialogs that did not:
 *
 *   - the discipline confirmation listed 29 blocks of `none → STRUCTURAL`, a raw enum, and its
 *     Confirm stood 2,618 px down a 900 px window;
 *   - the pin's After was a 64-character sha-256.
 *
 * These cases mount the shipped dialog over previews authored here and read what a person sees on
 * its face — its text with every closed disclosure taken out — so a raw value that reached the face
 * is caught, while the values themselves are asserted to stand whole one press away.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { Consequence, ConsequenceSubject } from "@/core/acts";
import { FigureProvider, type FigureFormat } from "../../primitives/core";
import { ConsequenceDialog } from "./index";
import { fill, strings } from "../../strings";

afterEach(cleanup);

const DIGEST = "4444444444444444444444444444444444444444444444444444444444444444";

/** The frame's conventions, marked so a count that skipped the format seam would show as such. */
const FIGURES: FigureFormat = { figure: (value) => `‹${value}›`, money: (amount) => amount, date: () => "" };

/** The dialog opened over one authored preview. */
async function open(consequence: Consequence): Promise<HTMLElement> {
  render(
    <FigureProvider format={FIGURES}>
      <ConsequenceDialog
        open
        actType={consequence.actType}
        preview={() => Promise.resolve({ consequence, consequenceDigest: DIGEST })}
        commit={() => Promise.resolve({ actId: "act-sample" })}
        onOpenChange={() => undefined}
        onCommitted={() => undefined}
      />
    </FigureProvider>,
  );
  await screen.findByTestId("consequence-confirm");
  return screen.getByTestId("consequence-dialog");
}

/** What the dialog says on its face: its text with every closed disclosure taken out. */
function faceOf(element: HTMLElement): string {
  const face = element.cloneNode(true) as HTMLElement;
  for (const disclosure of Array.from(face.querySelectorAll("details"))) {
    if (!(disclosure as HTMLDetailsElement).open) disclosure.remove();
  }
  return face.textContent ?? "";
}

/** A sheet confirmed from no discipline to one, as CONFIRM_DISCIPLINE's preview answers it. */
function sheet(at: number, discipline: "STRUCTURAL" | "ARCHITECTURAL" = "STRUCTURAL"): ConsequenceSubject {
  return {
    subjectId: `ingest-1::S-${String(at).padStart(2, "0")}`,
    subjectLabel: `S-${String(at).padStart(2, "0")} FOUNDATION LAYOUT`,
    before: [],
    after: [discipline],
    held: { kind: "DISCIPLINE", before: null, after: discipline },
  };
}

function confirming(subjects: ConsequenceSubject[]): Consequence {
  return { actType: "CONFIRM_DISCIPLINE", tenantId: "tenant-sample", projectId: "project-sample", rendering: "SUBJECTS", subjects };
}

describe("I-560: sheets taking one discipline are counted in one sentence, each one press away", () => {
  test("29 sheets read as one change in words — no enum, no 'none' — and every sheet is still a subject row", async () => {
    const sheets = Array.from({ length: 29 }, (_, at) => sheet(at + 1));
    const dialog = await open(confirming(sheets));

    const groups = within(dialog).getAllByTestId("consequence-change-group");
    expect(groups.length, "one change, one row").toBe(1);
    const group = groups[0] as HTMLElement;
    expect(group.querySelector(".cx-consequence-change-said")?.textContent).toBe(
      fill(strings.consequence_dialog_change_sheets, { count: "‹29›", before: strings.consequence_dialog_discipline_none, after: strings.consequence_dialog_discipline_structural }),
    );
    expect(group.getAttribute("data-count")).toBe("29");

    const face = faceOf(dialog);
    expect(face, "the enum is on no face of the dialog").not.toContain("STRUCTURAL");
    expect(face, "and neither is the absence said as the word 'none'").not.toMatch(/\bnone\b/u);
    expect(face, "and no sheet title stands on the face: 29 of them is the wall walk-1 found").not.toContain("FOUNDATION LAYOUT");

    const rows = within(group).getAllByTestId("consequence-subject-row");
    expect(rows.map((row) => row.getAttribute("data-subject")), "every sheet the act moves is still one row, in the order the seam sent").toEqual(sheets.map((held) => held.subjectId));
    const disclosure = group.querySelector("details") as HTMLDetailsElement;
    expect(disclosure.open, "the sheets are one press away, not on the face").toBe(false);
    expect(disclosure.querySelector("summary")?.textContent).toBe(fill(strings.consequence_dialog_members_sheets, { count: "‹29›" }));
    expect(rows[0]?.textContent, "each by the title a reader knows it by").toBe(sheets[0]?.subjectLabel);
  });

  test("one sheet reads as its own row, its columns in words", async () => {
    const dialog = await open(confirming([sheet(7)]));
    expect(within(dialog).queryAllByTestId("consequence-change-group"), "a change one sheet makes is that sheet's row").toHaveLength(0);
    const row = within(dialog).getByTestId("consequence-subject-row");
    const said = Array.from(row.querySelectorAll(".cx-consequence-held")).map((cell) => cell.textContent);
    expect(said).toEqual([strings.consequence_dialog_discipline_none, strings.consequence_dialog_discipline_structural]);
    expect(faceOf(dialog)).not.toContain("STRUCTURAL");
  });

  test("two changes are two rows, each where its first sheet stood", async () => {
    const dialog = await open(confirming([sheet(1), sheet(2, "ARCHITECTURAL"), sheet(3), sheet(4, "ARCHITECTURAL")]));
    const groups = within(dialog).getAllByTestId("consequence-change-group");
    expect(groups.map((group) => group.getAttribute("data-after"))).toEqual(["STRUCTURAL", "ARCHITECTURAL"]);
    expect(groups.map((group) => group.getAttribute("data-count"))).toEqual(["2", "2"]);
  });

  test("the values the act records stand whole in Details", async () => {
    const dialog = await open(confirming([sheet(1), sheet(2)]));
    const details = dialog.querySelector(".cx-consequence-details") as HTMLDetailsElement;
    expect(details.textContent).toContain(strings.consequence_dialog_details_values);
    expect(details.textContent).toContain(`${sheet(1).subjectLabel}: ${strings.consequence_dialog_none} → STRUCTURAL`);
  });

  test("a subject whose values are already words keeps its own row, verbatim, as every act before this one", async () => {
    const roles: Consequence = {
      actType: "ASSIGN_PARTICIPANT_ROLE",
      tenantId: "tenant-sample",
      projectId: "project-sample",
      rendering: "SUBJECTS",
      subjects: [
        { subjectId: "u-1", subjectLabel: "a@cubit.test", before: ["PRINCIPAL"], after: ["PRINCIPAL", "MEASURER"] },
        { subjectId: "u-2", subjectLabel: "b@cubit.test", before: ["PRINCIPAL"], after: ["PRINCIPAL", "MEASURER"] },
      ],
    };
    const dialog = await open(roles);
    expect(within(dialog).queryAllByTestId("consequence-change-group")).toHaveLength(0);
    expect(within(dialog).getAllByTestId("consequence-subject-row")).toHaveLength(2);
    expect(dialog.querySelector(".cx-consequence-values"), "and Details adds no values list where the face already shows them").toBeNull();
  });
});

/** A drawing the pin cites, from the revision a standing pin cited it at to the one it stands at now. */
function drawing(name: string, before: number | null, after: number | null): ConsequenceSubject {
  const sha = (ordinal: number): string => `${name}-${String(ordinal)}`.padEnd(64, "0");
  return {
    subjectId: `drawing-${name}`,
    subjectLabel: `${name}.dxf`,
    before: before === null ? [] : [sha(before)],
    after: after === null ? [] : [sha(after)],
    held: { kind: "DRAWING_REVISION", before, after },
  };
}

function pinningOf(subjects: ConsequenceSubject[], standing: number | null): Consequence {
  return {
    actType: "PIN_DRAWING_SET",
    tenantId: "tenant-sample",
    projectId: "project-sample",
    rendering: "SUBJECTS",
    subjects,
    pinning: { setName: "Tender set", revision: (standing ?? 0) + 1, standing, drawings: subjects.filter((subject) => subject.after.length > 0).length },
  };
}

describe("I-561: a pin says what it records — the set, its revision, the drawings — and keeps the content addresses in Details", () => {
  test("a second pin: the set as its revision 2, three drawings re-cited, one unchanged, one first cited", async () => {
    const subjects = [drawing("s-01", 1, 2), drawing("s-02", 1, 2), drawing("s-03", 1, 2), drawing("s-04", 1, 1), drawing("s-05", null, 1)];
    const dialog = await open(pinningOf(subjects, 1));

    const pinning = within(dialog).getByTestId("consequence-pinning");
    expect(pinning.textContent).toContain(fill(strings.consequence_dialog_pin_records, { set: "Tender set", revision: "‹2›", count: "‹5›" }));
    expect(pinning.textContent).toContain(fill(strings.consequence_dialog_pin_standing, { revision: "‹1›" }));

    const groups = within(dialog).getAllByTestId("consequence-change-group");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.querySelector(".cx-consequence-change-said")?.textContent).toBe(
      fill(strings.consequence_dialog_change_drawings, {
        count: "‹3›",
        before: fill(strings.consequence_dialog_revision, { ordinal: "‹1›" }),
        after: fill(strings.consequence_dialog_revision, { ordinal: "‹2›" }),
      }),
    );
    const own = within(dialog)
      .getAllByTestId("consequence-subject-row")
      .filter((row) => row.closest("[data-testid='consequence-change-group']") === null);
    expect(own.map((row) => row.getAttribute("data-subject")), "a change one drawing makes is that drawing's own row").toEqual(["drawing-s-04", "drawing-s-05"]);
    expect(Array.from(own[1]?.querySelectorAll(".cx-consequence-held") ?? []).map((cell) => cell.textContent)).toEqual([
      strings.consequence_dialog_revision_none,
      fill(strings.consequence_dialog_revision, { ordinal: "‹1›" }),
    ]);

    const face = faceOf(dialog);
    expect(face, "no 64-character content address stands on the face").not.toMatch(/[0-9a-z-]{40,}/u);
    const details = dialog.querySelector(".cx-consequence-details") as HTMLElement;
    for (const subject of subjects) expect(details.textContent, `${String(subject.subjectLabel)}'s content address stands whole in Details`).toContain(subject.after[0]);
  });

  test("drawings a pin leaves as they were say so rather than 'from Revision 1 to Revision 1'", async () => {
    const dialog = await open(pinningOf([drawing("a", 1, 1), drawing("b", 1, 1), drawing("c", null, 1)], 1));
    const group = within(dialog).getByTestId("consequence-change-group");
    expect(group.querySelector(".cx-consequence-change-said")?.textContent).toBe(
      fill(strings.consequence_dialog_same_drawings, { count: "‹2›", after: fill(strings.consequence_dialog_revision, { ordinal: "‹1›" }) }),
    );
  });

  test("a first pin says the set was never pinned", async () => {
    const dialog = await open(pinningOf([drawing("a", null, 1)], null));
    const pinning = within(dialog).getByTestId("consequence-pinning");
    expect(pinning.textContent).toContain(fill(strings.consequence_dialog_pin_records_one, { set: "Tender set", revision: "‹1›" }));
    expect(pinning.textContent).toContain(strings.consequence_dialog_pin_first);
  });

  test("a consequence without a pinning mounts no pin sentence", async () => {
    const dialog = await open(confirming([sheet(1)]));
    expect(within(dialog).queryByTestId("consequence-pinning")).toBeNull();
  });
});

describe("I-562: the action row stays in view however long the consequence is", () => {
  // jsdom lays nothing out, so the rule is read where it is written: the pattern's own stylesheet.
  const css = readFileSync(join(__dirname, "consequence-dialog.css"), "utf8");
  const rule = /\.cx-consequence-footer\s*\{([^}]*)\}/u.exec(css)?.[1] ?? "";

  test("the footer is sticky at the card's foot, over the card's own surface", () => {
    expect(rule, "the footer rule stands in the pattern's stylesheet").not.toBe("");
    expect(rule).toMatch(/position:\s*sticky/u);
    expect(rule).toMatch(/bottom:\s*calc\(var\(--space-5\)\s*\*\s*-1\)/u);
    expect(rule, "an opaque surface, so what scrolls beneath does not read through the buttons").toMatch(/background-color:\s*var\(--surface-overlay\)/u);
  });

  test("a consequence that fits paints as before: 20 px above the row, none added below", () => {
    expect(rule).toMatch(/margin-top:\s*var\(--space-2\)/u);
    expect(rule).toMatch(/padding-block:\s*var\(--space-3\)\s+var\(--space-5\)/u);
    expect(rule).toMatch(/margin-bottom:\s*calc\(var\(--space-5\)\s*\*\s*-1\)/u);
  });
});
