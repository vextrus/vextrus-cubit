// @vitest-environment jsdom
/**
 * The Site facts panel over the SAMPLE edition (docs/design/s-settings-site-facts.md I-327, L-MEA-06:
 * "site overrides, edition otherwise states").
 *
 * The craft look of session 7 found the panel deferring four facts the pinned edition states — the
 * working allowance, the depth extra and the blinding's projection and thickness — while the Rule set
 * screen one nav row away showed their values and the earthwork rail bound them from the edition
 * (`enteredOrDerived`). A refusal that is not true is the defect R-UI-020 names. These cases pin the
 * truth: over the seed edition a fresh project defers the ground level and the water table and
 * nothing else, the four stated facts read the edition's figures under DERIVED, and the face line
 * speaks of what is actually deferred.
 *
 * Nothing is transcribed (B-19): the roster is `SITE_FACTS`, the edition is the seed's own content,
 * and the facts an edition may state are the deferral map's own `statedByEdition`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { SEED_EDITION_CONTENT } from "../../../src/core/rulesets/seed";
import { SITE_FACTS, type SiteFact } from "../../../src/core/site-facts/law";
import { statedByEdition } from "../../../src/modules/takeoff/site-facts-ui/deferrals";
import { EDITION_PARAMETER_OF } from "../../../src/modules/takeoff/rails/foundations/read";
import { editionStatedFacts } from "../../../src/modules/takeoff/site-facts-ui/edition";
import { fillSiteFacts, siteFactsStrings } from "../../../src/modules/takeoff/site-facts-ui/strings";
import { TESTIDS } from "../../../src/ui/testids";
import { cleanup, fireEvent, mountSiteFactsPanel, screen, within } from "./support/site-facts-panel-stage";

afterEach(() => {
  cleanup();
});

/** The SAMPLE edition's statement of the site facts, read the way the page reads the pin. */
const SEED_STATED = editionStatedFacts(SEED_EDITION_CONTENT.parameters);

/** The rail's parameter for a fact, or undefined for a fact no rule set states. */
function editionParameterOf(fact: SiteFact): string | undefined {
  return (EDITION_PARAMETER_OF as Readonly<Partial<Record<SiteFact, string>>>)[fact];
}

function rowOf(fact: SiteFact): HTMLElement {
  const row = screen.getAllByTestId(TESTIDS.siteFacts.row).find((element) => element.getAttribute("data-fact") === fact);
  expect(row, `the panel renders a row for ${fact}`).toBeTruthy();
  return row as HTMLElement;
}

describe("what the pinned edition states of the site facts (I-327)", () => {
  test("the facts an edition may state are exactly the facts the rail reads from one", () => {
    expect(
      SITE_FACTS.filter((fact) => editionParameterOf(fact) !== undefined),
      "the edition map and the deferral map agree on which facts a rule set can state (I-B)",
    ).toEqual(SITE_FACTS.filter((fact) => statedByEdition(fact)));
  });

  test("the SAMPLE edition states the four earthwork lengths, at its own figures, and neither level", () => {
    for (const fact of SITE_FACTS) {
      const key = editionParameterOf(fact);
      if (key === undefined) {
        expect(SEED_STATED[fact], `${fact} is a fact about this ground, and no rule set states it`).toBeUndefined();
        continue;
      }
      const parameter = SEED_EDITION_CONTENT.parameters[key];
      expect(parameter, `the seed states ${key}`).toBeDefined();
      expect(SEED_STATED[fact], `${fact} reads the seed's own ${key}, verbatim`).toEqual({ value: parameter?.value, unit: parameter?.unit });
    }
  });
});

