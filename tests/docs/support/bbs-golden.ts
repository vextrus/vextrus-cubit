/**
 * The bar schedule's golden roster, as this lane reaches it (AM-01), and the schedule document the
 * PRODUCT composes from it (s-bbs I-534, I-535).
 *
 * The reading itself belongs to the golden lane's published support — `bbsGoldenDocument()` is the
 * ONE home for "what does `fixtures/<id>/bbs.golden.json` say" (CLAUDE.md: a golden is read through
 * the fixture support, never by a second parser). This module names the fixture this lane's document
 * is composed from, and composes it through the product's own path: the golden rows renamed field for
 * field into the rows the store holds, the door's own `bbsDocumentOf` (which states each mark once per
 * floor and totals the bill), and the export's own `bbsPayloadOf`. So the committed payload is never a
 * list somebody typed, re-rounded or re-ordered: it is what the product emits for the golden's
 * columns and shear walls at FDN, GF and 1F, and a payload that is anything else fails the lane.
 */
import { bbsGoldenDocument, type BbsGoldenDocument, type BbsGoldenRow } from "../../golden/support/golden-fixture";
import { productModule } from "./product";

export type { BbsGoldenDocument, BbsGoldenRow };

/** The fixture whose detailing model the schedule is proved against (AM-01, the increment's goal). */
export const BBS_FIXTURE = "rcc6-bnbc";

/** Every golden row of that fixture, in the file's own order. */
export function bbsGoldenRows(fixtureId: string = BBS_FIXTURE): BbsGoldenRow[] {
  return bbsGoldenDocument(fixtureId).rows;
}

/**
 * What the committed schedule is drawn from: the classes the product's rebar rail reads (columns and
 * shear walls, `READ_CLASSES`) on the three floors from the foundation up. Enough to state marks many
 * times over (C2 × 8 on every floor), to reach every shape the columns are bent to, laps and ties, and
 * a spiral — and little enough to read.
 */
export const BBS_DOCUMENT_CLASSES: readonly string[] = Object.freeze(["COLUMN", "SHEAR_WALL"]);
export const BBS_DOCUMENT_LEVELS: readonly string[] = Object.freeze(["FDN", "GF", "1F"]);

/** The golden rows the committed schedule is drawn from, in the file's own order. */
export function bbsDocumentRows(fixtureId: string = BBS_FIXTURE): BbsGoldenRow[] {
  return bbsGoldenRows(fixtureId).filter((row) => BBS_DOCUMENT_CLASSES.includes(row.class) && BBS_DOCUMENT_LEVELS.includes(row.level));
}

/**
 * The particulars the committed schedule states — a fixture's, stated here once so the render is the
 * same document on every machine (the document asks no clock, R-SPINE-040). The client and the site
 * are the journeys' own project's (`Sattva Holdings`, the J-010 precedent).
 */
export const BBS_DOCUMENT_META = Object.freeze({
  title: "Bar bending schedule",
  project: "Sattva Court",
  particulars: Object.freeze({
    code: "SC-001",
    client: "Sattva Holdings",
    site: "Bashundhara R/A, Dhaka",
    drawingSet: "Structural drawings",
    revision: 2,
    pinnedOn: Object.freeze({ year: 2026, month: 9, day: 22 }),
    issuedOn: Object.freeze({ year: 2026, month: 9, day: 24 }),
  }),
  // The golden details every bar — laps and ties included — so the schedule it composes is whole.
  partial: false,
  omitted: Object.freeze([]),
});

/**
 * What a case may state beside the committed particulars: a reading whose lines left components out
 * (`partial`, `omitted`), the members whose laps they left out (`deferred`, s-bbs I-567) and the
 * steel no line was published for (`notInSchedule`, I-569).
 */
