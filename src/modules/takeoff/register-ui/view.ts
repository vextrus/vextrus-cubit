// What the register workspace is handed: one reading of one project's pinned campaign, whole
// (R-TO-050). The shape is declared here rather than beside the read, because the presentational
// workspace and the server reading that composes it are two files and one contract — a screen that
// re-declared the reading would be a second answer to what a register IS (B-17).
//
// Everything is already resolved: no id is looked up while a cell renders, no figure is computed a
// second time, and every value is model data the screen shows verbatim (I-25).
import type { QuantityBasis } from "@/core/offers/law";
import type { AttributeStanding } from "@/core/register/store";

/** The campaign the register is read under, or nothing where none stands (L-REG-07). */
export type ViewCampaign = {
  readonly campaignId: string;
  readonly setRevisionId: string;
};

/** One reading of one attribute, as the ledger holds it (R-TO-051). */
export type ViewReading = {
  readonly observationId: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly basis: string;
  readonly precedence: number;
  readonly sourceKey: string;
};

/**
 * One correctable attribute of one object: how it stands, the value that stands where one does, and
 * every reading competing for it or overruled by a higher precedence. A SUSPENDED attribute carries
 * no value at all — the disagreement is declared, never resolved (L-REG-03, I-174).
 */
export type ViewAttribute = {
  readonly attribute: string;
  readonly standing: AttributeStanding;
  readonly canonicalValue: string | null;
  readonly canonicalUnit: string | null;
  readonly competing: readonly ViewReading[];
  readonly overruled: readonly ViewReading[];
};

/**
 * One register object, as a reader meets it: where it sits in the tree, what it rests on, what its
 * sighting standing was, how its readings corroborate, and the source key it was read at.
 */
export type ViewObject = {
  readonly objectKey: string;
  readonly discipline: string;
  readonly level: string;
  readonly class: string;
  readonly mark: string;
  /** The weakest quantity basis over its lines, in the roster's order (settled reading 1). */
  readonly basis: string;
  /** The sighting standing the register recorded (settled reading 1). */
  readonly role: string;
  readonly corroboration: string;
  readonly sourceKey: string;
  readonly attributes: readonly ViewAttribute[];
};

/** What one variable of a formula was read as — the `bindings` a published line carries. */
export type ViewBinding = {
  readonly value: string;
  readonly unit: string;
  readonly basis: string;
  readonly source: string;
  readonly canonical: { readonly value: string; readonly unit: string };
};

/**
 * One published quantity line. `value` is null exactly where the coverage is not COMPLETE: a row
 * kept with no quantity carries none, never a zero (L-QTY-02).
 */
export type ViewLine = {
  readonly lineId: string;
  readonly objectKey: string;
  readonly kind: string;
  readonly class: string;
  readonly level: string;
  readonly value: string | null;
  readonly unit: string;
  readonly formula: string;
  readonly variables: Readonly<Record<string, ViewBinding>>;
  readonly quantityBasis: QuantityBasis;
  readonly selectionBasis: QuantityBasis;
  readonly coverage: string;
  readonly calibrationKeys: readonly string[];
  readonly engine: string;
  readonly sourceKey: string;
  /** Whether a person has struck the object this line was measured from (I-173). */
  readonly repudiated: boolean;
};

/** One sighting that produced no line: a queue item's cause or a refused sighting's refusal. */
export type ViewRefusal = {
  readonly code: string;
  readonly objectKey: string;
  readonly kind: string | null;
};

/** One level stack the machine proposes, keyed on the fact judged (R-UI-023, L-ACT-02). */
export type ViewLevelStack = {
  readonly key: { readonly kind: "PROPOSED_LEVEL_STACK"; readonly drawingId: string; readonly ingestId: string };
  /** The drawing the stack was read from, as the offer's sentence names it. */
  readonly label: string;
  readonly count: number;
  readonly levels: readonly { readonly label: string; readonly ordinal: number }[];
};

/** The whole reading, in one value (test contract: `RegisterView`). */
export type RegisterView = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly campaign: ViewCampaign | null;
  readonly objects: readonly ViewObject[];
  readonly lines: readonly ViewLine[];
  readonly refusals: readonly ViewRefusal[];
  readonly levelStacks: readonly ViewLevelStack[];
};
