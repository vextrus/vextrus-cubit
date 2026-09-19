/**
 * The panel's two enumerable rosters, judged where they live (docs/design/s-settings-site-facts.md
 * § 7): the map that says what an ABSENT site fact is deferred UNDER, and R-UI-050's matrix.
 *
 * AM-06 §1 is the claim: "an absent fact is a named deferral, never a default". A map that is total
 * over the roster is what makes that true of every fact — including the one the ledger gained no
 * rail reader for — so each code is named here, which is also how the register's own accounting
 * admits it (Q-07: every registered code is exercised by name).
 *
 * Nothing here transcribes the roster (B-19): the questions are asked of `SITE_FACTS` itself, so a
 * seventh fact is judged by this file the day it ships.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../../src/core/errors";
import { SITE_FACTS } from "../../../src/core/site-facts/law";
import { SITE_FACT_DEFERRALS, statedByEdition } from "../../../src/modules/takeoff/site-facts-ui/deferrals";
import { SITE_FACTS_STATES, SITE_FACTS_STATE_NAMES } from "../../../src/modules/takeoff/site-facts-ui/states";

describe("the site facts panel's deferrals (AM-06 §1, I-B)", () => {
  test("every fact of the roster defers under a code the closed register holds", () => {
    expect(Object.keys(SITE_FACT_DEFERRALS).sort(), "the map is total over the roster and holds nothing else").toEqual([...SITE_FACTS].sort());
    for (const fact of SITE_FACTS) {
      const code = SITE_FACT_DEFERRALS[fact];
      expect(REFUSALS[code], `${fact} defers under a registered refusal, with the register's own words (Q-07, R-UI-020)`).toBeTruthy();
      expect(REFUSALS[code]?.surface, "a deferral is rendered where the reading it is about is").toBe("inline");
    }
  });

  test("the ground and the water each have their own code, and the four lengths share the edition's", () => {
    expect(SITE_FACT_DEFERRALS.GROUND_LEVEL, "where the ground stands is its own absence (L-FRM-04)").toBe("GROUND_LEVEL_UNSTATED");
    expect(SITE_FACT_DEFERRALS.WATER_TABLE, "and where the water stands is another — earthwork below it is a different item").toBe("WATER_TABLE_UNSTATED");
    for (const fact of ["WORKING_ALLOWANCE", "DEPTH_EXTRA", "BLINDING_PROJECTION", "BLINDING_THICKNESS"] as const) {
      expect(SITE_FACT_DEFERRALS[fact], `${fact} is a length the pinned edition may also state (L-MEA-06)`).toBe("EARTHWORK_PARAMETER_UNSTATED");
      expect(statedByEdition(fact), "…so its deferral's evidence leads to the rule set as well as to this screen (I-B)").toBe(true);
    }
    expect(statedByEdition("GROUND_LEVEL"), "a ground level is read on site and nowhere else").toBe(false);
    expect(statedByEdition("WATER_TABLE"), "and so is a water table").toBe(false);
  });
});

describe("the site facts panel's states (R-UI-050, B-19)", () => {
  test("every state of the clause's roster is declared, and no cell is silent", () => {
    expect(Object.keys(SITE_FACTS_STATES).sort(), "the matrix declares R-UI-050's whole roster").toEqual([...SITE_FACTS_STATE_NAMES].sort());
    for (const name of SITE_FACTS_STATE_NAMES) {
      const cell = SITE_FACTS_STATES[name];
      if (cell.declared === "rendered") expect(cell.by.length, `${name} names the module that paints it`).toBeGreaterThan(0);
      else if (cell.declared === "delegated") expect(cell.to.length + cell.why.length, `${name} names who owns it instead, and why`).toBeGreaterThan(0);
      else expect(cell.why.length, `${name} is impossible with the reason attached — the reason is what makes the claim reviewable`).toBeGreaterThan(0);
    }
  });
});
