// @vitest-environment jsdom
/**
 * AC-4's pattern half — the two effect slots R-TO-020 asks an affirmation to preview: the lines that
 * would re-derive and the signatures that would void, computed by the server and carried on the
 * Consequence's own `effects` field (docs/design/consequence-dialog.md).
 *
 * The slots are a property of the CONSEQUENCE, not of the act type: a preview that carries `effects`
 * mounts both, and a preview that carries none mounts neither (I-161).
 *
 * DLG-1 (I-446): each slot says what moves the way a quantity surveyor counts it — the lines by
 * class, kind and level, the signatures by count — and the identifiers themselves stand inside the
 * slot, one press away in a disclosure, whole (R-UI-082). A wall of ids on the face of the dialog is
 * exactly what the walk found and what these cases forbid.
 *
 * Everything is observed through the pattern's own closed contract (Decision § 7) and through the
 * props it declares; the effect payloads are authored here, so what is asserted is what THIS test
 * supplied rather than a frozen sentence the component could also be holding.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ConsequenceLineGroup } from "@/core/acts";
import { FigureProvider, type FigureFormat } from "../../primitives/core";
import { ConsequenceDialog } from "./index";
import { fill, strings } from "../../strings";

const AFFIRM_SCALE = "AFFIRM_SCALE";
const DIGEST = "3333333333333333333333333333333333333333333333333333333333333333";

/** One subject of an affirmation: the view it names, before under no calibration and after under one. */
const SUBJECT = { subjectId: "v:PLAN:CAP-P", before: [], after: ["b3d1f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8"] };

type Effects = { linesRederiving: string[]; signaturesVoiding: string[]; lineGroups?: ConsequenceLineGroup[] };

/** The consequence a preview answers, with or without the derived effects an act's kind has (L-ACT-02). */
function consequenceOf(effects: Effects | null): unknown {
  const base = { actType: AFFIRM_SCALE, tenantId: "tenant-sample", projectId: "project-sample", rendering: "SUBJECTS", subjects: [SUBJECT] };
  return effects === null ? base : { ...base, effects };
}

/**
 * The document's conventions as the frame installs them. The figure answer is marked so a count
 * that reached the screen WITHOUT passing through the seam's grouping would be visible as such.
 */
const FIGURES: FigureFormat = { figure: (value) => `‹${value}›`, money: (amount) => amount, date: () => "" };

/** The dialog opened over one preview, with no commit ever asked for. */
function open(effects: Effects | null): void {
  render(
    <FigureProvider format={FIGURES}>
      <ConsequenceDialog
        open
        actType={AFFIRM_SCALE}
        preview={() => Promise.resolve({ consequence: consequenceOf(effects), consequenceDigest: DIGEST } as never)}
        commit={() => Promise.resolve({ actId: "act-sample" })}
        onOpenChange={() => undefined}
        onCommitted={() => undefined}
      />
    </FigureProvider>,
  );
}

/** The one word an empty slot is said with, read from the one string table by key (R-SPINE-060). */
function none(): string {
  const line = (strings as unknown as Record<string, string>)["consequence_dialog_none"];
  expect(typeof line, "the one string table carries `consequence_dialog_none`").toBe("string");
  return line as string;
}

/** What a slot says on its face: its text with every closed disclosure inside it taken out. */
function faceOf(slot: HTMLElement): string {
  const face = slot.cloneNode(true) as HTMLElement;
  for (const disclosure of Array.from(face.querySelectorAll("details"))) {
    if (!(disclosure as HTMLDetailsElement).open) disclosure.remove();
  }
  return face.textContent ?? "";
}

/** The one disclosure inside a slot that holds its identifiers. */
function disclosureIn(slot: HTMLElement): HTMLDetailsElement {
  const held = slot.querySelectorAll("details");
  expect(held.length, "the slot keeps its identifiers in exactly one disclosure (R-UI-082)").toBe(1);
  return held[0] as HTMLDetailsElement;
}

afterEach(() => {
  cleanup();
});

