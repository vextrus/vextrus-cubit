// @vitest-environment jsdom
/**
 * s-settings-site-facts I-527 — "Entered by" is a person. Gate 2's `fact-entered` capture showed the
 * column heading "Entered by" over an identifier chip (`1a42c54`): the act's id, where the reader
 * looks for who entered the ground level. The cell now names the person who performed the entry's
 * act, as the project's roster names them (participants I-51, s-documents I-348's "the issuer is a
 * person"), with the act's id still whole on `data-value`; where the roster names nobody for that act,
 * the act stands through the one IdChip as before (R-UI-082).
 *
 * The panel is mounted with the SHIPPED renderers through the stage the panel suite uses (B-17), and
 * `siteFactEntrants` — the one step between the page's two reads and the panel — is judged on its own.
 */
import { afterEach, describe, expect, test } from "vitest";
import type { Consequence } from "../../../src/core/acts";
import type { StandingSiteFact } from "../../../src/core/site-facts/law";
import { siteFactEntrants } from "../../../src/app/(app)/t/[tenant]/p/[project]/settings/site-facts/entrants";
import { TESTIDS } from "../../../src/ui/testids";
import { cleanup, fireEvent, mountSiteFactsPanel, screen, STAGED_PROJECT, STAGED_TENANT, waitFor, within } from "./support/site-facts-panel-stage";

afterEach(() => {
  cleanup();
});

const GROUND: StandingSiteFact = {
  fact: "GROUND_LEVEL",
  valueAsWritten: "-1.2",
  unitAsWritten: "m",
  canonicalMetres: "-1.2",
  sourceNote: "Survey sheet S-01",
  actId: "11111111-1111-4111-8111-111111111111",
  enteredAt: "2026-09-01T09:00:00.000Z",
};
const WATER: StandingSiteFact = {
  fact: "WATER_TABLE",
  valueAsWritten: "-3.5",
  unitAsWritten: "m",
  canonicalMetres: "-3.5",
  sourceNote: "Borehole log BH-2",
  actId: "22222222-2222-4222-8222-222222222222",
  enteredAt: "2026-09-02T09:00:00.000Z",
};

const SURVEYOR = { userId: "00000000-0000-4000-8000-0000000000c1", label: "rahim.uddin@sattva-projects.test" };
const READER = { userId: "00000000-0000-4000-8000-0000000000c2", label: "nasrin.akter@sattva-projects.test" };

/** The row of one fact, found by the fact it states, never by order. */
function rowOf(fact: string): HTMLElement {
  const row = screen.getAllByTestId(TESTIDS.siteFacts.row).find((element) => element.getAttribute("data-fact") === fact);
  expect(row, `the panel renders a row for ${fact}`).toBeTruthy();
  return row as HTMLElement;
}

/** The Entered-by cell of a row — the element the registry calls `site-facts-row-act`. */
const enteredByOf = (fact: string): HTMLElement => within(rowOf(fact)).getByTestId(TESTIDS.siteFacts.rowAct);

describe("I-527: the Entered-by cell names the person who entered the fact", () => {
  test("a fact whose act the roster names reads the person's name, the act still whole on data-value", () => {
    mountSiteFactsPanel({ standing: { GROUND_LEVEL: GROUND }, enteredBy: { byAct: { [GROUND.actId]: SURVEYOR.label }, reader: READER.label } });

    const cell = enteredByOf("GROUND_LEVEL");
    expect(cell.textContent, "the person, by the roster's name for them").toBe(SURVEYOR.label);
    expect(cell.getAttribute("title"), "whole on the tooltip past the column's measure (R-UI-083)").toBe(SURVEYOR.label);
    expect(cell.getAttribute("data-value"), "and the row still names the act that entered it (AM-06 §1, L-ACT-01)").toBe(GROUND.actId);
    expect(cell.classList.contains("cx-id-chip"), "a person is not drawn as an identifier chip").toBe(false);
    expect(screen.getByTestId(TESTIDS.siteFacts.screen).textContent ?? "", "the act's id is body text nowhere (R-UI-082)").not.toContain(GROUND.actId);
  });

  test("a fact whose act the roster names nobody for keeps the act's chip — an identity, never a guess", () => {
    mountSiteFactsPanel({ standing: { GROUND_LEVEL: GROUND, WATER_TABLE: WATER }, enteredBy: { byAct: { [GROUND.actId]: SURVEYOR.label }, reader: null } });

    expect(enteredByOf("GROUND_LEVEL").textContent).toBe(SURVEYOR.label);
    const chip = enteredByOf("WATER_TABLE");
    expect(chip.classList.contains("cx-id-chip"), "the shipped IdChip stands for an act the roster cannot name").toBe(true);
    expect(chip.getAttribute("data-value"), "carrying the recorded act whole").toBe(WATER.actId);
  });

  test("a mount that hands in no names shows every entered fact's act chip (the panel's default)", () => {
    mountSiteFactsPanel({ standing: { GROUND_LEVEL: GROUND } });
    expect(enteredByOf("GROUND_LEVEL").classList.contains("cx-id-chip")).toBe(true);
  });

  test("an act this panel carried names the reader who performed it, before any read has named it", async () => {
    const ACT_ID = "33333333-3333-4333-8333-333333333333";
    const consequence: Consequence = {
      actType: "AUTHOR_SITE_FACT",
      tenantId: STAGED_TENANT,
      projectId: STAGED_PROJECT,
      rendering: "SUBJECTS",
      subjects: [{ subjectId: "GROUND_LEVEL", before: [], after: ["-1.2"] }],
      effects: { linesRederiving: [], signaturesVoiding: [] },
    };
    mountSiteFactsPanel({
      standing: {},
      enteredBy: { byAct: {}, reader: READER.label },
      preview: () => Promise.resolve({ previewed: true as const, consequence, consequenceDigest: "4".repeat(64) }),
      commit: () => Promise.resolve({ committed: true as const, actId: ACT_ID }),
    });

    fireEvent.click(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.enter));
    fireEvent.change(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.value), { target: { value: "-1.2" } });
    fireEvent.change(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.sourceNote), { target: { value: "Survey sheet S-01" } });
    fireEvent.click(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.submit));
    fireEvent.click(await waitFor(() => within(screen.getByTestId(TESTIDS.consequence.dialog)).getByTestId(TESTIDS.consequence.confirm)));

    await waitFor(() => expect(rowOf("GROUND_LEVEL").getAttribute("data-basis")).toBe("ENTERED"));
    const cell = enteredByOf("GROUND_LEVEL");
    expect(cell.textContent, "the reader performed the act, so the row names the reader").toBe(READER.label);
    expect(cell.getAttribute("data-value"), "and the act the commit answered").toBe(ACT_ID);
  });
});

describe("I-527: siteFactEntrants — the act log's actors, named by the project roster", () => {
  const actors = { [GROUND.actId]: SURVEYOR.userId, [WATER.actId]: "00000000-0000-4000-8000-0000000000c9" };
  const people = { [SURVEYOR.userId]: SURVEYOR.label, [READER.userId]: READER.label };

  test("each act the roster can name the performer of is named; an actor it does not name is left out", () => {
    const named = siteFactEntrants(actors, people, READER.userId);
    expect(named.byAct).toEqual({ [GROUND.actId]: SURVEYOR.label });
  });

  test("the reader is named by the roster's name for them, and by nothing where it names nobody", () => {
    expect(siteFactEntrants(actors, people, READER.userId).reader).toBe(READER.label);
    expect(siteFactEntrants(actors, {}, READER.userId), "a refused roster names nobody").toEqual({ byAct: {}, reader: null });
  });
});
