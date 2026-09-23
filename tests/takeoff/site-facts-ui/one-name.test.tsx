// @vitest-environment jsdom
/**
 * One parameter, one name, and a basis that moves no name (docs/design/s-settings-site-facts.md
 * I-438 and I-440; s-settings-ruleset-author I-268; B-17).
 *
 * Session 7's re-look found the pinned edition's parameters under two names on neighbouring screens:
 * the Rule set screen read "Earthwork working allowance 1.5 ft" and "Earthwork extra depth 0.5 ft",
 * and the Site facts rows beside their "Stated by the pinned rule set" link read "Working allowance"
 * and "Depth extra" — a reader who followed the link could not find a row by the name they left. A
 * fact the edition may state is one of its parameters, and a parameter has one name in the settings
 * area (`parameterLabel`). The route builds those words on the server and hands them in; ARCH-01 bars
 * the panel from the app's table.
 *
 * The same look found every entered or derived name standing 80 px right of an absent one, because
 * the basis chip stood in front of it inside the row's header. The chip has its own column now.
 *
 * Nothing is transcribed but the brief's own outcome (B-19): the roster is `SITE_FACTS`, the pairing is
 * the rail's `EDITION_PARAMETER_OF`, and the words are the Rule set screen's own table.
 */
import { afterEach, describe, expect, test } from "vitest";
import type { Consequence } from "../../../src/core/acts";
import { SEED_EDITION_CONTENT } from "../../../src/core/rulesets/seed";
import { SITE_FACTS, type SiteFact } from "../../../src/core/site-facts/law";
import { EDITION_PARAMETER_OF, WORKING_ALLOWANCE_PARAMETER } from "../../../src/modules/takeoff/rails/foundations/read";
import { statedByEdition } from "../../../src/modules/takeoff/site-facts-ui/deferrals";
import { editionStatedFacts } from "../../../src/modules/takeoff/site-facts-ui/edition";
import { factLabel, fillSiteFacts, siteFactsStrings, type SiteFactParameterLabels } from "../../../src/modules/takeoff/site-facts-ui/strings";
import { siteFactParameterLabels } from "../../../src/app/(app)/t/[tenant]/p/[project]/settings/site-facts/parameter-labels";
import { rulesetParameterLabel } from "../../../src/app/(app)/t/[tenant]/p/[project]/settings/ruleset/strings";
import { TESTIDS } from "../../../src/ui/testids";
import { cleanup, fireEvent, mountSiteFactsPanel, screen, STAGED_PROJECT, STAGED_TENANT, waitFor, within } from "./support/site-facts-panel-stage";

afterEach(() => {
  cleanup();
});

/** The SAMPLE edition's statement of the site facts, read the way the page reads the pin. */
const SEED_STATED = editionStatedFacts(SEED_EDITION_CONTENT.parameters);

/** The pairing, as a partial map over the whole roster — a fact no rule set states has no parameter. */
const PARAMETER_OF = EDITION_PARAMETER_OF as Readonly<Partial<Record<SiteFact, string>>>;

/** Words no table of this tree holds, so a row that reads them read what it was handed. */
const HANDED: SiteFactParameterLabels = Object.freeze({
  WORKING_ALLOWANCE: "Handed allowance",
  DEPTH_EXTRA: "Handed depth",
  BLINDING_PROJECTION: "Handed projection",
  BLINDING_THICKNESS: "Handed thickness",
});

function rowOf(fact: SiteFact): HTMLElement {
  const row = screen.getAllByTestId(TESTIDS.siteFacts.row).find((element) => element.getAttribute("data-fact") === fact);
  expect(row, `the panel renders a row for ${fact}`).toBeTruthy();
  return row as HTMLElement;
}

/** The row's own header — the fact's name, the frozen key column (§ 1.1). */
function headerOf(fact: SiteFact): HTMLElement {
  const header = rowOf(fact).querySelector<HTMLElement>('th[scope="row"]');
  expect(header, `${fact}'s row is headed by its name`).not.toBeNull();
  return header as HTMLElement;
}

