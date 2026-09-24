// @vitest-environment jsdom
/**
 * Public acceptance for AC-5 — ConsequenceDialog, the one act pattern (R-UI-021, R-UI-011, B-17),
 * against docs/design/consequence-dialog.md.
 *
 * The component is observed through its own closed test contract (Decision §7) and through the
 * props the increment's interfaces declare — `open`, `actType`, `preview()`, `commit({
 * consequenceDigest })`, `onOpenChange`, `onCommitted`. Nothing about its markup beyond those ids
 * and the behavioural hooks the Decision names is asserted, and no stylesheet fact is: jsdom lays
 * nothing out, and the paint is J-003's committed baseline (Decision §7).
 *
 * The barrel is loaded by absolute path so a module the Builder has not written yet fails as an
 * assertion naming the file rather than as an unreadable resolution error. The *type-only* import
 * beside it is the other half of the interface: the prop set is closed, which no runtime render can
 * observe — `tsc` (`pnpm verify`) is that assertion's runner, through `UNDECLARED_PROPS` below.
 *
 * This file is `.ts`, not `.tsx`, on purpose: tsconfig's `include` covers `*.ts` only, so a `.tsx`
 * acceptance would run under vitest and never reach `tsc` — and the compile-time half would
 * silently never be checked. Elements are built with `React.createElement`, as the RefusalState
 * acceptance does.
 *
 * B-19: the sample Consequence is authored here, so the assertions are derived from it — the row
 * count is the number of subjects THIS test supplies, never a frozen number, and the digest
 * compared is the one the injected preview answered.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import type { ConsequenceDialog as ConsequenceDialogComponent } from "./index";
import { galleryBarrels, galleryEntries, missingEntries } from "../../gallery-derivation";
import { FigureProvider, type FigureFormat } from "../../primitives/core";
import { fill, strings } from "../../strings";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

/** The barrel the increment's interfaces name, and the gallery key it owes (R-UI-011). */
const BARREL = "src/ui/patterns/consequence-dialog/index.ts";
const BARREL_ID = "patterns/consequence-dialog";
const EXPORT_NAME = "ConsequenceDialog";

/** The ids of the closed contract (test contract, Decision §7). */
const TESTIDS = {
  dialog: "consequence-dialog",
  subjectRow: "consequence-subject-row",
  digestLine: "consequence-digest-line",
  confirm: "consequence-confirm",
  details: "consequence-details",
} as const;

/** The act this increment renders, and the roles its Consequence moves. */
const ACT_TYPE = "ASSIGN_PARTICIPANT_ROLE";

/** An authored digest: sample data of the shape a sha-256 digest wears, never a computed one. */
const DIGEST = "9f2c1d4b7a6e5038c1b2a3d4e5f60718293a4b5c6d7e8f9012a3b4c5d6e7f801";

/** The two column labels the Decision fixes verbatim (§ 3), above the values each column holds. */
const BEFORE_LABEL = "Before";
const AFTER_LABEL = "After";

/**
 * The sample Consequence — this test's own data, and the denominator of every count below.
 *
 * The third subject is a WITHDRAW shape on purpose: a role held BEFORE and not held AFTER. Without
 * one, every `before` here would be a subset of its own `after`, and a dialog that rendered the
 * after list alone (or the union of the two) would satisfy every "shows before" assertion in this
 * file while never rendering the before column at all — which is the production case R-SPINE-011
 * adds and the half of R-UI-021's "before and after" that would go ungraded.
 */
const SUBJECTS = [
  { subjectId: "user-estimator", before: ["PRINCIPAL"], after: ["MEASURER", "PRINCIPAL"] },
  { subjectId: "user-reviewer", before: ["REVIEWER"], after: ["LEAD", "REVIEWER"] },
  { subjectId: "user-principal", before: ["LEAD", "PRINCIPAL"], after: ["PRINCIPAL"] },
] as const;

/**
 * A row's two columns, read at the labels the Decision puts above them (§ 1: "Before | After
 * columns", § 3: the two label strings). Nothing about the markup between them is asserted — only
 * that a role the subject loses stands under the one label and not under the other, which is the
 * difference between rendering a transition and rendering a role list.
 */
