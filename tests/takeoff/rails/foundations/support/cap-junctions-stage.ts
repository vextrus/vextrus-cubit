/**
 * FND-OWN's mechanics, over what the partition's pure stages READ of F-RCC6-BNBC: the 26 caps S-06
 * places by their rings, the 89 piles S-04 places by theirs, the grid both plans draw, and the rings
 * themselves out of the artifact — laid into the rails' setup exactly as `railSetupOf` lays them
 * (`pilesHeldOf`, `ringsOf`, `capJunctionSetupOf`, and the setup's own mappings `outlineSetupOf` and
 * `memberFamiliesSetupOf`). No database, no store, no model: one spelling of the relation serves the
 * product and this proof (B-17).
 *
 * What is stood in for is named, never hidden: the register rows (one per placed cap, MEASURED), the
 * one affirmed calibration every view stands on, and — where a case says so — the readings no reader
 * of the set carries yet: how far the piles' heads stand above the soffit, and the recess cast into
 * PC5 (I-544, I-546).
 */
import Decimal from "decimal.js";
import type { CapJunctionSetup, JunctionReading, Offer, RailBatch, RailSetup, RecessSetup, RegisterObjectRow } from "@/core/offers/contract";
import { implementationOf, type FormulaMethod } from "@/core/rulesets/methods/registry";
import { SEED_EDITION_CONTENT } from "@/core/rulesets/seed";
import { convert, dimensionOf, CANONICAL_UNIT, isUnit } from "@/core/units/canon";
import { viewAddressOf } from "@/core/views";
import { capJunctionSetupOf, pilesHeldOf, ringsOf } from "@/modules/takeoff/measure/cap-junctions";
import { memberFamiliesSetupOf, outlineSetupOf } from "@/modules/takeoff/measure/setup";
import type { PlacementRow } from "@/modules/takeoff/partition/placement/rows";
import { blindingRail, foundationConcreteRail, foundationFormworkRail } from "@/modules/takeoff/rails/foundations/index";
import { BNBC_DXF, stagesOver, type StagesRead } from "../../../partition/support/bnbc-stages";

export { BNBC_DXF };
export type { StagesRead };

/** The surrogate record, revision, campaign and calibration the rows are read under. */
const INGEST_ID = "fnd-own-ingest";
const SET_REVISION_ID = "fnd-own-revision";
const CAMPAIGN_ID = "fnd-own-campaign";
export const CALIBRATION = "fnd-own-calibration";

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
export const BUDGET_MS = 240_000;

let held: Promise<StagesRead> | undefined;

/** F-RCC6-BNBC, read ONCE per suite — lazily, so a refusal fails the case that needed it. */
export const bnbc = (): Promise<StagesRead> => (held ??= stagesOver(BNBC_DXF));

/** The caps and the piles the placement stage placed. */
export function capsOf(read: StagesRead): PlacementRow[] {
  return read.placed.placements.filter((row) => row.elementType === "pile_cap");
}
export function pilesOf(read: StagesRead): PlacementRow[] {
  return read.placed.placements.filter((row) => row.elementType === "pile");
}

/**
 * The piles each cap's ring holds, read as `railSetupOf` reads them: the placements, the grid axes
 * carried to the placements' view address by the one `viewAddressOf`, and the rings out of the
 * artifact by `ringsOf`.
 */
export function heldOver(read: StagesRead, adjust?: (axes: { viewKey: string; family: string; axis: string; label: string; position: number }[]) => typeof axes): Map<string, string[]> {
  const addressOf = new Map(read.evidence.views.map((view) => [view.viewKey, viewAddressOf(view as unknown as Parameters<typeof viewAddressOf>[0])]));
  const rings = ringsOf(read.graph);
  const axes = (read.evidence.grid?.axes ?? []).map((axis) => ({ viewKey: addressOf.get(axis.viewKey) ?? axis.viewKey, family: axis.family, axis: axis.axis, label: axis.label, position: axis.position }));
  return pilesHeldOf({
    placements: read.placed.placements.map((row) => ({ placementKey: row.placementKey, elementType: row.elementType, viewKey: row.viewKey, x: row.x, y: row.y, outlineKey: row.outlineKey })),
    axes: adjust === undefined ? axes : adjust(axes),
    ringOf: (key) => rings.get(key) ?? null,
  });
}

/** What a case stages beyond what the set's readers read: the head height and PC5's recess. */
export type Staged = {
  readonly headHeight?: JunctionReading;
  readonly recessOf?: (cap: PlacementRow) => RecessSetup | null;
};

/** The junction setup `railSetupOf` would hand the rails, with whatever a case stages over it. */
export function junctionsOver(read: StagesRead, staged: Staged = {}): Record<string, CapJunctionSetup> {
  const caps = new Map(capsOf(read).map((row) => [row.placementKey, row]));
  const junctions: Record<string, CapJunctionSetup> = {};
  for (const [cap, piles] of heldOver(read)) {
    const read = capJunctionSetupOf(cap, piles);
    const row = caps.get(cap) as PlacementRow;
    junctions[cap] = { ...read, headHeight: staged.headHeight ?? read.headHeight, recess: staged.recessOf?.(row) ?? read.recess };
  }
  return junctions;
}

