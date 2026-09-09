// @vitest-environment jsdom
/**
 * AC-4's pattern half — the two effect slots R-TO-020 asks an affirmation to preview: the lines that
 * would re-derive and the signatures that would void, computed by the server and carried on the
 * Consequence's own `effects` field (docs/design/consequence-dialog.md).
 *
 * The slots are a property of the CONSEQUENCE, not of the act type: a preview that carries `effects`
 * mounts both, and a preview that carries none — which is every act shipped before this increment —
 * mounts neither, so no existing dialog acceptance and no picture of one moves (B-20).
 *
 * Everything is observed through the pattern's own closed contract (Decision § 7) and through the six
 * props it declares; the effect payloads are authored here, so what is asserted is what THIS test
 * supplied rather than a frozen sentence the component could also be holding.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ConsequenceDialog } from "./index";
import { strings } from "../../strings";

const AFFIRM_SCALE = "AFFIRM_SCALE";
const DIGEST = "3333333333333333333333333333333333333333333333333333333333333333";

/** One subject of an affirmation: the view it names, before under no calibration and after under one. */
const SUBJECT = { subjectId: "v:PLAN:CAP-P", before: [], after: ["b3d1f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8"] };

/** The consequence a preview answers, with or without the derived effects an act's kind has (L-ACT-02). */
function consequenceOf(effects: { linesRederiving: string[]; signaturesVoiding: string[] } | null): unknown {
  const base = { actType: AFFIRM_SCALE, tenantId: "tenant-sample", projectId: "project-sample", rendering: "SUBJECTS", subjects: [SUBJECT] };
  return effects === null ? base : { ...base, effects };
}

/** The dialog opened over one preview, with no commit ever asked for. */
function open(effects: { linesRederiving: string[]; signaturesVoiding: string[] } | null): void {
  render(
    <ConsequenceDialog
      open
      actType={AFFIRM_SCALE}
      preview={() => Promise.resolve({ consequence: consequenceOf(effects), consequenceDigest: DIGEST } as never)}
      commit={() => Promise.resolve({ actId: "act-sample" })}
      onOpenChange={() => undefined}
      onCommitted={() => undefined}
    />,
  );
}

/** The one word an empty slot is said with, read from the one string table by key (R-SPINE-060). */
function none(): string {
  const line = (strings as unknown as Record<string, string>)["consequence_dialog_none"];
  expect(typeof line, "the one string table carries `consequence_dialog_none`").toBe("string");
  return line as string;
}

afterEach(() => {
  cleanup();
});

describe("AC-4: the two effect slots of an act whose consequence carries them", () => {
  test("AC-4: a preview carrying empty effects mounts both slots saying nothing is affected, and one carrying no effects mounts neither", async () => {
    open({ linesRederiving: [], signaturesVoiding: [] });
    const dialog = await screen.findByTestId("consequence-dialog");
    expect(dialog.getAttribute("data-act-type"), "the dialog is the act's own, named verbatim (R-UI-021)").toBe(AFFIRM_SCALE);

    for (const slot of ["consequence-effect-lines", "consequence-effect-signatures"]) {
      const held = within(dialog).getAllByTestId(slot);
      expect(held.length, `exactly one \`${slot}\` stands for a consequence that carries effects`).toBe(1);
      expect((held[0] as HTMLElement).textContent ?? "", `and an empty ${slot} says so rather than standing silent (R-UI-020)`).toContain(none());
    }

    // The same dialog over a consequence with no `effects` field at all — every act shipped before
    // this increment — mounts neither slot, so no existing acceptance and no picture of one moves.
    cleanup();
    open(null);
    const plain = await screen.findByTestId("consequence-dialog");
    expect(within(plain).queryAllByTestId("consequence-subject-row").length, "the consequence still renders as the subject list it is").toBe(1);
    for (const slot of ["consequence-effect-lines", "consequence-effect-signatures"]) {
      expect(within(plain).queryAllByTestId(slot).length, `an act whose consequence names no effects mounts no \`${slot}\` (B-20)`).toBe(0);
    }
  });

  test("AC-4: a preview carrying named effects renders each one whole, in its own slot", async () => {
    const lines = ["line:A-100", "line:A-101"];
    const signatures = ["sig:7f2c"];
    open({ linesRederiving: lines, signaturesVoiding: signatures });
    const dialog = await screen.findByTestId("consequence-dialog");

    const rendered = within(dialog).getByTestId("consequence-effect-lines").textContent ?? "";
    for (const line of lines) expect(rendered, `the lines that would re-derive are named whole (${line}, R-TO-020)`).toContain(line);
    expect(rendered, "and the slot does not say `none` when it names something").not.toContain(none());

    const voided = within(dialog).getByTestId("consequence-effect-signatures").textContent ?? "";
    for (const signature of signatures) expect(voided, `the signatures that would void are named whole (${signature}, R-TO-020)`).toContain(signature);
  });

});
