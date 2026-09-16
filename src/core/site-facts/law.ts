// L-MEA-06's SITE attributes, as law: "facts no drawing carries" — so they are always ENTERED, never
// derived from a drawing and never defaulted, and "an absent fact is a named deferral, never a
// default" (AM-06 §1).
//
// This file is what a site fact IS: the closed roster, the guard over it, and the one function that
// makes a write — which is where a malformed entry is refused, before anything is appended. Pure: no
// store, no clock, no I/O, so the act that enters a fact (inc-304b) and the test that enters one
// both reach the same statement of the law (ARCH-02).
//
// A fact is carried the way L-QTY-03 has every reading carried: the value and the unit AS WRITTEN,
// beside the canonical metres the canon makes of them and the factor it carried them by. The carrying
// is the canon's and none of it is here (B-17, L-FRM-06).
import { REFUSALS } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { CANONICAL_UNIT, convert, factorOf, isUnit, unitNamed } from "../units/canon";

/**
 * The six facts of L-MEA-06's ENTERED set this ledger records: where the ground stands and where the
 * water does, the working space and depth extra a site demands over the edition's own, and the
 * blinding's projection and thickness where the site states them.
 *
 * Every one of them is a LENGTH. The rest of L-MEA-06's SITE attributes — lead, lift, elapsed hours,
 * the inaccessible-area category — are not lengths and are not here: they enter this roster with the
 * pricing seam that reads them (scope).
 */
export const SITE_FACTS = ["GROUND_LEVEL", "WATER_TABLE", "WORKING_ALLOWANCE", "DEPTH_EXTRA", "BLINDING_PROJECTION", "BLINDING_THICKNESS"] as const;

/** One site fact, drawn from the closed roster above. */
export type SiteFact = (typeof SITE_FACTS)[number];

/** Is this value one of the site facts? Asked wherever a fact arrives as text — a row, a wire, a panel. */
export function isSiteFact(value: unknown): value is SiteFact {
  return typeof value === "string" && (SITE_FACTS as readonly string[]).includes(value);
}

/**
 * One entry, made and not yet appended: the reading as it was written, what the canon made of it, and
 * the note that says where it came from. The store takes one of these and inserts it — so everything
 * a malformed entry is refused for has already been refused by the time a row exists.
 */
export type SiteFactWrite = {
  readonly fact: SiteFact;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonicalMetres: string;
  readonly factor: string;
  readonly sourceNote: string;
};

/**
 * Make one entry, or refuse it by name.
 *
 * Three things are refused here and nowhere else: a fact outside the closed roster, an entry that
 * says nothing about where it came from, and a reading in a unit the canon carries no LENGTH factor
 * for — the last being the canon's own `UNIT_UNMAPPED`, because what a unit is worth is the canon's
 * to say (B-17, L-QTY-04: reason codes are closed enums, never prose).
 *
 * The value is carried as it stands, sign and all: an elevation below datum is a reading, and a
 * ground level of −152.4 mm is exactly the reading a site with its ground below the project datum
 * has (L-QTY-03).
 */
export function siteFactWrite(input: { fact: string; valueAsWritten: string; unitAsWritten: string; sourceNote: string }): SiteFactWrite {
  if (!isSiteFact(input.fact)) {
    throw refusal(REFUSALS.SITE_FACT_UNKNOWN.code, `"${input.fact}" is not one of the site facts this product records (L-MEA-06)`, { fact: input.fact });
  }
  if (input.sourceNote.trim().length === 0) {
    throw refusal(REFUSALS.SITE_FACT_SOURCE_UNSTATED.code, `the ${input.fact} entry carries no source note (AM-06 §1: every entry is an act with a source note)`, {
      fact: input.fact,
    });
  }
  // The spelling is asked of the canon rather than folded here, the way every other reading of this
  // tree asks it: a drawing writes the millimetre as `MM` and the note that quotes it says `mm`.
  const named = unitNamed(input.unitAsWritten);
  if (named === null || !isUnit(named)) {
    throw refusal(REFUSALS.UNIT_UNMAPPED.code, `the canon carries no factor for "${input.unitAsWritten}", so the ${input.fact} entry cannot be carried to metres (L-FRM-06)`, {
      unit: input.unitAsWritten,
    });
  }
  const carried = convert(input.valueAsWritten, named, CANONICAL_UNIT.LENGTH);
  // A site fact is a length. A unit of another dimension has no quotient into the metre, and the
  // canon says so structurally — the refusal is carried back rather than re-spelled (ARCH-03).
  if (!carried.ok) throw refusal(carried.code, `${input.valueAsWritten} ${input.unitAsWritten} is no length, so it is no site fact (L-MEA-06)`, { unit: input.unitAsWritten });
  return Object.freeze({
    fact: input.fact,
    valueAsWritten: input.valueAsWritten,
    unitAsWritten: input.unitAsWritten,
    canonicalMetres: carried.value,
    factor: factorOf(named),
    sourceNote: input.sourceNote,
  });
}

/** One appended entry, as the ledger holds it — the columns a standing fact is read off. */
export type SiteFactEntry = {
  readonly fact: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonicalMetres: string;
  readonly sourceNote: string;
  readonly actId: string;
  readonly enteredAt: Date | string;
};

/** One fact as it now stands, with the act that entered it and the note that entry carried. */
export type StandingSiteFact = {
  readonly fact: SiteFact;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonicalMetres: string;
  readonly sourceNote: string;
  readonly actId: string;
  readonly enteredAt: string;
};

/**
 * What each fact stands at: the LATEST entry of each, and an absent key for a fact nobody entered.
 *
 * A fact is restated by entering it again, never by editing a row (L-ACT-01), so the ledger holds
 * every reading and the standing is derived from them at read time — there is no stored "current
 * value" anywhere to overwrite (R-TO-051, L-REG-03). The rows arrive oldest first, which is the order
 * the ledger's own read answers in; a later row supersedes an earlier one of the same fact.
 */
export function standingSiteFacts(rows: readonly SiteFactEntry[]): Readonly<Partial<Record<SiteFact, StandingSiteFact>>> {
  const standing: Partial<Record<SiteFact, StandingSiteFact>> = {};
  for (const row of rows) {
    // A row whose fact the roster no longer holds says nothing this reader can answer with: the
    // column's own CHECK is over the roster, so this is the reading of a row written under an older
    // one rather than a case anyone can reach today (L-MEA-06).
    if (!isSiteFact(row.fact)) continue;
    standing[row.fact] = {
      fact: row.fact,
      valueAsWritten: row.valueAsWritten,
      unitAsWritten: row.unitAsWritten,
      canonicalMetres: row.canonicalMetres,
      sourceNote: row.sourceNote,
      actId: row.actId,
      enteredAt: typeof row.enteredAt === "string" ? row.enteredAt : row.enteredAt.toISOString(),
    };
  }
  return Object.freeze(standing);
}
