// What the project's pinned rule-set edition already states of the site facts (L-MEA-06: "site
// overrides, edition otherwise states"; the site-facts Decision's I-327).
//
// The earthwork rail reads four of the six facts as ENTERED-or-DERIVED: a fact entered on this screen
// wins, and where none is entered the pinned edition's parameter is bound instead, under basis
// DERIVED (`enteredOrDerived`, src/modules/takeoff/rails/foundations/read.ts). So a fact the edition
// states is NOT deferred — the rail defers nothing for it — and a panel that painted
// EARTHWORK_PARAMETER_UNSTATED over it told a reader the product could not price what it prices,
// one nav row away from the Rule set screen that shows the value (R-UI-020: a refusal states the
// truth). This file answers, for one edition's parameters, which facts it states and at what.
//
// Pure: no store, no clock. The fact → parameter pairing is the rail's own `EDITION_PARAMETER_OF`,
// the one `enteredOrDerived` reads (B-17), so a key the rail renames moves this answer with it.
import type { EditionParameter } from "@/core/rulesets/editions";
import type { SiteFact } from "@/core/site-facts/law";
import { EDITION_PARAMETER_OF } from "@/modules/takeoff/rails/foundations/read";

/** One fact as the pinned edition states it: the decimal and the unit, verbatim as stored (I-27). */
export interface EditionStatedFact {
  readonly value: string;
  readonly unit: string;
}

/** What the pinned edition states, by fact — an absent key per fact it does not state. */
export type EditionStatedFacts = Readonly<Partial<Record<SiteFact, EditionStatedFact>>>;

/** The site facts one edition's parameters state, read exactly as the earthwork rail reads them. */
export function editionStatedFacts(parameters: Readonly<Record<string, EditionParameter>>): EditionStatedFacts {
  const stated: Partial<Record<SiteFact, EditionStatedFact>> = {};
  for (const [fact, key] of Object.entries(EDITION_PARAMETER_OF) as [keyof typeof EDITION_PARAMETER_OF, string][]) {
    const parameter = parameters[key];
    if (parameter !== undefined) stated[fact] = Object.freeze({ value: parameter.value, unit: parameter.unit });
  }
  return Object.freeze(stated);
}