function columnsOf(text: string): { before: string; after: string } {
  const beforeAt = text.indexOf(BEFORE_LABEL);
  const afterAt = beforeAt < 0 ? -1 : text.indexOf(AFTER_LABEL, beforeAt + BEFORE_LABEL.length);
  expect(beforeAt, `a subject row labels its two columns "${BEFORE_LABEL}" and "${AFTER_LABEL}" (Decision § 1, § 3); got ${JSON.stringify(text)}`).toBeGreaterThanOrEqual(0);
  expect(afterAt, `…and the after column follows the before column; got ${JSON.stringify(text)}`).toBeGreaterThan(beforeAt);
  return { before: text.slice(beforeAt + BEFORE_LABEL.length, afterAt), after: text.slice(afterAt + AFTER_LABEL.length) };
}

const CONSEQUENCE = {
  actType: ACT_TYPE,
  tenantId: "tenant-sample",
  projectId: "project-sample",
  // The arm the body renders is the Consequence's own, named and never defaulted (L-ACT-02).
  rendering: "SUBJECTS",
  subjects: SUBJECTS,
} as const;

/**
 * AC-5's compile-time half: the prop set the increment declares is the whole prop set. A component
 * that grows a seventh prop makes `UNDECLARED_PROPS` uninhabited-by-nothing and `tsc` says so —
 * which is what "props exactly …" means (interfaces, Decision §1).
 */
type Props = React.ComponentProps<typeof ConsequenceDialogComponent>;
type DeclaredProp = "open" | "actType" | "preview" | "commit" | "onOpenChange" | "onCommitted";
type Undeclared = Exclude<keyof Props, DeclaredProp>;
const UNDECLARED_PROPS: Undeclared[] = [];

type PreviewAnswer = { consequence: unknown; consequenceDigest: string };

interface DialogProps {
  open: boolean;
  actType: string;
  preview: () => Promise<PreviewAnswer>;
  commit: (input: { consequenceDigest: string }) => Promise<{ actId: string }>;
  onOpenChange: (open: boolean) => void;
  onCommitted: (committed: { actId: string }) => void;
}

/** The shipped component, or an assertion naming the file the product does not provide yet. */
async function consequenceDialog(): Promise<React.ComponentType<DialogProps>> {
  const abs = join(REPO_ROOT, BARREL);
  expect(existsSync(abs), `${BARREL} is missing from the checkout — the one act pattern every act flow opens (B-17)`).toBe(true);
  const specifier: string = abs;
  const barrel = (await import(specifier)) as Record<string, unknown>;
  expect(typeof barrel[EXPORT_NAME], `${BARREL} must export ${EXPORT_NAME}`).not.toBe("undefined");
  return barrel[EXPORT_NAME] as React.ComponentType<DialogProps>;
}

afterEach(() => {
  cleanup();
});

/**
 * A pointer that does not ask whether the page says it is pointable. An open overlay puts
 * `pointer-events: none` on the body while it holds focus, which is the primitive's own behaviour
 * and nothing this criterion judges — the check is switched off so a real activation is what the
 * assertion measures.
 */
const activator = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ pointerEventsCheck: 0 } as Parameters<typeof userEvent.setup>[0]);