/** The rails' setup over the stage read: caps AND piles placed, so a rail can read a held pile's schedule. */
export function setupOver(read: StagesRead, capJunctions: Record<string, CapJunctionSetup> | undefined): RailSetup {
  const outlines = new Map((read.placed.outlines ?? []).map((outline) => [outline.placementKey, outline]));
  const members = [...capsOf(read), ...pilesOf(read)];
  const placements = Object.fromEntries(
    members.map((row) => {
      const outline = outlines.get(row.placementKey);
      return [
        row.placementKey,
        {
          drawingId: "fnd-own-drawing",
          ingestId: INGEST_ID,
          viewKey: row.viewKey,
          memberFamily: row.memberFamily,
          engine: "VECTOR" as const,
          sourceEntity: row.placementKey,
          outline: outline === undefined ? null : outlineSetupOf(outline),
          noteShape: null,
          noteKey: null,
        },
      ];
    }),
  );
  const views = Object.fromEntries(members.map((row) => [row.viewKey, CALIBRATION]));
  return {
    placements,
    memberTypes: { [INGEST_ID]: memberFamiliesSetupOf(read.registered.families) },
    levels: [],
    calibrations: { [INGEST_ID]: views },
    grades: {},
    plans: {},
    runs: {},
    lintels: {},
    walls: {},
    surfaces: {},
    ...(capJunctions === undefined ? {} : { capJunctions }),
    siteFacts: {},
    edition: { digest: "0".repeat(64), parameters: SEED_EDITION_CONTENT.parameters },
    detailing: { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: [], sourceKeys: [] },
  };
}

/** The three kinds a cap's junctions touch, and the reader each is measured by (L-MEA-08). */
export const CAP_KINDS = Object.freeze({ concrete: "rcc.concrete", blinding: "pcc.blinding", formwork: "rcc.formwork" } as const);
type CapKind = (typeof CAP_KINDS)[keyof typeof CAP_KINDS];
const RAIL_OF = Object.freeze({ [CAP_KINDS.concrete]: foundationConcreteRail, [CAP_KINDS.blinding]: blindingRail, [CAP_KINDS.formwork]: foundationFormworkRail });

/** The register rows the caps stand for — one per placed cap, MEASURED, as the expansion registers a foundation. */
export function capRows(read: StagesRead): RegisterObjectRow[] {
  return capsOf(read).map(
    (row) =>
      ({ objectKey: `object|${row.placementKey}`, placementKey: row.placementKey, elementType: row.elementType, mark: row.mark, standing: "MEASURED", setRevisionId: SET_REVISION_ID }) as unknown as RegisterObjectRow,
  );
}

/** One kind's batch over every cap, under the setup a case built. */
export function capBatch(read: StagesRead, kind: CapKind, setup: RailSetup): RailBatch {
  return RAIL_OF[kind]({ campaignId: CAMPAIGN_ID, setRevisionId: SET_REVISION_ID, kind, objects: capRows(read), setup });
}

/** The cap row an offer is about. */
export function capOf(read: StagesRead, offer: Offer): PlacementRow {
  return capsOf(read).find((row) => `object|${row.placementKey}` === offer.register.objectKey) as PlacementRow;
}

/**
 * The figure an offer stands for, computed the way the gate computes it: the method its rule names
 * (version 1 — every rule here lands at 1), each binding carried to the canonical unit of the
 * dimension the method declares it in by the ONE canon, and the method's own tree. Null where the
 * offer is not COMPLETE — a kept row carries no quantity (L-QTY-02).
 */
export function figureOf(offer: Offer): Decimal | null {
  if (offer.coverage !== "COMPLETE") return null;
  const method = implementationOf({ ruleId: offer.ruleId, version: "1" }) as FormulaMethod | undefined;
  if (method === undefined || method.role !== "formula") throw new Error(`no formula implements ${offer.ruleId}@1`);
  const bound: Record<string, { value: string; unit: string }> = {};
  for (const variable of method.variables) {
    const reading = offer.bindings[variable.name];
    if (reading === undefined) throw new Error(`${offer.ruleId}: ${variable.name} is not bound`);
    const to = CANONICAL_UNIT[variable.dimension];
    if (!isUnit(reading.unit) || dimensionOf(reading.unit) !== variable.dimension) throw new Error(`${offer.ruleId}: ${variable.name} in ${reading.unit} is not a ${variable.dimension}`);
    const carried = convert(reading.value, reading.unit, to);
    if (!carried.ok) throw new Error(`${offer.ruleId}: ${variable.name} ${reading.value} ${reading.unit} cannot be carried`);
    bound[variable.name] = { value: carried.value, unit: to };
  }
  return new Decimal(method.evaluate(bound as never));
}

/** The exact sum of a batch's COMPLETE figures. */
export function sumOf(offers: readonly Offer[]): Decimal {
  return offers.reduce((sum, offer) => sum.plus(figureOf(offer) ?? 0), new Decimal(0));
}
