// @vitest-environment jsdom
/**
 * The Site facts panel as it renders (docs/design/s-settings-site-facts.md § 2, AM-06 §1): what a
 * standing fact looks like on its own row, where a refused preview is answered, and the rule that
 * every word on the panel comes from the copy table beside it.
 *
 * The panel is mounted through the tree's own mount contract with the SHIPPED renderers — the one
 * RefusalState, the one ConsequenceDialog, IdChip, NumberInput — so what is judged here is the
 * screen a reader gets, not a stand-in for it (B-17, R-UI-020, R-UI-021).
 */
import { afterEach, describe, expect, test } from "vitest";
import type { Consequence } from "../../../src/core/acts";
import { SITE_FACTS, type SiteFact, type StandingSiteFact } from "../../../src/core/site-facts/law";
import { fillSiteFacts, siteFactsStrings } from "../../../src/modules/takeoff/site-facts-ui/strings";
import { TESTIDS } from "../../../src/ui/testids";
import { cleanup, fireEvent, mountSiteFactsPanel, screen, STAGED_PROJECT, STAGED_TENANT, waitFor, within } from "./support/site-facts-panel-stage";

// One panel at a time: a mount left standing would answer the next case's clicks from the last
// case's doors.
afterEach(() => {
  cleanup();
});

/** Two facts already entered, from two different acts: the ledger's own shape (`standingSiteFacts`). */
const GROUND: StandingSiteFact = {
  fact: "GROUND_LEVEL",
  valueAsWritten: "-1.2",
  unitAsWritten: "m",
  canonicalMetres: "-1.2",
  sourceNote: "Survey sheet S-01",
  actId: "11111111-1111-4111-8111-111111111111",
  enteredAt: "2026-09-01T09:00:00.000Z",
};
const BLINDING: StandingSiteFact = {
  fact: "BLINDING_THICKNESS",
  valueAsWritten: "75",
  unitAsWritten: "mm",
  canonicalMetres: "0.075",
  sourceNote: "Structural note 12",
  actId: "22222222-2222-4222-8222-222222222222",
  enteredAt: "2026-09-02T09:00:00.000Z",
};

/**
 * What the act's door answers when it is asked about an entry that stands: the typed Consequence the
 * server computes (one subject, the fact judged) and the digest that binds it. Authored here — this
 * file judges what the PANEL does with an answer, never what the seam computes (that is AC-2's, live).
 */
const DIGEST = "4444444444444444444444444444444444444444444444444444444444444444";
const CONSEQUENCE: Consequence = {
  actType: "AUTHOR_SITE_FACT",
  tenantId: STAGED_TENANT,
  projectId: STAGED_PROJECT,
  rendering: "SUBJECTS",
  subjects: [{ subjectId: "GROUND_LEVEL", before: [], after: ["-1.2"] }],
  effects: { linesRederiving: [], signaturesVoiding: [] },
};

/** The row of one fact, found the way the journey finds it: by the fact it states, never by order. */
function rowOf(fact: SiteFact): HTMLElement {
  const row = screen.getAllByTestId(TESTIDS.siteFacts.row).find((element) => element.getAttribute("data-fact") === fact);
  expect(row, `the panel renders a row for ${fact}`).toBeTruthy();
  return row as HTMLElement;
}

describe("the Site facts panel's rows (AM-06 §1, § 2 Ready)", () => {
  test("a standing fact reads entered on its own row and nowhere else, each naming its act", () => {
    mountSiteFactsPanel({ standing: { GROUND_LEVEL: GROUND, BLINDING_THICKNESS: BLINDING } });

    const rendered = screen.getAllByTestId(TESTIDS.siteFacts.row).map((row) => row.getAttribute("data-fact"));
    expect(rendered, "the roster renders whole, in its own order (B-19)").toEqual([...SITE_FACTS]);

    for (const held of [GROUND, BLINDING]) {
      const row = rowOf(held.fact);
      expect(row.getAttribute("data-basis"), `${held.fact} stands ENTERED (R-UI-002)`).toBe("ENTERED");
      expect(within(row).getByTestId(TESTIDS.siteFacts.rowValue).textContent, "the reading AS WRITTEN, in the unit it was written in (L-QTY-03)").toBe(
        fillSiteFacts(siteFactsStrings.site_facts_row_value, { value: held.valueAsWritten, unit: held.unitAsWritten }),
      );
      expect(within(row).getByTestId(TESTIDS.siteFacts.rowSource).textContent, "the note it was read from, verbatim").toBe(held.sourceNote);
      // R-UI-082: the act id is a chip — the whole value in the DOM, the short form on screen.
      const chip = within(row).getByTestId(TESTIDS.siteFacts.rowAct);
      expect(chip.getAttribute("data-value"), `${held.fact} names the act that entered it (L-ACT-01)`).toBe(held.actId);
      expect(chip.textContent ?? "", "and never as body text").not.toContain(held.actId);
      expect(screen.getByTestId(TESTIDS.siteFacts.screen).textContent ?? "", "nowhere on the panel as body text (R-UI-082)").not.toContain(held.actId);
      expect(within(row).queryByTestId(TESTIDS.siteFacts.rowDeferral), "an entered fact is deferred under nothing").toBeNull();
    }

    for (const fact of SITE_FACTS.filter((name) => name !== GROUND.fact && name !== BLINDING.fact)) {
      const row = rowOf(fact);
      expect(row.getAttribute("data-basis"), `${fact} is absent, which is no basis at all (I-275)`).toBe("ABSENT");
      expect(within(row).getAllByTestId(TESTIDS.refusal.state).length, `${fact} keeps its named deferral (AM-06 §1)`).toBe(1);
      expect(within(row).queryByTestId(TESTIDS.siteFacts.rowValue), "and states no figure of its own").toBeNull();
      expect(within(row).queryByTestId(TESTIDS.siteFacts.rowAct), "and names no act").toBeNull();
    }
  });
});

