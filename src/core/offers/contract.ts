// L-MEA-08's rail↔gate contract: what a rail hands the gate, said once, in the vocabulary both
// sides speak. "A rail is a pure function returning `{ offers, observations }`" — so a rail is a
// type, an offer is a type, and neither of them needs the gate to be written down.
//
// This is the home of that vocabulary rather than the gate, and deliberately: the gate is the sole
// writer of quantity lines (SEAM-GATE), which only holds if nothing outside the worker's handler can
// reach `src/core/gate` at all — a type-only import reaches it too. A module that has to type a rail
// imports this file, and the ban beside the gate (`src/core/gate/__tests__/gate-import-scan.ts`)
// stays total.
//
// Nothing here computes: "there is no field where a computed value could land" (L-MEA-08). Every
// reading an offer carries is what a drawing said, in the unit it was written in, and the carrying
// into canonical units is the gate's — through the one canon (B-17).
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { registerObjects } from "../db";
import type { RefusalCode } from "../errors";
import type { Coverage, DeductionChannel, Engine, GeometryType, QuantityBasis } from "./law";

// The rosters are the law file's, and published from here because this is the door a rail and the
// gate both read the contract at (B-17).
export { COVERAGES, DEDUCTION_CHANNELS, ENGINES, GEOMETRY_TYPES, QUANTITY_BASES } from "./law";
export type { Coverage, DeductionChannel, Engine, GeometryType, QuantityBasis } from "./law";

/**
 * One reading, as a rail offers it: what the drawing said, the unit it said it in, how it was known,
 * the entity it was read from and the calibration it stands on. The value stays as written — the
 * canonical value is the gate's to derive (L-QTY-03: "the raw reading and unit beside the SI value").
 */
export type Measure = {
  readonly value: string;
  readonly unit: string;
  readonly basis: QuantityBasis;
  readonly source: string;
  readonly calibration?: string;
};

/** One thing that might be deducted, in the channel it would be deducted through — never a sum. */
export type DeductionCandidate = {
  readonly channel: DeductionChannel;
  readonly measure: Measure;
};

/**
 * One offer: a rail's statement that this register object, read from this view of this drawing,
 * stands to be measured by this rule. It carries a `ruleId` with no version — which version is in
 * force is the project's pinned edition's to say, and the gate's to resolve (L-MEA-08).
 */
export type Offer = {
  readonly ruleId: string;
  readonly kind: Kind;
  readonly class: ElementType;
  readonly register: { readonly setRevisionId: string; readonly objectKey: string };
  readonly drawing: { readonly drawingId: string; readonly viewKey: string };
  readonly engine: Engine;
  /**
   * The geometry an offer was read off: the L-FRM-01 type, its own basis, and the calibration
   * reference it stands on. The reference is owed rather than optional — a line always carries "a
   * non-empty set of affirmed calibration references" (L-QTY-03) and a missing mandatory publishable
   * attribute is a hard block (L-QTY-04), so a rail that affirms none has made an offer that cannot
   * publish. Spelling it here keeps a rail from being type-correct and unpublishable at once.
   */
  readonly geometry: { readonly type: GeometryType; readonly basis: QuantityBasis; readonly calibration: string };
  /** The method's declared variables, each as a reading — the gate normalises them (L-MEA-08). */
  readonly bindings: Readonly<Record<string, Measure>>;
  /** The item-selecting attributes, carried onto the line beside the machine's derivation (L-QTY-03). */
  readonly selectors: Readonly<Record<string, Measure>>;
  readonly deductions: readonly DeductionCandidate[];
  /** The one coverage this leaf admits; the others arrive with the algebras that can be partial. */
  readonly coverage: Coverage;
};

/**
 * One observation a rail reports beside its offers: a rail-local closed code keyed (class × kind),
 * with the object and the source entity it is about where it is about one (L-MEA-08).
 */
export type RailObservation = {
  readonly class: ElementType;
  readonly kind: Kind;
  readonly code: string;
  readonly objectKey?: string;
  readonly sourceEntity?: string;
  readonly detail?: Record<string, unknown>;
};

/** One register object, as the store holds it — what a rail is handed to read (L-REG-01). */
export type RegisterObjectRow = typeof registerObjects.$inferSelect;

/** What a rail is asked: which campaign, over which pinned revision, for which kind, and of what. */
export type RailInput = {
  readonly campaignId: string;
  readonly setRevisionId: string;
  readonly kind: Kind;
  readonly objects: readonly RegisterObjectRow[];
};

/** What a rail answers with — offers and observations, and nothing computed (L-MEA-08). */
export type RailBatch = {
  readonly offers: readonly Offer[];
  readonly observations: readonly RailObservation[];
};

/** A rail: a pure function of what it was handed (L-MEA-08). It reaches no store and no clock. */
export type Rail = (input: RailInput) => RailBatch;

/** Which campaign, in which project of which workspace, a batch is being judged for. */
export type GateScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly campaignId: string;
};

/** One offer the gate refused, naming the object it was about and the registered code (L-MEA-08). */
export type GateRefusal = {
  readonly objectKey: string;
  readonly code: RefusalCode;
};

/**
 * The gate's total verdict over one batch: the three arms sum to the offers handed in, and every
 * refusal is RETURNED rather than thrown, so one bad offer never costs the others their answer.
 */
export type GateVerdict = {
  readonly published: number;
  readonly refused: number;
  readonly queued: number;
  readonly refusals: readonly GateRefusal[];
};

/**
 * The gate, as a caller types it. The one lawful caller is the worker's measure handler, so the
 * function's TYPE lives here with the rest of the contract: a module composing the job's dependencies
 * types the gate through this and never reaches `src/core/gate` (SEAM-GATE, riskNotes (2)).
 */
export type GateEvaluate = (scope: GateScope, batch: RailBatch) => Promise<GateVerdict>;