describe("the panel over the SAMPLE edition: only what the rail defers is deferred (R-UI-020)", () => {
  test("a fresh project defers the ground level and the water table; the four stated facts read DERIVED", () => {
    mountSiteFactsPanel({ standing: {}, editionStated: SEED_STATED });

    for (const fact of SITE_FACTS) {
      const row = rowOf(fact);
      const edition = SEED_STATED[fact];
      if (edition === undefined) {
        expect(row.getAttribute("data-basis"), `${fact}: nobody entered it and no edition states it`).toBe("ABSENT");
        expect(within(row).getAllByTestId(TESTIDS.siteFacts.rowDeferral).length, `${fact} keeps its named deferral`).toBe(1);
        expect(within(row).queryByTestId(TESTIDS.siteFacts.rowValue), `${fact} states no figure`).toBeNull();
      } else {
        expect(row.getAttribute("data-basis"), `${fact} is what the rail reads from the edition (L-MEA-06)`).toBe("DERIVED");
        expect(within(row).queryByTestId(TESTIDS.siteFacts.rowDeferral), `${fact} is deferred under nothing — the rail defers nothing for it`).toBeNull();
        expect(within(row).getByTestId(TESTIDS.siteFacts.rowValue).textContent, `${fact} shows the edition's figure in its unit`).toBe(
          fillSiteFacts(siteFactsStrings.site_facts_row_value, { value: edition.value, unit: edition.unit }),
        );
        const chip = within(row).getByTestId(TESTIDS.basis.chip);
        expect(chip.getAttribute("data-basis"), `${fact} wears the DERIVED glyph (R-UI-002)`).toBe("DERIVED");
        expect(within(row).getByTestId(TESTIDS.siteFacts.enter), "the site may still override it by entering it").toBeTruthy();
      }
    }

    expect(screen.getByTestId(TESTIDS.siteFacts.face).textContent, "the face speaks of the facts that ARE deferred").toBe(siteFactsStrings.site_facts_face);
  });

  test("where every fact is entered or stated, the face says so instead of claiming earthwork is unpriceable", () => {
    const entered = { valueAsWritten: "0", unitAsWritten: "m", canonicalMetres: "0", sourceNote: "Survey", enteredAt: "2026-09-01T09:00:00.000Z" };
    mountSiteFactsPanel({
      standing: {
        GROUND_LEVEL: { ...entered, fact: "GROUND_LEVEL", actId: "11111111-1111-4111-8111-111111111111" },
        WATER_TABLE: { ...entered, fact: "WATER_TABLE", actId: "22222222-2222-4222-8222-222222222222" },
      },
      editionStated: SEED_STATED,
    });
    expect(screen.queryAllByTestId(TESTIDS.siteFacts.rowDeferral), "nothing defers").toHaveLength(0);
    expect(screen.getByTestId(TESTIDS.siteFacts.face).textContent).toBe(siteFactsStrings.site_facts_face_complete);
  });

  test("an entered fact outranks the edition's statement: the site overrides (L-MEA-06)", () => {
    mountSiteFactsPanel({
      standing: {
        BLINDING_THICKNESS: {
          fact: "BLINDING_THICKNESS",
          valueAsWritten: "75",
          unitAsWritten: "mm",
          canonicalMetres: "0.075",
          sourceNote: "Structural note 12",
          actId: "33333333-3333-4333-8333-333333333333",
          enteredAt: "2026-09-02T09:00:00.000Z",
        },
      },
      editionStated: SEED_STATED,
    });
    const row = rowOf("BLINDING_THICKNESS");
    expect(row.getAttribute("data-basis")).toBe("ENTERED");
    expect(within(row).getByTestId(TESTIDS.siteFacts.rowValue).textContent).toBe(fillSiteFacts(siteFactsStrings.site_facts_row_value, { value: "75", unit: "mm" }));
  });
});

describe("a deferral's evidence leads onward (R-UI-020)", () => {
  test("\"Enter this site fact\" opens that row's entry form — the same door as its Enter button", () => {
    mountSiteFactsPanel({ standing: {}, editionStated: SEED_STATED });
    const row = rowOf("GROUND_LEVEL");
    expect(within(row).queryByTestId(TESTIDS.siteFacts.value), "no form stands before the press").toBeNull();

    const evidence = within(within(row).getByTestId(TESTIDS.siteFacts.rowDeferral)).getByTestId(TESTIDS.refusal.evidenceLink);
    expect(evidence.textContent).toBe(siteFactsStrings.site_facts_evidence_enter);
    fireEvent.click(evidence);

    expect(within(rowOf("GROUND_LEVEL")).getByTestId(TESTIDS.siteFacts.value), "the press opened the row's own form").toBeTruthy();
  });

  test("for a reader who may not enter a fact, the evidence stays a plain link and no form opens", () => {
    mountSiteFactsPanel({ standing: {}, editionStated: SEED_STATED, mayAuthor: false });
    const row = rowOf("WATER_TABLE");
    fireEvent.click(within(within(row).getByTestId(TESTIDS.siteFacts.rowDeferral)).getByTestId(TESTIDS.refusal.evidenceLink));
    expect(within(rowOf("WATER_TABLE")).queryByTestId(TESTIDS.siteFacts.value)).toBeNull();
  });
});