describe("the Site facts panel's act door (R-UI-021, R-UI-020)", () => {
  test("a refused preview is answered inside the consequence dialog, and nowhere else", async () => {
    mountSiteFactsPanel({
      standing: {},
      preview: () => Promise.resolve({ previewed: false as const, refusal: "SITE_FACT_SOURCE_UNSTATED" as const }),
    });

    const row = rowOf("GROUND_LEVEL");
    fireEvent.click(within(row).getByTestId(TESTIDS.siteFacts.enter));
    fireEvent.change(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.value), { target: { value: "-1.2" } });
    fireEvent.click(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.submit));

    const refusal = await waitFor(() => {
      const dialog = screen.getByTestId(TESTIDS.consequence.dialog);
      return within(dialog).getByTestId(TESTIDS.refusal.state);
    });
    expect(refusal.getAttribute("data-code"), "the act's own door says why it refused, by name (R-UI-020)").toBe("SITE_FACT_SOURCE_UNSTATED");
    expect(within(refusal).getByTestId(TESTIDS.refusal.evidenceLink), "and always carries the way to resolve it").toBeTruthy();

    expect(
      within(screen.getByTestId(TESTIDS.siteFacts.refusal)).queryByTestId(TESTIDS.refusal.state),
      "the panel's own slot answers nothing the dialog is already answering — one refusal, one home",
    ).toBeNull();
    expect(
      screen.getAllByTestId(TESTIDS.refusal.state).filter((element) => element.getAttribute("data-code") === "SITE_FACT_SOURCE_UNSTATED").length,
      "and the refusal is not said twice",
    ).toBe(1);
  });

  test("the act carried stands on its own row, naming the act, while the other five keep their deferrals", async () => {
    const ACT_ID = "33333333-3333-4333-8333-333333333333";
    mountSiteFactsPanel({
      standing: {},
      preview: () =>
        Promise.resolve({
          previewed: true as const,
          consequence: CONSEQUENCE,
          consequenceDigest: DIGEST,
        }),
      commit: () => Promise.resolve({ committed: true as const, actId: ACT_ID }),
    });

    fireEvent.click(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.enter));
    fireEvent.change(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.value), { target: { value: "-1.2" } });
    fireEvent.change(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.sourceNote), { target: { value: "Survey sheet S-01" } });
    fireEvent.click(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.submit));

    const confirm = await waitFor(() => within(screen.getByTestId(TESTIDS.consequence.dialog)).getByTestId(TESTIDS.consequence.confirm));
    fireEvent.click(confirm);

    await waitFor(() => expect(rowOf("GROUND_LEVEL").getAttribute("data-basis")).toBe("ENTERED"));
    const row = rowOf("GROUND_LEVEL");
    expect(within(row).getByTestId(TESTIDS.siteFacts.rowValue).textContent, "the reading it was entered with").toBe(
      fillSiteFacts(siteFactsStrings.site_facts_row_value, { value: "-1.2", unit: "m" }),
    );
    expect(within(row).getByTestId(TESTIDS.siteFacts.rowSource).textContent, "the note it was read from").toBe("Survey sheet S-01");
    expect(within(row).getByTestId(TESTIDS.siteFacts.rowAct).getAttribute("data-value"), "and the act that entered it (L-ACT-01)").toBe(ACT_ID);
    expect(within(row).queryByTestId(TESTIDS.siteFacts.rowDeferral), "an entered fact is deferred under nothing").toBeNull();

    for (const fact of SITE_FACTS.filter((name) => name !== "GROUND_LEVEL")) {
      expect(rowOf(fact).getAttribute("data-basis"), `${fact} is untouched by an act about another fact (I-281)`).toBe("ABSENT");
      expect(within(rowOf(fact)).getAllByTestId(TESTIDS.refusal.state).length, `${fact} keeps its named deferral`).toBe(1);
    }
  });
});