describe("one parameter, one name (I-438, I-268)", () => {
  test("the route names each fact the edition may state exactly as the Rule set screen names its parameter", () => {
    const labels = siteFactParameterLabels();
    expect(Object.keys(labels).sort(), "the route names every fact an edition may state, and no other").toEqual(SITE_FACTS.filter(statedByEdition).sort());
    for (const fact of SITE_FACTS) {
      const key = PARAMETER_OF[fact];
      if (key === undefined) continue;
      expect(labels[fact as keyof SiteFactParameterLabels], `${fact} reads what the Rule set screen reads for ${key}`).toBe(rulesetParameterLabel(key));
    }
    // The brief's QS outcome, in its own words: one name on both screens.
    expect(labels.WORKING_ALLOWANCE).toBe("Earthwork working allowance");
    expect(rulesetParameterLabel(WORKING_ALLOWANCE_PARAMETER)).toBe("Earthwork working allowance");
  });

  test("each row is headed by the Rule set screen's name for its parameter, and a site-only fact by this screen's own", () => {
    mountSiteFactsPanel({ standing: {}, editionStated: SEED_STATED });
    for (const fact of SITE_FACTS) {
      const key = PARAMETER_OF[fact];
      const expected = key === undefined ? factLabel(fact, HANDED) : rulesetParameterLabel(key);
      expect(headerOf(fact).textContent, `${fact} is named once across the settings area`).toBe(expected);
    }
    expect(headerOf("GROUND_LEVEL").textContent, "no rule set names the ground, so this screen does").toBe(siteFactsStrings.site_facts_fact_ground_level);
    expect(headerOf("WATER_TABLE").textContent).toBe(siteFactsStrings.site_facts_fact_water_table);
  });

  test("the panel reads the names it is handed — on the row and in its form's field names — never a table of its own", () => {
    mountSiteFactsPanel({ standing: {}, editionStated: SEED_STATED, parameterLabels: HANDED });
    for (const fact of Object.keys(HANDED) as (keyof SiteFactParameterLabels)[]) {
      expect(headerOf(fact).textContent, `${fact} reads the words the route handed in`).toBe(HANDED[fact]);
    }

    fireEvent.click(within(rowOf("DEPTH_EXTRA")).getByTestId(TESTIDS.siteFacts.enter));
    const row = rowOf("DEPTH_EXTRA");
    expect(within(row).getByTestId(TESTIDS.siteFacts.value).getAttribute("aria-label"), "the value field is named by the fact's one name").toBe(
      fillSiteFacts(siteFactsStrings.site_facts_value_label, { fact: HANDED.DEPTH_EXTRA }),
    );
    expect(within(row).getByTestId(TESTIDS.siteFacts.unit).getAttribute("aria-label"), "…and the unit field").toBe(
      fillSiteFacts(siteFactsStrings.site_facts_unit_label, { fact: HANDED.DEPTH_EXTRA }),
    );
    expect(within(row).getByTestId(TESTIDS.siteFacts.sourceNote).getAttribute("aria-label"), "…and the source note").toBe(
      fillSiteFacts(siteFactsStrings.site_facts_source_label, { fact: HANDED.DEPTH_EXTRA }),
    );
  });

  test("the consequence dialog and the status sentence name the fact an act entered by the same one name", async () => {
    const consequence: Consequence = {
      actType: "AUTHOR_SITE_FACT",
      tenantId: STAGED_TENANT,
      projectId: STAGED_PROJECT,
      rendering: "SUBJECTS",
      subjects: [{ subjectId: "WORKING_ALLOWANCE", before: ["1.5 ft"], after: ["2 ft"] }],
      effects: { linesRederiving: [], signaturesVoiding: [] },
    };
    mountSiteFactsPanel({
      standing: {},
      editionStated: SEED_STATED,
      parameterLabels: HANDED,
      preview: () => Promise.resolve({ previewed: true as const, consequence, consequenceDigest: "5".repeat(64) }),
      commit: () => Promise.resolve({ committed: true as const, actId: "44444444-4444-4444-8444-444444444444" }),
    });

    fireEvent.click(within(rowOf("WORKING_ALLOWANCE")).getByTestId(TESTIDS.siteFacts.enter));
    fireEvent.change(within(rowOf("WORKING_ALLOWANCE")).getByTestId(TESTIDS.siteFacts.value), { target: { value: "2" } });
    fireEvent.change(within(rowOf("WORKING_ALLOWANCE")).getByTestId(TESTIDS.siteFacts.sourceNote), { target: { value: "Site instruction 4" } });
    fireEvent.click(within(rowOf("WORKING_ALLOWANCE")).getByTestId(TESTIDS.siteFacts.submit));
    const dialog = await waitFor(() => screen.getByTestId(TESTIDS.consequence.dialog));
    // The one surface where the reader decides names the fact the way the row they pressed Enter on
    // did — never by the enum the seam moves (I-438). The act still moves that id, and says so.
    const subject = await waitFor(() => within(dialog).getByTestId(TESTIDS.consequence.subjectRow));
    expect(subject.getAttribute("data-subject"), "the act moves the fact itself").toBe("WORKING_ALLOWANCE");
    expect(subject.querySelector(".cx-consequence-subject-label")?.textContent, "the dialog names the fact by its one name").toBe(HANDED.WORKING_ALLOWANCE);
    fireEvent.click(await waitFor(() => within(dialog).getByTestId(TESTIDS.consequence.confirm)));

    const status = within(screen.getByTestId(TESTIDS.siteFacts.section)).getByRole("status");
    await waitFor(() =>
      expect(status.textContent, "a reader who cannot see the table hears the fact by the name the table shows").toBe(
        fillSiteFacts(siteFactsStrings.site_facts_status_done, {
          fact: HANDED.WORKING_ALLOWANCE,
          value: fillSiteFacts(siteFactsStrings.site_facts_row_value, { value: "2", unit: "m" }),
        }),
      ),
    );
  });
});