describe("AC-4: the two effect slots of an act whose consequence carries them", () => {
  test("AC-4: a preview carrying empty effects mounts both slots saying nothing is affected, and one carrying no effects mounts neither", async () => {
    open({ linesRederiving: [], signaturesVoiding: [] });
    const dialog = await screen.findByTestId("consequence-dialog");
    expect(dialog.getAttribute("data-act-type"), "the dialog is the act's own, named verbatim on its wrapper (R-UI-021)").toBe(AFFIRM_SCALE);

    for (const slot of ["consequence-effect-lines", "consequence-effect-signatures"]) {
      const held = within(dialog).getAllByTestId(slot);
      expect(held.length, `exactly one \`${slot}\` stands for a consequence that carries effects`).toBe(1);
      expect((held[0] as HTMLElement).textContent ?? "", `and an empty ${slot} says so rather than standing silent (R-UI-020)`).toBe(none());
    }

    cleanup();
    open(null);
    const plain = await screen.findByTestId("consequence-dialog");
    expect(within(plain).queryAllByTestId("consequence-subject-row").length, "the consequence still renders as the subject list it is").toBe(1);
    for (const slot of ["consequence-effect-lines", "consequence-effect-signatures"]) {
      expect(within(plain).queryAllByTestId(slot).length, `an act whose consequence names no effects mounts no \`${slot}\` (B-20)`).toBe(0);
    }
  });

  test("AC-4, I-446: named effects are COUNTED on the face, and the ids stand whole one press away", async () => {
    const lines = ["line:A-100", "line:A-101"];
    const signatures = ["sig:7f2c"];
    open({ linesRederiving: lines, signaturesVoiding: signatures });
    const dialog = await screen.findByTestId("consequence-dialog");

    const lineSlot = within(dialog).getByTestId("consequence-effect-lines");
    expect(faceOf(lineSlot), "an ungrouped effect is said as its count, through the document's conventions").toContain(fill(strings.consequence_dialog_lines, { count: "‹2›" }));
    for (const line of lines) expect(faceOf(lineSlot), `no id stands on the face of the slot (${line}, R-UI-082)`).not.toContain(line);
    expect(faceOf(lineSlot), "and the slot does not say `none` when it names something").not.toContain(none());
    const lineIds = disclosureIn(lineSlot);
    expect(lineIds.open, "the ids' disclosure is closed until a reader opens it").toBe(false);
    for (const line of lines) expect(lineIds.textContent ?? "", `the lines that would re-derive are named whole inside it (${line}, R-TO-020)`).toContain(line);

    const signatureSlot = within(dialog).getByTestId("consequence-effect-signatures");
    expect(faceOf(signatureSlot), "one signature is said as one").toContain(strings.consequence_dialog_signatures_one);
    for (const signature of signatures) {
      expect(faceOf(signatureSlot), "and its id is not on the face").not.toContain(signature);
      expect(disclosureIn(signatureSlot).textContent ?? "", `the signatures that would void are named whole (${signature}, R-TO-020)`).toContain(signature);
    }
  });

  test("I-446: grouped lines read as class, kind and level with a count each, and a total", async () => {
    const lines = Array.from({ length: 52 }, (_, at) => `line-${String(at).padStart(3, "0")}`);
    const groups: ConsequenceLineGroup[] = [
      { elementClass: "pile_cap", kind: "rcc.concrete", description: "Pile cap · Concrete", levelLabel: null, levelSlot: "FOUNDATION", count: 2 },
      { elementClass: "column", kind: "rcc.concrete", description: "Column · Concrete", levelLabel: "GF", levelSlot: null, count: 24 },
      { elementClass: "column", kind: "rcc.formwork", description: "Column · Formwork", levelLabel: "GF", levelSlot: null, count: 25 },
      { elementClass: "beam", kind: "rcc.concrete", description: "Beam · Concrete", levelLabel: null, levelSlot: null, count: 1 },
    ];
    open({ linesRederiving: lines, signaturesVoiding: [], lineGroups: groups });
    const dialog = await screen.findByTestId("consequence-dialog");
    const slot = within(dialog).getByTestId("consequence-effect-lines");

    const rows = within(slot).getAllByTestId("consequence-effect-group");
    expect(rows.length, "one row per group the seam counted, in the order it counted them").toBe(groups.length);
    const expectedWhere = [strings.consequence_dialog_level_foundation, "GF", "GF", strings.consequence_dialog_level_none];
    groups.forEach((group, at) => {
      const row = rows[at] as HTMLElement;
      expect(row.getAttribute("data-class"), "the row names its class for a reader's tools").toBe(group.elementClass);
      expect(row.getAttribute("data-kind"), "and its kind").toBe(group.kind);
      expect(row.getAttribute("data-count"), "and its count").toBe(String(group.count));
      const text = row.textContent ?? "";
      expect(text, "the row says the pair as the bill says it").toContain(group.description);
      expect(text, "where the objects stand — a level's label, the foundation slot in words, or no level").toContain(expectedWhere[at] as string);
      expect(text, "and how many lines, through the document's conventions").toContain(
        group.count === 1 ? strings.consequence_dialog_lines_one : fill(strings.consequence_dialog_lines, { count: `‹${group.count}›` }),
      );
    });
    expect(faceOf(slot), "more than one group adds up to the ids' own count").toContain(fill(strings.consequence_dialog_lines_total, { count: `‹${lines.length}›` }));
    expect(faceOf(slot), "and not one id stands on the face (the walk's 52-id wall)").not.toMatch(/line-\d{3}/);
    expect(disclosureIn(slot).textContent ?? "", "every id is still there, whole, one press away").toContain(lines.join(" "));
  });

  test("I-446: one group is its own total", async () => {
    open({
      linesRederiving: ["line-a", "line-b"],
      signaturesVoiding: [],
      lineGroups: [{ elementClass: "column", kind: "rcc.concrete", description: "Column · Concrete", levelLabel: "1F", levelSlot: null, count: 2 }],
    });
    const dialog = await screen.findByTestId("consequence-dialog");
    const slot = within(dialog).getByTestId("consequence-effect-lines");
    expect(within(slot).getAllByTestId("consequence-effect-group").length).toBe(1);
    expect(faceOf(slot), "a single row needs no sum beneath it").not.toContain(fill(strings.consequence_dialog_lines_total, { count: "‹2›" }));
  });
});