describe("AC-5: the dialog renders the consequence it was handed, and commits exactly its digest", () => {
  test("AC-5: one subject row per subject, showing before and after", async () => {
    const Dialog = await consequenceDialog();
    render(
      React.createElement(Dialog, {
        open: true,
        actType: ACT_TYPE,
        preview: () => Promise.resolve({ consequence: CONSEQUENCE, consequenceDigest: DIGEST }),
        commit: () => Promise.resolve({ actId: "act-sample" }),
        onOpenChange: () => undefined,
        onCommitted: () => undefined,
      }),
    );

    const dialog = await screen.findByTestId(TESTIDS.dialog);
    const rows = await screen.findAllByTestId(TESTIDS.subjectRow);
    expect(rows.length, "one row per subject of the Consequence, in the order the seam answered (Decision §1)").toBe(SUBJECTS.length);

    SUBJECTS.forEach((subject, index) => {
      const row = rows[index];
      expect(row, `subject ${subject.subjectId} has a row`).toBeDefined();
      const text = row?.textContent ?? "";
      for (const role of subject.before) expect(text, `the row shows what ${subject.subjectId} holds before: ${role}`).toContain(role);
      for (const role of subject.after) expect(text, `the row shows what ${subject.subjectId} would hold after: ${role}`).toContain(role);

      // The transition itself, not a role list: a role the subject LOSES stands under the before
      // label and nowhere after it, and a role they GAIN stands only after it. A dialog rendering
      // `after` alone, or the union of the two, fails here.
      const columns = columnsOf(text);
      const before: readonly string[] = subject.before;
      const after: readonly string[] = subject.after;
      for (const role of before.filter((role) => !after.includes(role))) {
        expect(columns.before, `${subject.subjectId} holds ${role} before the act, so the before column says so (R-UI-021)`).toContain(role);
        expect(columns.after, `…and would not hold ${role} after it, so the after column does not say so`).not.toContain(role);
      }
      for (const role of after.filter((role) => !before.includes(role))) {
        expect(columns.after, `${subject.subjectId} would hold ${role} after the act, so the after column says so`).toContain(role);
        expect(columns.before, `…and does not hold ${role} before it, so the before column does not say so`).not.toContain(role);
      }
    });

    expect(dialog.getAttribute("data-act-type"), "the wrapper names the act type it is confirming (Decision §1)").toBe(ACT_TYPE);
  });

  test("AC-5: the digest line is the digest the preview answered, character for character", async () => {
    const Dialog = await consequenceDialog();
    render(
      React.createElement(Dialog, {
        open: true,
        actType: ACT_TYPE,
        preview: () => Promise.resolve({ consequence: CONSEQUENCE, consequenceDigest: DIGEST }),
        commit: () => Promise.resolve({ actId: "act-sample" }),
        onOpenChange: () => undefined,
        onCommitted: () => undefined,
      }),
    );

    const line = await screen.findByTestId(TESTIDS.digestLine);
    expect(line.textContent, "consequence-digest-line holds exactly the digest, its label outside it (Decision I-43)").toBe(DIGEST);
  });

  test("AC-5: the confirm is the act-variant Button and commits exactly the rendered digest", async () => {
    const Dialog = await consequenceDialog();
    const carried: string[] = [];
    const committed: { actId: string }[] = [];
    render(
      React.createElement(Dialog, {
        open: true,
        actType: ACT_TYPE,
        preview: () => Promise.resolve({ consequence: CONSEQUENCE, consequenceDigest: DIGEST }),
        commit: ({ consequenceDigest }) => {
          carried.push(consequenceDigest);
          return Promise.resolve({ actId: "act-sample" });
        },
        onOpenChange: () => undefined,
        onCommitted: (answer) => {
          committed.push(answer);
        },
      }),
    );

    const confirm = await screen.findByTestId(TESTIDS.confirm);
    expect(confirm.getAttribute("data-variant"), "the confirm of every ConsequenceDialog is the act variant (R-UI-010, Decision §1)").toBe("act");
    expect(confirm.getAttribute("data-digest"), "the confirm carries the digest it would commit (Decision §1)").toBe(DIGEST);

    await activator().click(confirm);

    expect(carried, "activating the confirm invokes commit({ consequenceDigest }) with exactly the rendered digest (R-UI-021)").toEqual([DIGEST]);
    expect(committed.map((answer) => answer.actId), "and the act the commit answered is handed to onCommitted").toEqual(["act-sample"]);
  });

  test("AC-5: while the preview is pending there is no consequence, no digest line and no way to commit", async () => {
    const Dialog = await consequenceDialog();
    let committedWithoutAConsequence = 0;
    render(
      React.createElement(Dialog, {
        open: true,
        actType: ACT_TYPE,
        // Never resolves: the pending state, held open for as long as the assertions need it.
        preview: () => new Promise<PreviewAnswer>(() => undefined),
        commit: () => {
          committedWithoutAConsequence += 1;
          return Promise.resolve({ actId: "act-sample" });
        },
        onOpenChange: () => undefined,
        onCommitted: () => undefined,
      }),
    );

    const dialog = await screen.findByTestId(TESTIDS.dialog);
    expect(within(dialog).queryByTestId(TESTIDS.digestLine), "no digest line stands while the preview is pending (Decision §1)").toBeNull();
    expect(screen.queryByTestId(TESTIDS.confirm), "the confirm is UNMOUNTED, not disabled, while no consequence is rendered (AC-5)").toBeNull();
    expect(screen.queryAllByTestId(TESTIDS.subjectRow), "and no subject row either").toEqual([]);
    expect(committedWithoutAConsequence, "there is no path to commit without a rendered consequence and digest line").toBe(0);
  });

  test("AC-5: the pattern is catalogued, so the gallery stays complete (R-UI-011)", async () => {
    await consequenceDialog();
    expect(Object.keys(galleryBarrels), `${BARREL_ID} is a barrel the gallery reflects over`).toContain(BARREL_ID);
    expect(Object.keys(galleryEntries), "the catalogue holds an entry for the pattern the increment ships").toContain(`${BARREL_ID}/${EXPORT_NAME}`);
    expect(missingEntries(), "a component export without a gallery entry fails this test — the completeness surface is derived (R-UI-011, B-19)").toEqual([]);
    expect(UNDECLARED_PROPS, "the prop set is the six the increment declares and nothing more").toEqual([]);
  });
});

