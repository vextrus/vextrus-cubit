// @vitest-environment node
/**
 * LEV-1's ratchet, on the drawing it was written for: F-RCC6-BNBC read by the SHIPPED `cad/` CLI
 * (L-CAD-01), put through the partition's pure stages, resolved over the stack J-000 walks — with the
 * FDN neck a person enters beneath GF — and measured by the column rail (I-338, I-339).
 *
 * What the drawing states, and what is graded here:
 *   · S-10's COLUMN LAYOUT PLAN places 27 columns, one plan the person authors as typical of GF..6F.
 *     26 of them stand on GF — the porch C7 among them, bound to GF alone by its note (I-303) — and
 *     C5 starts at 1F (`STARTS AT 1F`). So the neck carries exactly 26: never C5, and never a column
 *     the join "stands on a placed cap" would pick (it drops C7, which stands on the unmarked footing
 *     ring 638: 2.9627 m³, −3.18 %, out of band).
 *   · S-11's COLUMN SCHEDULE bands every family `GF TO 2ND` first; the neck takes that band's section
 *     (T-NOT-RANGE-GF3), and C7's plan note makes it round there as on GF (I-304).
 *   · The neck is 2'-0" = 0.6096 m, ENTERED citing S-25's column-line foot `1D59` — no text or
 *     attribute of the drawing states it (I-339). Printed as −0.610 it would stand over.
 *
 * AND WHAT MAY NOT MOVE: GF..6F keep their 26 lines each, and their figures, whether or not the neck is
 * entered.
 */
import { describe, expect, test } from "vitest";
import type { Offer, RailSetup, RegisterObjectRow } from "@/core/offers/contract";
import { resolveExpansion, type StackedLevel } from "@/modules/takeoff/partition/expansion/resolve";
import { partitionArtifact } from "@/modules/takeoff/partition/views/assign";
import { memberFamiliesSetupOf } from "@/modules/takeoff/measure/setup";
import { columnConcreteRail } from "@/modules/takeoff/rails/columns/index";
import { goldenCellAllowance, goldenCellRows } from "../../../golden/support/golden-fixture";
import { BNBC_DXF, stagesOver, type StagesRead } from "../support/bnbc-stages";

const FIXTURE = "rcc6-bnbc";

/** The golden's neck cell (L-QTY-06), in its own spelling. */
const NECK_CELL = { class: "COLUMN", kind: "RCC_CONCRETE", level: "FDN" } as const;

/**
 * The stack J-000 walks: the eight storeys S-25's section proposes, and the neck a person enters
 * beneath GF (ordinal −1). Each height as the walk states it — the section's own marks, and the neck
 * ENTERED off the column line's foot.
 */
const STOREYS: readonly { readonly label: string; readonly ordinal: number; readonly metres: string | null; readonly basis: string; readonly source: string }[] = [
  { label: "FDN", ordinal: -1, metres: "0.6096", basis: "ENTERED", source: "DXF_HANDLE:1D59" },
  { label: "GF", ordinal: 0, metres: "3.3528", basis: "TRANSCRIBED", source: "DXF_HANDLE:1D4C" },
  { label: "1F", ordinal: 1, metres: "3.048", basis: "TRANSCRIBED", source: "DXF_HANDLE:1D4E" },
  { label: "2F", ordinal: 2, metres: "3.048", basis: "TRANSCRIBED", source: "DXF_HANDLE:1D50" },
  { label: "3F", ordinal: 3, metres: "3.048", basis: "TRANSCRIBED", source: "DXF_HANDLE:1D52" },
  { label: "4F", ordinal: 4, metres: "3.048", basis: "TRANSCRIBED", source: "DXF_HANDLE:1D54" },
  { label: "5F", ordinal: 5, metres: "3.048", basis: "TRANSCRIBED", source: "DXF_HANDLE:1D56" },
  { label: "6F", ordinal: 6, metres: "3.048", basis: "TRANSCRIBED", source: "DXF_HANDLE:1D58" },
  { label: "ROOF", ordinal: 7, metres: null, basis: "TRANSCRIBED", source: "" },
];

/** The one plan whose range the walk authors for the columns (BNBC_TYPICAL_RANGES). */
const COLUMN_PLAN = "COLUMN LAYOUT PLAN";

let bnbcRead: Promise<StagesRead> | undefined;
const bnbc = (): Promise<StagesRead> => (bnbcRead ??= stagesOver(BNBC_DXF));

