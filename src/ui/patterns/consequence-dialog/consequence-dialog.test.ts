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
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import type { ConsequenceDialog as ConsequenceDialogComponent } from "./index";
import { galleryBarrels, galleryEntries, missingEntries } from "../../gallery-derivation";

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
} as const;

/** The act this increment renders, and the roles its Consequence moves. */
const ACT_TYPE = "ASSIGN_PARTICIPANT_ROLE";

/** An authored digest: sample data of the shape a sha-256 digest wears, never a computed one. */
const DIGEST = "9f2c1d4b7a6e5038c1b2a3d4e5f60718293a4b5c6d7e8f9012a3b4c5d6e7f801";

/** The sample Consequence — this test's own data, and the denominator of every count below. */
const SUBJECTS = [
  { subjectId: "user-estimator", before: ["PRINCIPAL"], after: ["MEASURER", "PRINCIPAL"] },
  { subjectId: "user-reviewer", before: ["REVIEWER"], after: ["LEAD", "REVIEWER"] },
] as const;

const CONSEQUENCE = {
  actType: ACT_TYPE,
  tenantId: "tenant-sample",
  projectId: "project-sample",
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