/* ------------------------------------------------------------------ DLG-1: the dialog speaks QS */

/** The act the walk found speaking its enum: a third storey-height reading on GF. */
const HEIGHT_ACT = "AUTHOR_STOREY_HEIGHT";

/**
 * GF agreed at 3.3528 m over two readings, and a third, entered at 3.2 m, that would suspend it —
 * the walk's own case (walk-0, levels). Authored here, so every word asserted below is derived from
 * THIS data rather than frozen.
 */
const HEIGHT_CONSEQUENCE = {
  actType: HEIGHT_ACT,
  tenantId: "tenant-sample",
  projectId: "project-sample",
  rendering: "SUBJECTS",
  subjects: [
    {
      subjectId: "level-gf:user:ENTERED:",
      subjectLabel: "GF",
      before: [],
      after: ["3.2"],
      standing: {
        before: { standing: "AGREED", value: "3.3528", unit: "m", readings: 2 },
        after: { standing: "SUSPENDED", value: null, unit: "m", readings: 3 },
        recorded: { value: "3.2", unit: "m" },
      },
    },
  ],
  effects: { linesRederiving: ["line-1", "line-2"], signaturesVoiding: [] },
} as const;

/**
 * The frame's conventions, marked, so a figure that reached the screen without passing through the
 * document's own seam would show as the bare decimal it arrived as.
 */
const MARKED: FigureFormat = { figure: (value) => `‹${value}›`, money: (amount) => amount, date: () => "" };

/** What a surface shows on its face: its text with every CLOSED disclosure inside it taken out. */
function faceOf(node: HTMLElement): string {
  const face = node.cloneNode(true) as HTMLElement;
  for (const disclosure of Array.from(face.querySelectorAll("details"))) {
    if (!(disclosure as HTMLDetailsElement).open) disclosure.remove();
  }
  return face.textContent ?? "";
}

/** The storey-height dialog's props, for one opening or another. */
function heightProps(open: boolean): DialogProps {
  return {
    open,
    actType: HEIGHT_ACT,
    preview: () => Promise.resolve({ consequence: HEIGHT_CONSEQUENCE, consequenceDigest: DIGEST }),
    commit: () => Promise.resolve({ actId: "act-sample" }),
    onOpenChange: () => undefined,
    onCommitted: () => undefined,
  };
}

/** The dialog inside the frame's conventions, as a screen mounts it. */
function framed(Dialog: React.ComponentType<DialogProps>, open: boolean): React.ReactElement {
  return React.createElement(FigureProvider, { format: MARKED }, React.createElement(Dialog, heightProps(open)));
}

/** The dialog open over the storey-height consequence, its consequence rendered. */
async function openOverHeight(): Promise<HTMLElement> {
  const Dialog = await consequenceDialog();
  render(framed(Dialog, true));
  await screen.findByTestId(TESTIDS.confirm);
  return screen.getByTestId(TESTIDS.dialog);
}

