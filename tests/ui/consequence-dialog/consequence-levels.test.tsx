// @vitest-environment jsdom
/**
 * The Insert levels dialog in words (docs/design/consequence-dialog.md I-664, walk-2 B16): its
 * face said `ordinal:0` for where a level stands and `column … ROOF` for an object carried off a
 * placeholder. A level's place is "Stack position 2"; an object is named as the register names it,
 * `Column C2`, and objects carried onto one level are counted in one sentence. The values the act
 * writes stay whole in Details.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { Consequence, ConsequenceSubject } from "@/core/acts";
import { carriedSubjects } from "@/core/acts/insert-level";
import { FigureProvider, type FigureFormat } from "@/ui/primitives/core";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { fill, strings } from "@/ui/strings";

afterEach(cleanup);

const DIGEST = "5555555555555555555555555555555555555555555555555555555555555555";
const FIGURES: FigureFormat = { figure: (value) => `‹${value}›`, money: (amount) => amount, date: () => "" };

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

function faceOf(element: HTMLElement): string {
  const face = element.cloneNode(true) as HTMLElement;
  for (const disclosure of Array.from(face.querySelectorAll("details"))) {
    if (!(disclosure as HTMLDetailsElement).open) disclosure.remove();
  }
  return face.textContent ?? "";
}

const PLACED: ConsequenceSubject = {
  subjectId: "proposed:0",
  subjectLabel: "ROOF",
  before: [],
  after: ["ordinal:2"],
  held: { kind: "LEVEL_POSITION", before: null, after: 2 },
};

const CARRIED = carriedSubjects([
  { objectKey: "k-c2", levelLabel: "ROOF", elementType: "column", mark: "C2" },
  { objectKey: "k-c2", levelLabel: "ROOF", elementType: "column", mark: "C2" },
  { objectKey: "k-c4", levelLabel: "ROOF", elementType: "column", mark: "C4" },
  { objectKey: "k-w1", levelLabel: "ROOF", elementType: "wall" },
]);

function inserting(subjects: ConsequenceSubject[]): Consequence {
  return { actType: "INSERT_LEVEL", tenantId: "tenant-sample", projectId: "project-sample", rendering: "SUBJECTS", subjects };
}

describe("I-664: the Insert levels dialog speaks in words", () => {
  test("a carried object is named as the register names it, once per object, carried onto its level in words", () => {
    expect(CARRIED.map((subject) => subject.subjectLabel)).toEqual(["Column C2", "Column C4", "Wall"]);
    expect(CARRIED.map((subject) => subject.held)).toEqual(Array.from({ length: 3 }, () => ({ kind: "LEVEL_CARRIED", before: null, after: "ROOF" })));
    expect(CARRIED[0]?.after, "the act still writes the label").toEqual(["ROOF"]);
  });

  test("a level's place reads as its stack position; objects carried onto one level are one sentence — no `ordinal:`, no class key", async () => {
    const dialog = await open(inserting([PLACED, ...CARRIED]));
    const face = faceOf(dialog);
    expect(face).not.toContain("ordinal:");
    expect(face).not.toMatch(/\bcolumn\b/u);

    const row = within(dialog)
      .getAllByTestId("consequence-subject-row")
      .find((candidate) => candidate.getAttribute("data-subject") === PLACED.subjectId) as HTMLElement;
    expect(Array.from(row.querySelectorAll(".cx-consequence-held")).map((cell) => cell.textContent)).toEqual([
      strings.consequence_dialog_level_position_none,
      fill(strings.consequence_dialog_level_position, { n: "2" }),
    ]);

    const group = within(dialog).getByTestId("consequence-change-group");
    expect(group.querySelector(".cx-consequence-change-said")?.textContent).toBe(
      fill(strings.consequence_dialog_change_objects, {
        count: "‹3›",
        before: strings.consequence_dialog_level_carried_none,
        after: fill(strings.consequence_dialog_level_carried, { level: "ROOF" }),
      }),
    );
  });

  test("the values the act writes stand whole in Details", async () => {
    const dialog = await open(inserting([PLACED]));
    expect((dialog.querySelector(".cx-consequence-details") as HTMLElement).textContent).toContain("ordinal:2");
  });
});
