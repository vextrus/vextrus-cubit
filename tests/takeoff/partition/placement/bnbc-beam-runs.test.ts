// @vitest-environment node
/**
 * FRM-1's ratchet, on the drawing it was written for: F-RCC6-BNBC read by the SHIPPED `cad/` CLI
 * (L-CAD-01) and put through the partition's pure stages exactly as the rebuild runs them (R-TO-030).
 * No database, no store, no model.
 *
 * FRM-1 opens no bill. It makes the beam layouts READABLE, so the door after it (FRM-2's stated-width
 * pairing) has runs worth pairing:
 *   · I-340 — a run's clear is read in the unit the drawing's own notes declare (S-01's `1F3E`: "ALL
 *     DIMENSIONS ARE IN MILLIMETRES"), where the header is unitless and the members bear it out — the
 *     one reading the rings already use — and it cites the declaration. And a support is addressed off
 *     each axis by the axis's OWN orientation: BNBC letters its grid along y and numbers it along x,
 *     F-RCC6 the other way about, and a beam of S-14 is carried by the columns S-10 places.
 *   · I-341 — `RB`, `REB`, `CB`, `EB`, `LB`, `PB`, `TG`, `SB-R` and the storey-keyed `1B`/`1CB`/`1EB`
 *     are beams, by exact prefix (`GB` held back); graded in `src/modules/takeoff/partition/placement/law.test.ts`.
 *   · I-342 — the architect's plan bound into S-13 (`ARCH-PLAN$0$…`) is no member of this drawing.
 *
 * The edition's pairing band is 0.08 × the minimum spacing — 195.1 on BNBC — and BNBC's beams are 250,
 * 300 and 400 wide, so at the edition's band nothing here pairs a beam at all: the band is FRM-2's door
 * (D2, a pair is a member where its gap is its mark's scheduled width — I-344, graded in
 * bnbc-beam-sections.test.ts). The runs this door governs are read by asking the SAME stage the same
 * question with only the pairing share widened, which is the one share a run's pairing reads.
 *
 * FRM-3 (I-460) places the beams lettered turned on their own axes, and a placed member is the
 * crossing face a run ending on it is cut at: graded here on S-14's B12 and EB1, whose clears were
 * OVER the golden's while the members carrying their ends went unnamed.
 *
 * AND WHAT MAY NOT MOVE — F-RCC6's whole stage output (`a3c0c6e0…`) and BNBC's piles, columns and caps,
 * pinned in tests/takeoff/partition/schedules/bnbc-pile-schedule.test.ts and bnbc-pile-caps.test.ts.
 */
import { describe, expect, test } from "vitest";
import { detectPlacements } from "@/modules/takeoff/partition/placement/detect";
import { classOfMark, isFramedClass } from "@/modules/takeoff/partition/placement/law";
import type { DetectedPlacements, PlacementRow, RunRow } from "@/modules/takeoff/partition/placement/rows";
import { BNBC_DXF, SEED_SHARES, stagesOver, type StagesRead } from "../support/bnbc-stages";

/** S-14 TYPICAL FLOOR BEAM LAYOUT, and S-10's COLUMN LAYOUT PLAN — the plan that places the columns. */
const TYPICAL_BEAMS = "v:LAYOUT_PLAN:DXF_HANDLE:F31";
const COLUMN_PLAN = "v:LAYOUT_PLAN:DXF_HANDLE:20B6";
/** S-13 1ST FLOOR BEAM LAYOUT — the plan the architect's walls and windows are bound into. */
const FIRST_FLOOR_BEAMS = "v:LAYOUT_PLAN:DXF_HANDLE:2116";

/** S-01's general note: "ALL DIMENSIONS ARE IN MILLIMETRES UNLESS FIGURED IN FEET AND INCHES" (I-302). */
const DECLARATION = "DXF_HANDLE:1F3E";

/** A pairing band wide enough to pair BNBC's 250/300/400 beams: the share FRM-2 replaces by stated widths. */
const WIDENED_PAIRING = "0.2";

/**
 * The three clears the golden's own model measures (`fixtures/rcc6-bnbc/model.json`), each between the
 * faces of the GF–2F columns S-10 draws at its two ends — and the edge lines S-14 draws it as, and the
 * grid reference of each end's column on S-10. Measured before I-340's orientation (a support looked
 * up off the wrong axis, every end falling through to the crossing beam's edges) they read 4297, 4017.2
 * and 4297: each OVER by the two column half-widths.
 */