describe("DLG-1: the ConsequenceDialog speaks a quantity surveyor's words", () => {
  test("I-444: the act is named in the words its door uses, and its enum is on no face of the dialog", async () => {
    const dialog = await openOverHeight();
    const face = faceOf(dialog);
    expect(face, "the act as a person reads it (R-UI-082)").toContain(strings.consequence_dialog_act_author_storey_height);
    expect(face, `the enum ${HEIGHT_ACT} is not body text (walk-0: the eyebrow read AUTHOR_STOREY_HEIGHT)`).not.toContain(HEIGHT_ACT);
    expect(dialog.getAttribute("data-act-type"), "the wrapper still publishes the enum for a machine (Decision §7)").toBe(HEIGHT_ACT);
    expect(dialog.textContent ?? "", "and the Details disclosure still states it, whole").toContain(HEIGHT_ACT);
  });

  test("I-445: before and after say the STANDING, with the figure, its unit and the readings behind it", async () => {
    const dialog = await openOverHeight();
    const row = within(dialog).getByTestId(TESTIDS.subjectRow);
    expect(row.getAttribute("data-standing-before"), "the row publishes the standing it holds now").toBe("AGREED");
    expect(row.getAttribute("data-standing-after"), "and the one it would hold").toBe("SUSPENDED");

    const { before, after } = columnsOf(row.textContent ?? "");
    expect(before, "before: the level is agreed…").toContain(strings.consequence_dialog_standing_agreed);
    expect(before, "…at its exact metres and in its unit, through the document's conventions (walk-0: 'Before: none')").toContain("‹3.3528›m");
    expect(before, "…over two readings").toContain(fill(strings.consequence_dialog_standing_readings, { count: "‹2›" }));
    expect(after, "after: a third reading that disagrees suspends it").toContain(strings.consequence_dialog_standing_suspended);
    expect(after, "and says why, in a count").toContain(fill(strings.consequence_dialog_standing_disagree, { count: "‹3›" }));
    expect(row.textContent ?? "", "the figure the act records stands under the columns, with its unit (walk-0: 'After: 3.2', no unit)").toContain(
      `${strings.consequence_dialog_standing_recorded}‹3.2›m`,
    );
  });

  test("I-447: the digest stands behind a closed Details disclosure, whole, and the confirm still carries it", async () => {
    const dialog = await openOverHeight();
    const line = within(dialog).getByTestId(TESTIDS.digestLine);
    expect(line.textContent, "the digest line still holds exactly the digest (I-43)").toBe(DIGEST);
    const disclosure = line.closest("details");
    expect(disclosure, "the digest line stands inside a disclosure (R-UI-082: a 64-hex digest is never body text)").not.toBeNull();
    expect((disclosure as HTMLDetailsElement).open, "closed until a person asks for it").toBe(false);
    expect(faceOf(dialog), "so the face of the dialog holds no digest").not.toContain(DIGEST);
    expect(within(dialog).getByTestId(TESTIDS.confirm).getAttribute("data-digest"), "the confirm carries it regardless (R-UI-021)").toBe(DIGEST);

    await activator().click(within(dialog).getByTestId(TESTIDS.details));
    expect((disclosure as HTMLDetailsElement).open, "one press on Details opens it").toBe(true);
    expect(faceOf(dialog), "and the digest is then read whole").toContain(DIGEST);
  });

  test("I-448: closing the dialog returns focus to the door that opened it", async () => {
    const Dialog = await consequenceDialog();
    const door = document.createElement("button");
    door.textContent = "Preview this height";
    document.body.append(door);
    door.focus();

    const shown = render(framed(Dialog, true));
    await screen.findByTestId(TESTIDS.confirm);
    expect(document.activeElement, "while open, focus is inside the dialog").not.toBe(door);

    act(() => {
      shown.rerender(framed(Dialog, false));
    });
    await waitFor(() => {
      expect(document.activeElement, "on close, focus is back on the door (walk-0: it fell to BODY; R-UI-060)").toBe(door);
    });
    door.remove();
  });

  test("I-447: the consequence's own form is catalogued in the states a reader meets it in (R-UI-011)", () => {
    const entry = galleryEntries[`${BARREL_ID}/ConsequenceSummary`];
    expect(entry, "the inline form S-Measure's card reuses has its own gallery entry").toBeDefined();
    expect((entry?.states ?? []).map((state) => state.name), "open on the page, in each state the Decision's § 7 samples — DLG-2 adds the counted discipline change and the pin").toEqual(["suspends", "settles", "first-reading", "roles", "disciplines", "pin"]);
  });
});
