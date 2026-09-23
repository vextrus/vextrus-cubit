/**
 * The foundations rails run over what the partition's pure stages READ of a drawing's pile caps —
 * mechanics only, and no database. The placements, the plans their rings enclose and the families the
 * schedules registered are carried into the rails' setup through the measure setup's OWN mappings
 * (`outlineSetupOf`, `memberFamiliesSetupOf`), exactly as `railSetupOf` carries the stored ones: one
 * spelling of the mapping serves the product and this proof (B-17). What is stood in for is named: the
 * register rows (one per placed cap, MEASURED, as the expansion registers a foundation) and the one
 * affirmed calibration every view stands on. The database lane grades the same reading through the
 * store and the gate (tests/takeoff/rails/foundations/pile-cap-outline-store.test.ts).
 */
import type { Offer, RailSetup, RegisterObjectRow } from "@/core/offers/contract";
import { SEED_EDITION_CONTENT } from "@/core/rulesets/seed";
import { memberFamiliesSetupOf, outlineSetupOf } from "@/modules/takeoff/measure/setup";
import type { PlacementRow } from "@/modules/takeoff/partition/placement/rows";
// The area's DOOR (`foundations/index.ts`), named whole: `rails/foundations.ts` beside it is the
// area's roster, which keys the rails by kind and publishes no rail by name.
import { blindingRail, foundationConcreteRail } from "@/modules/takeoff/rails/foundations/index";
import type { StagesRead } from "../../support/bnbc-stages";

export type { Measure } from "@/core/offers/contract";

/** The two kinds a cap's plan decides, and the rail each is measured by (L-MEA-08). */
export const CAP_KINDS = Object.freeze({ concrete: "rcc.concrete", blinding: "pcc.blinding" } as const);
type CapKind = (typeof CAP_KINDS)[keyof typeof CAP_KINDS];

/** The surrogate record, revision, campaign and calibration the rows are read under. */
const INGEST_ID = "fdn2-ingest";
const SET_REVISION_ID = "fdn2-revision";
const CAMPAIGN_ID = "fdn2-campaign";
const CALIBRATION = "fdn2-calibration";

/** One offer a rail made, beside the placement its register row stands for. */
export type CapOffer = { readonly offer: Offer; readonly row: PlacementRow };

/** Every pile cap the stages placed, offered by the rail of one kind over the setup the stages read. */
export function capOffersOver(read: StagesRead, kind: CapKind): CapOffer[] {
  const caps = read.placed.placements.filter((row) => row.elementType === "pile_cap");
  const outlines = new Map((read.placed.outlines ?? []).map((outline) => [outline.placementKey, outline]));
  const placements = Object.fromEntries(
    caps.map((row) => {
      const outline = outlines.get(row.placementKey);
      return [
        row.placementKey,
        {
          drawingId: "fdn2-drawing",
          ingestId: INGEST_ID,
          viewKey: row.viewKey,
          memberFamily: row.memberFamily,
          engine: "VECTOR",
          sourceEntity: row.placementKey,
          outline: outline === undefined ? null : outlineSetupOf(outline),
          noteShape: null,
          noteKey: null,
        },
      ];
    }),
  );
  const views = Object.fromEntries(caps.map((row) => [row.viewKey, CALIBRATION]));
  const setup = {
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
    siteFacts: {},
    edition: { digest: "0".repeat(64), parameters: SEED_EDITION_CONTENT.parameters },
    detailing: { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: false, sourceKeys: [] },
  } as unknown as RailSetup;
  const objects = caps.map(
    (row) => ({ objectKey: `object|${row.placementKey}`, placementKey: row.placementKey, elementType: row.elementType, standing: "MEASURED", setRevisionId: SET_REVISION_ID }) as unknown as RegisterObjectRow,
  );
  const rail = kind === CAP_KINDS.concrete ? foundationConcreteRail : blindingRail;
  const batch = rail({ campaignId: CAMPAIGN_ID, setRevisionId: SET_REVISION_ID, kind, objects, setup });
  const rowOf = new Map(caps.map((row) => [`object|${row.placementKey}`, row]));
  return batch.offers.map((offer) => ({ offer, row: rowOf.get(offer.register.objectKey) as PlacementRow }));
}
