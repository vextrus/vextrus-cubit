// L-QTY-05 as law: what a cell of the residue IS, what a channel may say about one, and the closed
// causes a cell may stand under. Nothing here touches a database — the residue is a query and not a
// table, so its vocabulary is a value the query, the screen and (later) the certificate all read
// from one home (ARCH-02, B-17).
//
// The causes below are not spelled here on their own authority: each is a code of the register in
// `../errors.ts`, and the `satisfies` below is what makes that a compile-time reading rather than an
// agreement by coincidence (Q-07, R-SPINE-062).
import type { RefusalCode } from "../errors";

/**
 * The three channels sighting is a union of EXISTS over (L-QTY-05): register rows of the class, the
 * stored partition's placements and member-type families, and view membership from the layout
 * inventory. A reader answers what it SAW — the union is over what the three return, never over an
 * absence one of them declares.
 */
export const SIGHTING_CHANNELS = ["REGISTER", "PARTITION", "LAYOUT"] as const;

/** One channel, drawn from the closed roster above. */
export type SightingChannel = (typeof SIGHTING_CHANNELS)[number];

/**
 * One sighting: a class, seen on a level, in one channel, on one sheet of the campaign's pinned
 * manifest, at the key it was read at. There is no `absent()` constructor anywhere — a channel that
 * saw nothing returns an empty list, which is the only way it can say "nothing" (L-QTY-05).
 */
export type Sighting = {
  readonly class: string;
  readonly levelId: string | null;
  readonly channel: SightingChannel;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly sourceKey: string;
};

/**
 * Why a cell stands unmeasured, on the measurement axis. The order is the order the arms resolve in
 * and the order a legend enumerates them in — the fall-through last (L-QTY-05, R-TO-052).
 */
export const MEASUREMENT_CAUSES = [
  "NOT_ESTABLISHED",
  "INGESTION_TRUNCATED",
  "NOT_IN_PROJECT_SCOPE",
  "NO_BEARER_SIGHTED",
  "KIND_NOT_YET_SEEDED",
] as const satisfies readonly RefusalCode[];

/** One measurement-axis cause, drawn from the closed roster above. */
export type MeasurementCause = (typeof MEASUREMENT_CAUSES)[number];

/** Why a cell stands outside this bill. One axis, one cause: a person held the kind out (R-TO-052). */
export const BILL_CAUSES = ["NOT_IN_THIS_BILL"] as const satisfies readonly RefusalCode[];

/** One bill-axis cause, drawn from the closed roster above. */
export type BillCause = (typeof BILL_CAUSES)[number];

/** What a cell reads as on the measurement axis: published quantity, or the cause it stands under. */
export const QUANTITY_BEARING = "QUANTITY_BEARING" as const;

/** What a cell reads as on the bill axis when nobody has held it out. */
export const IN_BILL = "IN_BILL" as const;

/** The measurement axis' whole reading — the two axes are orthogonal (L-QTY-05). */
export type MeasurementReading = typeof QUANTITY_BEARING | MeasurementCause;

/** The bill axis' whole reading. */
export type BillReading = typeof IN_BILL | BillCause;

/**
 * The two readings an axis stands at when nothing is wrong. They are refusal-SHAPED and are not
 * refusals — a cell that bears quantity is answered with a figure, never with one of these names —
 * so they are declared as this tree's own vocabulary in `../errors/transport-vocabulary.ts`, which
 * reads this roster rather than copying it (Q-07).
 */
export const AXIS_IDLE_READINGS = [QUANTITY_BEARING, IN_BILL] as const;

/** Every cause a cell of this grid may stand under, on either axis — the legend's closed set. */
export const RESIDUE_CAUSES = [...MEASUREMENT_CAUSES, ...BILL_CAUSES] as const;

/** One cause of either axis. */
export type ResidueCause = MeasurementCause | BillCause;

/**
 * The two grains the grid holds. A cell is (sighted class × kind borne × level sighted); a kind no
 * sighted class bears, and a work item no class bears at all, cannot be celled out and stand as
 * kind-grain rows instead — shown, never hidden (L-QTY-07, R-UI-050).
 */
export const CELL_GRAINS = ["CELL", "KIND"] as const;

/** One grain, drawn from the closed roster above. */
export type CellGrain = (typeof CELL_GRAINS)[number];

