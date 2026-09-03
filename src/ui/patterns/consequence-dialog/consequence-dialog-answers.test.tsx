// @vitest-environment jsdom
/**
 * The two answers a commit can come back with, and what R-UI-021 says the dialog does with each
 * (docs/design/consequence-dialog.md I-40, I-44):
 *
 *   - a stale digest is answered by RE-RENDER, never by a refusal card — the notice mounts, the
 *     superseded consequence, digest line and confirm unmount at once, `preview()` is invoked again
 *     and the fresh digest is what the confirm then carries;
 *   - every other refusal renders in the slot, by the one RefusalState, with the consequence still
 *     standing and the confirm still enabled: a retry is never disarmed (R-UI-020).
 *
 * Everything is observed through the pattern's own closed contract (Decision § 7) and through the
 * six props it declares. The digests are authored here, so what is asserted is the digest THIS test
 * supplied — never a computed one, and never a frozen string the component could also be holding.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { ConsequenceDialog } from "./index";
import type { RefusalEntry } from "../../../core/errors";

const ACT_TYPE = "ASSIGN_PARTICIPANT_ROLE";

/** Two authored digests: sample data of the shape a sha-256 digest wears, never computed ones. */
const STALE_DIGEST = "1111111111111111111111111111111111111111111111111111111111111111";
const FRESH_DIGEST = "2222222222222222222222222222222222222222222222222222222222222222";

const SUBJECT = { subjectId: "user-principal", before: ["PRINCIPAL"], after: ["MEASURER", "PRINCIPAL"] };

// The rendering is the Consequence's own, named and never defaulted by the body (L-ACT-02).
const consequenceOf = (): unknown => ({
  actType: ACT_TYPE,
  tenantId: "tenant-sample",
  projectId: "project-sample",
  rendering: "SUBJECTS",
  subjects: [SUBJECT],
});

/**
 * A refusal as the consumer's wrapper rejects with it (I-40): the registered entry and the evidence
 * that resolves it. The entries are authored here — this file judges what the dialog DOES with a
 * refusal, not what any particular code's registered copy says.
 */
const entry = (code: string): RefusalEntry =>
  ({ code, message: `${code} message`, remedy: `${code} remedy`, severity: "warning", surface: "dialog" }) as RefusalEntry;

const rejection = (code: string): unknown => ({ refusal: entry(code), evidence: { href: "/somewhere", label: "Resolve it" } });

/** An open dialog is a modal, and the page says so; a real activation is what these cases measure. */
const activator = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ pointerEventsCheck: 0 } as Parameters<typeof userEvent.setup>[0]);

afterEach(() => {
  cleanup();
});

describe("R-UI-021: a stale digest re-renders the dialog with what changed", () => {
  test("the stale notice mounts, the preview runs again, and the confirm carries the fresh digest", async () => {
    const digests = [STALE_DIGEST, FRESH_DIGEST];
    const carried: string[] = [];
    let previews = 0;

    render(
      <ConsequenceDialog
        open
        actType={ACT_TYPE}
        preview={() => {
          previews += 1;
          return Promise.resolve({ consequence: consequenceOf(), consequenceDigest: digests[previews - 1] ?? FRESH_DIGEST } as never);
        }}
        commit={({ consequenceDigest }) => {
          carried.push(consequenceDigest);
          // The first commit is the stale one; a commit of the recomputed digest is carried out.
          return consequenceDigest === STALE_DIGEST ? Promise.reject(rejection("CONSEQUENCES_NOT_CARRIED")) : Promise.resolve({ actId: "act-sample" });
        }}
        onOpenChange={() => undefined}
        onCommitted={() => undefined}
      />,
    );

    const first = await screen.findByTestId("consequence-confirm");
    expect(first.getAttribute("data-digest"), "the first confirm carries the digest the first preview answered").toBe(STALE_DIGEST);
    await activator().click(first);

    const notice = await screen.findByTestId("consequence-stale-notice");
    expect(notice.getAttribute("role"), "mounting is the announcement (refusal-state I-7's duty)").toBe("alert");
    expect(within(await screen.findByTestId("consequence-dialog")).queryByTestId("refusal-state"), "a stale digest is answered by re-render, never by a refusal card (I-44)").toBeNull();

    const line = await screen.findByTestId("consequence-digest-line");
    expect(line.textContent, "the recomputed digest is what now stands").toBe(FRESH_DIGEST);
    expect(previews, "the dialog recomputed its own preview rather than reusing the superseded one").toBe(2);

    const second = await screen.findByTestId("consequence-confirm");
    expect(second.getAttribute("data-digest"), "and the confirm carries the fresh digest, never the one the state no longer produces").toBe(FRESH_DIGEST);
    await activator().click(second);
    expect(carried, "the retry commits the recomputed digest").toEqual([STALE_DIGEST, FRESH_DIGEST]);
  });
});

describe("R-UI-020: every other refusal renders in the slot, and the retry is never disarmed", () => {
  test("the injected entry renders through the one RefusalState, beside the standing consequence", async () => {
    render(
      <ConsequenceDialog
        open
        actType={ACT_TYPE}
        preview={() => Promise.resolve({ consequence: consequenceOf(), consequenceDigest: FRESH_DIGEST } as never)}
        commit={() => Promise.reject(rejection("ACT_CHANGES_NOTHING"))}
        onOpenChange={() => undefined}
        onCommitted={() => undefined}
      />,
    );

    const confirm = await screen.findByTestId("consequence-confirm");
    await activator().click(confirm);

    const dialog = await screen.findByTestId("consequence-dialog");
    const refusal = await within(dialog).findByTestId("refusal-state");
    expect(refusal.getAttribute("data-code"), "the code travels machine-readably, and is never copy").toBe("ACT_CHANGES_NOTHING");
    expect(refusal.textContent, "the registered message is what a person reads").toContain("ACT_CHANGES_NOTHING message");
    expect(refusal.textContent, "…with the remedy beside it").toContain("ACT_CHANGES_NOTHING remedy");
    expect(within(dialog).queryByTestId("consequence-stale-notice"), "a refusal that is not staleness mounts no stale notice").toBeNull();

    expect(within(dialog).queryByTestId("consequence-digest-line")?.textContent, "the consequence still stands behind the answer").toBe(FRESH_DIGEST);
    const retry = await screen.findByTestId("consequence-confirm");
    expect(retry.getAttribute("aria-disabled"), "a retry is never disarmed by a refusal (R-UI-020)").toBeNull();
  });
});
