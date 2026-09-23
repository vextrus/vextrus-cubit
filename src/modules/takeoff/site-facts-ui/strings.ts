// S-Settings · Site facts' copy, and all of it (docs/design/s-settings-site-facts.md § 3, verbatim):
// the panel carries no string literal of its own beyond test ids and fixed attribute values. The keys
// read `site_facts_…`, under the same discipline as the tables in `src/ui/strings/*` (s-settings-ruleset
// I-24) — and in this module rather than there, because ARCH-01 bars `src/modules` from `src/ui`.
//
// Voice (§ 3): calm, concrete, professional; nouns on the column heads, verbs on the buttons. "Act",
// "consequence", "site fact" and "source note" are the product's own user-facing law and are used as
// such; no clause id and no enum spelling appears in a sentence a reader can see.
import type { SiteFact } from "@/core/site-facts/law";
import { dimensionOf, UNITS, type Unit } from "@/core/units/canon";
// Type-only, like the panel's own import of the edition map: the pairing's VALUE carries the rail —
// and through it the store's schema — so it is read on the server, where the route builds the words
// this panel is handed (I-438). A type travels to nobody's browser.
import type { DerivableSiteFact } from "@/modules/takeoff/rails/foundations/read";

export const siteFactsStrings = {
  site_facts_heading: "Site facts",
  // I-327: the face states what the panel below it actually defers — the facts nobody entered and the
  // pinned edition does not state — and when nothing defers, it says that instead.
  site_facts_face: "Earthwork is unpriceable from drawings alone until the deferred site facts below are entered.",
  site_facts_face_complete: "Every site fact earthwork reads is entered here or stated by the pinned rule set.",
  site_facts_caption:
    "A site fact is a reading no drawing carries. Each one is entered as its own act, with the note it was read from, and is restated by entering it again.",

  site_facts_column_fact: "Fact",
  site_facts_column_value: "Value",
  /** I-440: the basis a figure rests on has its own column, after the figure (the register's order). */
  site_facts_column_basis: "Basis",
  site_facts_column_source: "Source note",
  site_facts_column_act: "Entered by",

  /** What a cell of a fact nobody has entered reads — the absence itself, never a stand-in figure. */
  site_facts_absent_value: "—",
  /** The slots are data — the reading as it was written and the unit it was written in (§ 3). */
  site_facts_row_value: "{value} {unit}",
  /** Where a fact nobody entered is read from instead: the pinned edition (L-MEA-06, I-327). */
  site_facts_edition_source: "Stated by the pinned rule set",

  // I-438: only the two facts no rule set states are named here. The four the pinned edition may
  // state are its parameters, and a parameter has one name in the settings area — `parameterLabel`,
  // s-settings-ruleset-author I-268 — which the route hands this panel (see `factLabel` below).
  site_facts_fact_ground_level: "Existing ground level",
  site_facts_fact_water_table: "Water table level",

  site_facts_enter: "Enter",
  site_facts_restate: "Restate",
  /** The slot is data — the fact the form is open on (§ 3). */
  site_facts_value_label: "Value for {fact}",
  site_facts_unit_label: "Unit for {fact}",
  site_facts_source_label: "Source note for {fact}",
  site_facts_source_placeholder: "Where this reading was read from",
  site_facts_submit: "Enter this fact",
  site_facts_cancel: "Cancel",

  site_facts_status_pending: "Checking what this entry changes.",
  /** The slots are data — the fact entered and the reading it now stands at (§ 3). */
  site_facts_status_done: "Done. {fact} now reads {value}.",

  site_facts_evidence_enter: "Enter this site fact",
  site_facts_evidence_ruleset: "Open the pinned rule set",
  site_facts_evidence_participants: "Open participants",

  site_facts_unit_m: "Metre (m)",
  site_facts_unit_mm: "Millimetre (mm)",
  site_facts_unit_ft: "Foot (ft)",
  site_facts_unit_in: "Inch (in)",
} as const;

/** One key of this screen's table — the union the compiler refuses a missing key with. */
export type SiteFactsStringKey = keyof typeof siteFactsStrings;

/** A fact no rule-set edition states — a reading about THIS ground, and nowhere else (Q-07). */
export type SiteOnlyFact = Exclude<SiteFact, DerivableSiteFact>;

/**
 * The words the settings area names each edition parameter by, keyed by the site fact it stands in
 * for: `parameterLabel(EDITION_PARAMETER_OF[fact])`, built by the route that mounts this panel
 * (I-438). ARCH-01 bars this module from the app's table, so the words arrive as data; the type is
 * total over the facts an edition may state, so a fifth such fact is a compile error at the route
 * until it is named there too (B-19).
 */
export type SiteFactParameterLabels = Readonly<Record<DerivableSiteFact, string>>;

/**
 * The words this screen alone names a fact by: the ones no rule set states. Total over them, so a
 * seventh site fact that is not an edition parameter is a compile error here rather than a row
 * headed by its enum spelling (B-19, § 3).
 */
const SITE_ONLY_LABEL: Readonly<Record<SiteOnlyFact, string>> = Object.freeze({
  GROUND_LEVEL: siteFactsStrings.site_facts_fact_ground_level,
  WATER_TABLE: siteFactsStrings.site_facts_fact_water_table,
});

/** Whether this screen names the fact itself — the ones no edition states — or the rule set does. */
function isSiteOnly(fact: SiteFact): fact is SiteOnlyFact {
  return Object.hasOwn(SITE_ONLY_LABEL, fact);
}

/**
 * What one fact is called on the screen — its row, the fields of its form and the sentence the
 * status line speaks. A fact the pinned edition may state is one of its parameters and is called
 * what the Rule set screen calls that parameter, one nav row away (I-438, I-268, B-17): a reader who
 * follows "Stated by the pinned rule set" finds the row by the name they left.
 */
export function factLabel(fact: SiteFact, parameterLabels: SiteFactParameterLabels): string {
  return isSiteOnly(fact) ? SITE_ONLY_LABEL[fact] : parameterLabels[fact];
}

/**
 * The units a site fact may be written in: the canon's LENGTH units, in the canon's own order, read
 * off the canon rather than listed here — a site fact is a length (L-MEA-06), and a length unit the
 * canon learns is offered here the day it does (B-19).
 */
export const SITE_FACT_UNITS: readonly Unit[] = Object.freeze(UNITS.filter((unit) => dimensionOf(unit) === "LENGTH"));

/** The unit the form opens on: the canonical metre, which is what a survey states a level in. */
export const SITE_FACT_UNIT_DEFAULT: Unit = "m";

/**
 * The words a unit is offered by. A spelling the table below has no words for is offered under the
 * canon's own spelling rather than hidden: an unlabelled length unit is still a length a site may be
 * read in, and the option that carries it is what `unitAsWritten` records (L-QTY-03).
 */
const UNIT_LABEL: Readonly<Partial<Record<Unit, string>>> = Object.freeze({
  m: siteFactsStrings.site_facts_unit_m,
  mm: siteFactsStrings.site_facts_unit_mm,
  ft: siteFactsStrings.site_facts_unit_ft,
  in: siteFactsStrings.site_facts_unit_in,
});

/** What one unit is read by on the panel. */
export function unitLabel(unit: Unit): string {
  return UNIT_LABEL[unit] ?? unit;
}

/**
 * A registered string with its named slots filled — the substitution `src/ui/strings`' own `fill`
 * does, which ARCH-01 bars this module from importing. One home inside the module, so a slot with no
 * value stands as itself rather than becoming the word "undefined" on a screen (R-SPINE-060).
 */
export function fillSiteFacts(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}