export type BbsDocumentMeta = Omit<typeof BBS_DOCUMENT_META, "partial" | "omitted"> & {
  readonly partial: boolean;
  readonly omitted: readonly { readonly code: string; readonly components: readonly string[] }[];
  readonly deferred?: readonly string[];
  readonly notInSchedule?: readonly { readonly about: string; readonly levels: string; readonly why: string }[];
};

/** A stored bar row, as far as this lane needs the store's shape. */
type StoredRow = Record<string, unknown> & { objectKey: string };

type RebarModules = {
  store: {
    bbsDocumentOf(campaignId: string, rows: readonly StoredRow[]): unknown;
    readingOrder(stack: readonly { label: string; ordinal: number }[]): (one: StoredRow, other: StoredRow) => number;
  };
  bars: { barRowKeyOf(at: { objectKey: string; role: string; diameterMm: number; sequence: number }): string; REBAR_EDITION: unknown };
  detailing: { kgPerMetreOf(edition: unknown, diameterMm: number): string };
  emission: { bbsPayloadOf(document: unknown, meta: BbsDocumentMeta): unknown };
};

async function rebarModules(): Promise<RebarModules> {
  return {
    store: await productModule<RebarModules["store"]>("src/modules/takeoff/rebar/store.ts"),
    bars: await productModule<RebarModules["bars"]>("src/modules/takeoff/rebar/bars.ts"),
    detailing: await productModule<RebarModules["detailing"]>("src/core/rulesets/methods/rebar/detailing-bnbc2020-bd.ts"),
    emission: await productModule<RebarModules["emission"]>("src/modules/takeoff/bbs-ui/emission.ts"),
  };
}

/** The level stack the golden's floors stand in, from the foundation up (L-MEA-07: by ordinal). */
const STACK = Object.freeze(BBS_DOCUMENT_LEVELS.map((label, ordinal) => ({ label, ordinal })));

/**
 * The payload the product emits for the golden rows above: each golden row renamed into the row the
 * store would hold (its rate the edition's own kg/m figure for its diameter, its citations the golden
 * file's, the same for every member so only the BARS decide what groups), read in the door's own
 * order over that stack (`readingOrder`), the door's document over them, and the export's payload of
 * that document under `BBS_DOCUMENT_META`.
 */
export async function bbsGoldenPayload(fixtureId: string = BBS_FIXTURE, reading: Partial<BbsDocumentMeta> = {}): Promise<unknown> {
  const { store, bars, detailing, emission } = await rebarModules();
  const rows: StoredRow[] = bbsDocumentRows(fixtureId).map((row, sequence) => ({
    barKey: bars.barRowKeyOf({ objectKey: row.member, role: row.role, diameterMm: row.dia_mm, sequence }),
    objectKey: row.member,
    class: row.class.toLowerCase(),
    level: row.level,
    mark: row.mark,
    barMark: row.bar_mark,
    role: row.role,
    diameterMm: row.dia_mm,
    shape: row.shape,
    dimsMm: row.dims_mm,
    cuttingRawMm: row.cutting_raw_mm,
    cuttingRoundedMm: row.cutting_rounded_mm,
    cuttingIsAdditiveMm: row.cutting_is_additive_mm,
    piecesPerBar: row.pieces_per_bar,
    lapMm: row.lap_mm,
    lapsPerBar: row.laps_per_bar,
    barsPerUnit: row.bars_per_unit,
    parentCount: row.parent_count,
    bars: row.bars,
    kgPerMetre: detailing.kgPerMetreOf(bars.REBAR_EDITION, row.dia_mm),
    kgNet: row.kg_net,
    kgLap: row.kg_lap,
    kg: row.kg,
    sourceKeys: [`fixtures/${fixtureId}/bbs.golden.json`],
    detailingSourceKeys: [],
    editionDigest: fixtureId,
    semantic: `${row.member}|${String(sequence)}`,
  }));
  rows.sort(store.readingOrder(STACK));
  return emission.bbsPayloadOf(store.bbsDocumentOf(`${fixtureId}-campaign`, rows), { ...BBS_DOCUMENT_META, ...reading });
}