const CLEARS: Readonly<Record<string, { readonly clear: string; readonly edges: readonly [string, string]; readonly ends: readonly (readonly [string, string])[] }>> = Object.freeze({
  // A1 → A2: 4572 c/c less C1's 200 and C2's 150.
  B1: { clear: "4222.0", edges: ["DXF_HANDLE:E98", "DXF_HANDLE:E99"], ends: [["A", "1"], ["A", "2"]] },
  // B1 → B2: 4572 c/c less C3's 250 and C4's 225.
  B6: { clear: "4097.0", edges: ["DXF_HANDLE:ED8", "DXF_HANDLE:ED9"], ends: [["B", "1"], ["B", "2"]] },
  // B2 → B3: 4267.2 c/c less C4's 225 at each end.
  B7: { clear: "3817.2", edges: ["DXF_HANDLE:EDA", "DXF_HANDLE:EDB"], ends: [["B", "2"], ["B", "3"]] },
});

let bnbcRead: Promise<StagesRead> | undefined;
/** The drawing is read ONCE for the whole suite — lazily, so a refusal fails the case that needed it. */
const bnbc = (): Promise<StagesRead> => (bnbcRead ??= stagesOver(BNBC_DXF));

/** The same stage over the same evidence, with only the pairing share widened. */
async function widened(): Promise<{ readonly read: StagesRead; readonly placed: DetectedPlacements }> {
  const read = await bnbc();
  return { read, placed: detectPlacements({ ...read.evidence, shares: { ...SEED_SHARES, containmentMerge: WIDENED_PAIRING } }) };
}

/** The framed members one reading placed. */
const framedOf = (placed: DetectedPlacements): PlacementRow[] => placed.placements.filter((row) => row.elementType === "beam" || row.elementType === "tie_beam");

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

describe("FRM-1 at the edition's own pairing band", () => {
  test("the band itself pairs none of BNBC's beams — 250, 300 and 400 wide against 195.1 — and nothing is placed in their stead (TEST_AMENDED, FRM-2)", async () => {
    // TEST_AMENDED (FRM-2, I-344): FRM-1 asserted no framed member at all at the edition's band; FRM-2
    // admits a pair wider than the band where its gap is its naming mark's scheduled width. What FRM-1
    // proved still holds, and is asked the way it can still be asked: with no beam width stated, the
    // band alone places nothing.
    const { evidence } = await bnbc();
    const unstated = evidence.families.filter((family) => !isFramedClass(classOfMark(family.family)));
    const placed = detectPlacements({ ...evidence, families: unstated });
    expect(framedOf(placed), "no framed member on any BNBC plan off the band alone").toEqual([]);
    expect(placed.runs ?? [], "and so no run").toEqual([]);
  }, BUDGET_MS);

  test("I-342: the architect's walls and windows bound into S-13 — eight congruent pairs 125 apart, under the 1B marks — are no beams", async () => {
    const { read, placed } = await widened();
    const layerOf = new Map(read.graph.entities.map((entity) => [entity.key, entity.layer]));
    const walled = read.graph.entities.filter((entity) => ["ARCH-PLAN$0$WALL", "ARCH-PLAN$0$WINDOW"].includes(entity.layer) && entity.type === "LINE");
    expect(walled.length, "the drawing does carry them: S-13's bound background, 4 wall and 4 window pairs").toBe(16);
    // At either band: the 125 pairs sit inside the edition's 195.1, so it is I-342 and not the band that
    // refuses them — without it S-13 placed eight beams 9000 and 1800 long, carried at neither end.
    for (const reading of [read.placed, placed]) {
      const onXref = reading.placements.filter((row) => (layerOf.get(row.outlineKey) ?? "").includes("$0$"));
      expect(onXref, "no member of any class stands on a line of another drawing").toEqual([]);
      const cited = (reading.runs ?? []).flatMap((run) => run.clear?.sourceKeys ?? []).filter((key) => (layerOf.get(key) ?? "").includes("$0$"));
      expect(cited, "and no run is cut at one").toEqual([]);
    }
    expect(framedOf(placed).some((row) => row.viewKey === FIRST_FLOOR_BEAMS), "S-13's own beams still read under the widened band").toBe(true);
  }, BUDGET_MS);
});