describe("a basis moves no name (I-440)", () => {
  test("the chip stands in its own column after the figure, and every row's header is its name alone", () => {
    mountSiteFactsPanel({
      standing: {
        GROUND_LEVEL: {
          fact: "GROUND_LEVEL",
          valueAsWritten: "-1.2",
          unitAsWritten: "m",
          canonicalMetres: "-1.2",
          sourceNote: "Survey sheet S-01",
          actId: "11111111-1111-4111-8111-111111111111",
          enteredAt: "2026-09-01T09:00:00.000Z",
        },
      },
      editionStated: SEED_STATED,
    });

    const heads = [...screen.getByTestId(TESTIDS.siteFacts.table).querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads.slice(0, 5), "value, then the basis it rests on, then where it was read — the register's order").toEqual([
      siteFactsStrings.site_facts_column_fact,
      siteFactsStrings.site_facts_column_value,
      siteFactsStrings.site_facts_column_basis,
      siteFactsStrings.site_facts_column_source,
      siteFactsStrings.site_facts_column_act,
    ]);
    const basisColumn = heads.indexOf(siteFactsStrings.site_facts_column_basis);

    for (const fact of SITE_FACTS) {
      const row = rowOf(fact);
      const basis = row.getAttribute("data-basis");
      expect(within(headerOf(fact)).queryByTestId(TESTIDS.basis.chip), `${fact}'s name stands at the column's edge, with nothing in front of it`).toBeNull();
      expect(headerOf(fact).textContent, `${fact}'s header is its name and nothing else`).toBe(factLabel(fact, siteFactParameterLabels()));

      const cell = row.querySelector("tr")?.children[basisColumn] as HTMLElement | undefined;
      expect(cell, `${fact} has a cell under Basis`).toBeDefined();
      const chip = within(cell as HTMLElement).queryByTestId(TESTIDS.basis.chip);
      if (basis === "ABSENT") {
        expect(chip, `${fact} has no basis at all, and wears no chip (I-275)`).toBeNull();
        expect((cell as HTMLElement).textContent, "its cell says the absence the way the rest of its row does").toBe(siteFactsStrings.site_facts_absent_value);
      } else {
        expect(chip?.getAttribute("data-basis"), `${fact}'s chip, under Basis, says what the figure rests on (R-UI-002)`).toBe(basis);
      }
    }
    expect(rowOf("GROUND_LEVEL").getAttribute("data-basis")).toBe("ENTERED");
    expect(rowOf("WATER_TABLE").getAttribute("data-basis")).toBe("ABSENT");
    expect(rowOf("WORKING_ALLOWANCE").getAttribute("data-basis")).toBe("DERIVED");
  });

  test("a sub-row still spans the whole table, the new column included", () => {
    mountSiteFactsPanel({ standing: {}, editionStated: SEED_STATED });
    const columns = screen.getByTestId(TESTIDS.siteFacts.table).querySelectorAll("col").length;
    expect(within(rowOf("WATER_TABLE")).getByTestId(TESTIDS.siteFacts.rowDeferral).getAttribute("colspan"), "the deferral spans every column").toBe(String(columns));
  });
});