/** One rail observation, as a cell carries it: evidence for the reader, never the cause (L-QTY-07). */
export type ResidueObservation = {
  readonly class: string;
  readonly kind: string;
  readonly levelId: string | null;
  readonly rail: string;
  readonly reason: string;
};

/** One in-force declaration a person made over a cell, as the residue reads one (L-ACT-01). */
export type ResidueDeclaration = {
  readonly class: string;
  readonly kind: string;
  readonly levelId: string;
  readonly cause: "NOT_IN_PROJECT_SCOPE" | "NOT_IN_THIS_BILL";
  readonly actId: string;
  readonly inForce: boolean;
  /** Whether the act the declaration names still resolves — a row whose act does not says nothing. */
  readonly actResolves: boolean;
};

/** One published quantity line, as the residue reads one: which cell it stands in (L-QTY-03). */
export type ResidueLine = {
  readonly kind: string;
  readonly class: string;
  readonly levelId: string;
  readonly lineId: string;
};

/** One level of the project's stack, as the grid's columns are ordered by (L-MEA-07). */
export type ResidueLevel = {
  readonly levelId: string;
  readonly ordinal: number;
  readonly label: string;
};

/** One sheet of the manifest that was read only in part (risk note 4). */
export type TruncatedSheet = {
  readonly drawingId: string;
  readonly layoutName: string;
};

/**
 * Everything the residue is resolved from, in one value. The reading is composed once, by the query
 * beside this file, and the resolution is pure — so the arms L-QTY-05 fixes can be judged without a
 * database, and the certificate reads the same answer the grid does (B-19).
 */
export type ResidueInput = {
  readonly bears: readonly { readonly class: string; readonly kind: string }[];
  readonly workItems: readonly string[];
  readonly levels: readonly ResidueLevel[];
  readonly sightings: readonly Sighting[];
  readonly lines: readonly ResidueLine[];
  readonly declarations: readonly ResidueDeclaration[];
  readonly truncated: readonly TruncatedSheet[];
  readonly observations: readonly ResidueObservation[];
};

/**
 * One cell of the residue, resolved: where it stands, how each axis reads it, whether a declaration
 * over it is beaten by published lines, and the evidence a reader is shown for it.
 */
export type ResidueCell = {
  readonly kind: string;
  readonly class: string;
  readonly levelId: string | null;
  /** The level's own label, as a reader reads it — never the surrogate's id (I-25). */
  readonly levelLabel: string;
  readonly grain: CellGrain;
  readonly measurement: MeasurementReading;
  readonly bill: BillReading;
  /** A declaration this cell's published lines deny, marked and never withdrawn (I-192). */
  readonly contradicted: boolean;
  readonly lineIds: readonly string[];
  readonly sightings: readonly Sighting[];
  readonly observations: readonly ResidueObservation[];
  /** The act a measurement-axis declaration was made by, where one stands. */
  readonly measurementActId: string | null;
  /** The act a bill-axis declaration was made by, where one stands. */
  readonly billActId: string | null;
};

/** One row of a boundary statement: the cell it stands over and the cause it stands under. */
export type StatementRow = {
  readonly kind: string;
  readonly class: string;
  readonly levelId: string | null;
  readonly levelLabel: string;
  readonly grain: CellGrain;
  readonly cause: ResidueCause;
};

/** The separator a cell's address is spelled with — `{kind}:{class}:{levelId}` (Decision § 7). */
const CELL_SEPARATOR = ":";

/**
 * One cell's address, spelled once (B-17): the screen's `?cell=` parameter, the inspector's
 * `data-cell` and the key a grid renders a cell under are all this string. A kind-grain row carries
 * neither class nor level, so it addresses as `{kind}::`.
 */
export function cellRef(cell: { readonly kind: string; readonly class: string; readonly levelId: string | null }): string {
  return [cell.kind, cell.class, cell.levelId ?? ""].join(CELL_SEPARATOR);
}

/**
 * The cell an address names, or null where the address names none. Nothing is invented for a stale
 * address: an unparsable one selects nothing (I-193).
 */
export function parseCellRef(raw: string): { readonly kind: string; readonly class: string; readonly levelId: string | null } | null {
  const parts = raw.split(CELL_SEPARATOR);
  if (parts.length !== 3) return null;
  const [kind, klass, levelId] = parts as [string, string, string];
  if (kind === "") return null;
  return { kind, class: klass, levelId: levelId === "" ? null : levelId };
}