describe("FRM-1 under a pairing band wide enough to read the runs it governs", () => {
  test("I-340: a clear is read in the millimetres S-01 declares, and cites the declaration", async () => {
    const { placed } = await widened();
    const read = (placed.runs ?? []).filter((run): run is RunRow & { clear: NonNullable<RunRow["clear"]> } => run.clear !== null);
    expect(read.length, "BNBC's runs have clears now — the header is unitless and was every clear's refusal").toBeGreaterThan(0);
    expect(new Set(read.map((run) => run.clear.unit)), "in the declared unit").toEqual(new Set(["mm"]));
    expect(read.every((run) => run.clear.sourceKeys.includes(DECLARATION)), "each cites the note that declared it (L-QTY-03)").toBe(true);
  }, BUDGET_MS);

  test("I-340: S-14's B1, B6 and B7 measure clear between the faces of the columns S-10 places at their ends — the golden's own figures", async () => {
    const { placed } = await widened();
    const runs = new Map((placed.runs ?? []).map((run) => [run.placementKey, run]));
    const columns = placed.placements.filter((row) => row.viewKey === COLUMN_PLAN && row.elementType === "column");
    for (const [mark, expected] of Object.entries(CLEARS)) {
      const rows = placed.placements.filter((row) => row.viewKey === TYPICAL_BEAMS && row.mark === mark);
      expect(rows.length, `S-14 places ${mark} once`).toBe(1);
      const run = runs.get((rows[0] as PlacementRow).placementKey);
      const carriers = expected.ends.map(([letter, numeral]) => columns.find((row) => row.gridLetter === letter && row.gridNumeral === numeral)?.outlineKey);
      expect(carriers.every((key) => key !== undefined), `S-10 places a column at each end of ${mark}`).toBe(true);
      expect(run?.clear, `${mark}: clear between the two column faces, in mm, cited to its edges, both columns and the declaration`).toEqual({
        value: expected.clear,
        unit: "mm",
        basis: "MEASURED",
        sourceKeys: [...expected.edges, ...carriers, DECLARATION],
      });
    }
  }, BUDGET_MS);

  test("FRM-3 (I-460): at the edition's own band, a beam placed off its turned mark is the face the runs ending on it are cut at — S-14's B12 at B34, EB1 between CB1 and CB2", async () => {
    // Before the vertical beams were placed, B12 ran on past the core's line to 4042.2 and EB1 was cut
    // at no end, 4267.2 — both OVER the golden's (I-344's FRM-4 list). The crossing members were drawn;
    // the placement stage could not name them until the artifact stated which way a mark is written.
    const { placed } = await bnbc();
    const runs = new Map((placed.runs ?? []).map((run) => [run.placementKey, run]));
    // TEST_AMENDED (FRM4-AD, I-612): EB1's mark names its three end-to-end spans by chain, so
    // the one asked for here is the span its label stands beside — EB1a, drawn by EE8/EE9.
    const on = (mark: string): PlacementRow => {
      const rows = placed.placements.filter((row) => row.viewKey === TYPICAL_BEAMS && row.mark === mark && (mark !== "EB1" || row.outlineKey === "DXF_HANDLE:EE8"));
      expect(rows.length, `S-14 places ${mark} once`).toBe(1);
      return rows[0] as PlacementRow;
    };
    const c2 = placed.placements.find((row) => row.viewKey === COLUMN_PLAN && row.elementType === "column" && row.gridLetter === "C" && row.gridNumeral === "2");
    expect(runs.get(on("B12").placementKey)?.clear, "B12: from C2's face (S-10) to B34's near edge — the golden's 3917.2").toEqual({
      value: "3917.2",
      unit: "mm",
      basis: "MEASURED",
      sourceKeys: ["DXF_HANDLE:E88", "DXF_HANDLE:E89", c2?.outlineKey, on("B34").outlineKey, DECLARATION],
    });
    expect(runs.get(on("EB1").placementKey)?.clear, "EB1: between the faces of the two cantilevers carrying it — the golden's 4017.2").toEqual({
      value: "4017.2",
      unit: "mm",
      basis: "MEASURED",
      sourceKeys: ["DXF_HANDLE:EE8", "DXF_HANDLE:EE9", on("CB1").outlineKey, on("CB2").outlineKey, DECLARATION],
    });
  }, BUDGET_MS);

  test("widening the pairing band moves no member the outlines place — the columns carrying those runs are the edition band's own", async () => {
    const { read, placed } = await widened();
    const outlined = (reading: DetectedPlacements): PlacementRow[] => reading.placements.filter((row) => row.elementType === "column" || row.elementType === "pile" || row.elementType === "pile_cap");
    expect(outlined(placed), "the same 27 columns, 89 piles and 26 caps, key for key").toEqual(outlined(read.placed));
  }, BUDGET_MS);
});
