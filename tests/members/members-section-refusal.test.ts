// @vitest-environment jsdom
/**
 * The members surface's refusal, in place (R-UI-020, R-SPINE-006): a move the server refuses is
 * answered on the row that asked, through the one RefusalState, with the register's own code,
 * message and remedy and a link to the evidence that resolves it — and the roster is unchanged,
 * because a refusal is an answer rather than a mutation.
 *
 * The section is mounted with the settlement of this file's choosing (the RulesetSettingsSection
 * precedent), so what is graded is the screen's own behaviour and not the server's. Nothing here is
 * transcribed: the codes are read off the register, and the sentences are read off the entries.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { createElement } from "react";
import { act } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { REFUSALS, refusalOf } from "../../src/core/errors";
import { MembersSection, type MembersRow } from "../../src/app/(app)/t/[tenant]/settings/members/members-section";
import {
  TESTIDS,
  REFUSAL_STATE_TESTID,
  REFUSAL_MESSAGE_TESTID,
  REFUSAL_REMEDY_TESTID,
  byTestId,
  memberRows,
  readText,
  refusalCodesIn,
  type ReadableRoot,
} from "./support/members-page";

const TENANT = "t_members_refusal";

/** Two memberships, so "the row that asked" is a claim the other row can falsify. */
const ROWS: readonly MembersRow[] = [
  { userId: "u_owner", label: "owner@example.test", role: "OWNER", history: [] },
  { userId: "u_member", label: "member@example.test", role: "MEMBER", history: [] },
];

/** The refusals the guards register for the two moves this screen makes. */
const REMOVAL_REFUSALS = ["WORKSPACE_WOULD_HAVE_NO_OWNER", "SELF_REMOVAL_NOT_ALLOWED", "MEMBER_HAS_ACTS"] as const;
const ROLE_REFUSAL = "WORKSPACE_PERMISSION_NOT_HELD";

const norm = (value: string): string => value.replace(/\s+/g, " ").trim();

afterEach(() => {
  cleanup();
});

/** Mount the section over a settlement that refuses every move with one code. */
function mountRefusing(code: string): HTMLElement {
  const refuse = async (): Promise<{ moved: false; refusal: typeof code }> => ({ moved: false, refusal: code });
  const { container } = render(
    createElement(MembersSection, {
      tenantId: TENANT,
      rows: ROWS,
      roles: ["OWNER", "ADMIN", "MEMBER"],
      // The settlement's shape is the actions' own; this file states only what it answers.
      changeRole: refuse as never,
      remove: refuse as never,
    }),
  );
  return container;
}

/** Submit one row's form and let the answer land. */
async function submitIn(row: ReadableRoot, testId: string): Promise<void> {
  const form = byTestId(row, testId)[0] as unknown as HTMLFormElement | undefined;
  expect(form, `the row renders ${testId}`).toBeDefined();
  if (form === undefined) return;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("R-UI-020: a refused move is answered in place, by the one renderer", () => {
  for (const code of [...REMOVAL_REFUSALS, ROLE_REFUSAL]) {
    test(`${code} renders in place with its registered code, message and remedy`, async () => {
      const container = mountRefusing(code);
      const rows = memberRows(container);
      expect(rows.length, "the roster renders both memberships").toBe(ROWS.length);

      const asking = rows[1];
      const bystander = rows[0];
      expect(asking, "the second row is the one that asks").toBeDefined();
      if (asking === undefined || bystander === undefined) return;
      await submitIn(asking, code === ROLE_REFUSAL ? TESTIDS.roleForm : TESTIDS.removeForm);

      const slots = byTestId(container, TESTIDS.refusal);
      expect(slots.length, "one answer slot stands, on the row that asked (R-UI-020: never a toast, never silence)").toBe(1);
      expect(byTestId(asking, TESTIDS.refusal).length, "the slot is inside the row that asked").toBe(1);
      expect(byTestId(bystander, TESTIDS.refusal).length, "no other row answers a question it did not ask").toBe(0);

      const slot = slots[0];
      if (slot === undefined) return;
      expect(refusalCodesIn(slot), "the refusal publishes the register's own code, machine-readably").toEqual([code]);
      const rendered = byTestId(slot, REFUSAL_STATE_TESTID)[0];
      expect(rendered, "the refusal is drawn by the one shipped RefusalState (B-17)").toBeDefined();
      if (rendered === undefined) return;
      const entry = refusalOf(code as keyof typeof REFUSALS);
      expect(readText(byTestId(rendered, REFUSAL_MESSAGE_TESTID)[0] ?? null), "the register's own message, verbatim").toBe(norm(entry.message));
      expect(readText(byTestId(rendered, REFUSAL_REMEDY_TESTID)[0] ?? null), "the register's own remedy, verbatim").toBe(norm(entry.remedy));
      expect(slot.querySelectorAll("a").length, "the refusal carries a link to the evidence that resolves it (R-UI-020)").toBeGreaterThan(0);

      // The roster is what a refusal leaves alone, and the control that asked is never disarmed.
      const after = memberRows(container);
      expect(after.map((row) => readText(byTestId(row, TESTIDS.rowRole)[0] ?? null)), "a refusal moves nothing").toEqual(ROWS.map((row) => row.role));
      const submit = byTestId(asking, code === ROLE_REFUSAL ? TESTIDS.roleSubmit : TESTIDS.removeSubmit)[0] as unknown as HTMLButtonElement | undefined;
      expect(submit?.disabled, "a retry is never disarmed after a refusal").toBe(false);
    });
  }

  test("both forms render on every row, whatever role the reader holds (R-SPINE-006: never UI hiding)", () => {
    const container = mountRefusing(ROLE_REFUSAL);
    for (const row of memberRows(container)) {
      expect(byTestId(row, TESTIDS.roleForm).length, "every row offers the role form").toBe(1);
      expect(byTestId(row, TESTIDS.removeForm).length, "every row offers the removal form").toBe(1);
      expect(byTestId(row, TESTIDS.roleHistory).length, "every row carries its record").toBe(1);
    }
    expect(byTestId(container, TESTIDS.refusal).length, "no answer slot stands before anything is asked").toBe(0);
  });
});