/** How long the drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

/** Each column the stack stands, measured: its register row's level, and the offer the rail made for it. */
type Measured = { readonly offers: readonly { readonly level: string; readonly mark: string; readonly offer: Offer }[]; readonly observed: readonly string[] };

/** The columns S-10 places, resolved over a stack and measured by the column rail — no database. */
async function measuredOver(withNeck: boolean): Promise<Measured> {
  const read = await bnbc();
  const storeys = STOREYS.filter((storey) => withNeck || storey.label !== "FDN");
  const levels: StackedLevel[] = storeys.map((storey) => ({ levelId: `level-${storey.label}`, label: storey.label, ordinal: storey.ordinal }));
  const parted = partitionArtifact(read.graph);
  const views = parted.views.flatMap((view) => (view.anchorKey === null ? [] : [{ caption: view.caption, view: { viewClass: view.type, captionAnchorSourceKey: view.anchorKey } }]));
  const columnView = parted.views.find((view) => view.caption.startsWith(COLUMN_PLAN));
  const columns = read.placed.placements.filter((row) => row.elementType === "column");
  const viewKey = columns.find((row) => row.viewKey.endsWith(String(columnView?.anchorKey)))?.viewKey;
  expect(viewKey, `S-10's ${COLUMN_PLAN} places the columns`).toBeDefined();

  const resolved = resolveExpansion({
    placements: columns,
    views,
    levels,
    ranges: [{ viewKey: viewKey as string, fromLevelId: "level-GF", toLevelId: "level-6F" }],
    families: read.registered.families.map((family) => ({ family: family.family, bands: family.variants.map((variant) => ({ from: variant.bandFrom, to: variant.bandTo })) })),
  });

  const setup = {
    placements: Object.fromEntries(
      columns.map((row) => [
        row.placementKey,
        {
          drawingId: "lev1-drawing",
          ingestId: "lev1-ingest",
          viewKey: row.viewKey,
          memberFamily: row.memberFamily,
          engine: "VECTOR",
          sourceEntity: row.placementKey,
          outline: null,
          noteShape: row.note?.shape ?? null,
          noteKey: row.note?.sourceKey ?? null,
        },
      ]),
    ),
    memberTypes: { "lev1-ingest": memberFamiliesSetupOf(read.registered.families) },
    levels: storeys.map((storey) => ({
      levelId: `level-${storey.label}`,
      label: storey.label,
      ordinal: storey.ordinal,
      height:
        storey.metres === null
          ? { standing: "NONE", value: null, unit: null, basis: null, sourceKey: null }
          : { standing: "AGREED", value: storey.metres, unit: "m", basis: storey.basis, sourceKey: storey.source },
    })),
    calibrations: { "lev1-ingest": { [viewKey as string]: "lev1-calibration" } },
    grades: {},
    plans: {},
    runs: {},
    lintels: {},
    walls: {},
    surfaces: {},
    siteFacts: {},
    edition: { digest: "0".repeat(64), parameters: {} },
    detailing: { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: false, sourceKeys: [] },
  } as unknown as RailSetup;
  const rows = resolved.rows.map(
    (row) =>
      ({
        objectKey: row.objectKey,
        placementKey: row.placement.placementKey,
        elementType: "column",
        levelId: "levelId" in row.level ? row.level.levelId : null,
        standing: row.standing,
        setRevisionId: "lev1-revision",
      }) as unknown as RegisterObjectRow,
  );
  const batch = columnConcreteRail({ campaignId: "lev1-campaign", setRevisionId: "lev1-revision", kind: "rcc.concrete", objects: rows, setup });
  const levelOf = new Map(resolved.rows.map((row) => [row.objectKey, "levelId" in row.level ? row.level.levelId.replace("level-", "") : "slot"]));
  const markOf = new Map(resolved.rows.map((row) => [row.objectKey, row.placement.mark]));
  return {
    offers: batch.offers.map((offer) => ({ level: levelOf.get(offer.register.objectKey) ?? "", mark: markOf.get(offer.register.objectKey) ?? "", offer })),
    observed: batch.observations.map((observation) => observation.code),
  };
}

/** One column's concrete in m³ — L-FRM-02's arithmetic done here, independently of the product's methods. */
function volumeOf(offer: Offer): number {
  const metres = (name: string): number => Number(offer.bindings[name]?.value) * (offer.bindings[name]?.unit === "mm" ? 1e-3 : 1);
  const height = metres("H");
  if (offer.bindings["d"] !== undefined) return (Math.PI / 4) * metres("d") * metres("d") * height;
  return metres("L") * metres("B") * height;
}

/** The lines and the figure the rail offered on one storey. */
function storey(measured: Measured, label: string): { readonly count: number; readonly figure: number; readonly offers: readonly Offer[] } {
  const held = measured.offers.filter((one) => one.level === label).map((one) => one.offer);
  return { count: held.length, figure: held.reduce((sum, offer) => sum + volumeOf(offer), 0), offers: held };
}

describe("I-338, I-339: F-RCC6-BNBC's columns continue down to the FDN neck, and the neck stands inside the golden's band", () => {
  test("26 neck lines, all COMPLETE and DERIVED, sized by GF TO 2ND — C7 round, C5 absent — over H = 0.6096 m ENTERED off 1D59", async () => {
    const measured = await measuredOver(true);
    expect(measured.observed, "every column stood on a level its schedule sizes it at — nothing SECTION_BAND_UNCOVERED at the neck").toEqual([]);
    const neck = storey(measured, "FDN");
    expect(neck.count, "one neck per column standing on GF: 27 placed, less C5, which starts at 1F").toBe(26);
    expect(new Set(measured.offers.filter((one) => one.level === "FDN").map((one) => one.mark)).has("C5"), "the floating C5 has no neck (a neck given to it is over)").toBe(false);
    expect(neck.offers.every((offer) => offer.coverage === "COMPLETE"), "every reading stated").toBe(true);
    expect(neck.offers.every((offer) => offer.geometry.basis === "DERIVED"), "nothing drew a neck: each is its ground-storey member continued").toBe(true);
    const round = measured.offers.filter((one) => one.level === "FDN" && one.offer.ruleId === "rcc.column.circular.concrete");
    expect(round.map((one) => [one.mark, one.offer.bindings["d"]?.value]), "the porch C7 keeps its neck, and it is round there as on GF (I-304)").toEqual([["C7", "450"]]);
    expect(
      neck.offers.every((offer) => offer.bindings["H"]?.value === "0.6096" && offer.bindings["H"]?.basis === "ENTERED" && offer.bindings["H"]?.source === "DXF_HANDLE:1D59"),
      "H is the neck the person entered, citing the column line's foot",
    ).toBe(true);
    const c1 = measured.offers.find((one) => one.level === "FDN" && one.mark === "C1")?.offer;
    expect([c1?.bindings["L"]?.value, c1?.bindings["B"]?.value], "and a C1 neck is GF TO 2ND's 400 × 400 (T-NOT-RANGE-GF3)").toEqual(["400", "400"]);
  }, BUDGET_MS);

  test("COLUMN × RCC_CONCRETE × FDN is inside L-QTY-06's band — three per cent under at most, never over", async () => {
    const neck = storey(await measuredOver(true), "FDN");
    const rows = goldenCellRows(FIXTURE, NECK_CELL);
    const golden = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const allowance = Number(goldenCellAllowance(FIXTURE, NECK_CELL));
    expect(rows.length, "the golden states the cell").toBeGreaterThan(0);
    expect(neck.count, "one line per member the golden lists at FDN").toBe(new Set(rows.flatMap((row) => row.members ?? [])).size);
    expect(neck.figure, `${neck.figure.toFixed(6)} m³ is not over ${golden} + ${allowance}`).toBeLessThanOrEqual(golden + allowance);
    expect(neck.figure, `${neck.figure.toFixed(6)} m³ is no more than three per cent under ${golden}`).toBeGreaterThanOrEqual(golden * 0.97 - allowance);
    expect(neck.figure, "(4.86 m² of rectangles + π/4 · 0.45²) × 0.6096 m").toBeCloseTo(3.059609, 5);
  }, BUDGET_MS);

  test("GF..6F do not move: the same 26 lines and the same figure on every storey whether or not the neck is entered", async () => {
    const [withNeck, without] = [await measuredOver(true), await measuredOver(false)];
    expect(storey(without, "FDN").count, "no neck entered, no neck measured").toBe(0);
    for (const label of ["GF", "1F", "2F", "3F", "4F", "5F", "6F"]) {
      const [held, before] = [storey(withNeck, label), storey(without, label)];
      expect(held.count, `${label}: 26 lines`).toBe(26);
      expect([held.count, held.figure], `${label}: unchanged by the neck beneath it`).toEqual([before.count, before.figure]);
    }
  }, BUDGET_MS);
});
