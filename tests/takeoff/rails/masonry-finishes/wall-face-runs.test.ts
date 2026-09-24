/**
 * I-543 — a room's walls are measured RUN BY RUN, one run to one soffit (L-MEA-03, L-MEA-06,
 * L-QTY-04; F-ARCH's A-18).
 *
 * F-ARCH's golden measures a wall face per boundary edge: the edge's length times the height from
 * the band's floor to the soffit of the slab over the room AT THAT EDGE, the edge split where the
 * panel over it changes. Sixteen of its 101 measured rooms stand under two soffits — the LOBBY,
 * E-KITCHEN and W-KITCHEN of 1F to 5F (2898 mm under the 150 thick panels, 2923 mm elsewhere) and
 * GF-LOBBY (3202.8 and 3227.8 mm) — so a wall method with ONE height per room cannot reproduce them:
 * the higher soffit over-measures, which is a hard block, and the lower under-measures. This grades
 * the wall trees against the golden the way the offering slice (ARCH-5 registers the WALLS surface,
 * ARCH-78 binds it) must use them: one offer per run, each with its own clear height, the room's
 * lines summing to the golden row.
 *
 * The runs below are F-ARCH's authored model read by its golden's path 1 (fixtures/gen/arch/golden.py:
 * `_edges_with_heights`, `_band`, `room_rows`) for level 1F, in metres; nothing here re-derives
 * them. They are held honest by the golden itself: the runs' sum is checked against the SKIRTING row
 * (the whole boundary less the doors at floor level) and the dado row (the whole boundary up the
 * dado), and their split against the PLASTER and PAINT rows. The deducted sum is the golden's own
 * (each opening whose whole area exceeds 0.1 m², its overlap with the band); where along the boundary
 * each opening stands is the offering slice's to allocate, and the room deducts the same sum wherever
 * it is allocated, so it is bound once, on the first run.
 */
import { describe, expect, test } from "vitest";
import {
  WALL_FACE_PAINT_RULE_ID,
  WALL_FACE_PLASTER_RULE_ID,
  WALL_FACE_TILING_RULE_ID,
  MASONRY_VERSION,
  canon,
  goldenRows,
  masonryMethod,
  type DecimalLike,
} from "./support/masonry-contract";

/** One run of a room's boundary under one soffit: its length and the clear height over it (m). */
type Run = { readonly P: string; readonly H: string };

/** A room of F-ARCH's level 1F whose boundary stands under two soffits, as path 1 measures it. */
type TwoSoffitRoom = {
  readonly room: string;
  readonly runs: readonly [Run, Run];
  /** Where the plastered band starts: the top of the skirting (4") or of the dado (5'-0"), the schedule's. */
  readonly f: string;
  /** What the openings deducted from the plastered band (m²). */
  readonly bandOpenings: string;
  /** A dado room's tile height and what its openings deducted from the dado (m, m²). */
  readonly dado?: { readonly h: string; readonly openings: string };
  /** A skirted room's openings at floor level, whose widths the skirting leaves out (m). */
  readonly doorWidths?: string;
};

const LEVEL = "1F";

/** The clear heights section A-04 prints on 1F: under the 150 thick panels, and the storey less 125. */
const UNDER_150 = "2.898";
const UNDER_125 = "2.923";

const ROOMS: readonly TwoSoffitRoom[] = [
  {
    room: "LOBBY",
    runs: [
      { P: "20.3972", H: UNDER_150 },
      { P: "5.6114", H: UNDER_125 },
    ],
    f: "0.1016",
    bandOpenings: "9.2308032",
    doorWidths: "4.5576",
  },
  {
    room: "E-KITCHEN",
    runs: [
      { P: "10.0201", H: UNDER_150 },
      { P: "4.2289", H: UNDER_125 },
    ],
    f: "1.524",
    bandOpenings: "0.55741824",
    dado: { h: "1.524", openings: "1.3935456" },
  },
];

/** Half a unit of the golden's third place: its rows are quantised to 0.001 (half-even). */
const HALF_ULP = "0.0005";

/** The golden row of this room, kind and component on 1F — exactly one, or the premise has moved. */
function goldenOf(room: string, kind: string, component: string): string {
  const rows = goldenRows("arch").filter((row) => row.level === LEVEL && row.room === room && row.kind === kind && row.component === component);
  expect(rows.length, `F-ARCH's golden holds one ${kind} ${component} row for ${LEVEL} ${room}`).toBe(1);
  return (rows[0] as { quantity: string }).quantity;
}

/** Whether a figure rounds to the golden's quantity at its third place. */
function roundsTo(figure: DecimalLike, quantity: DecimalLike): boolean {
  return quantity.sub(HALF_ULP).lte(figure) && figure.lte(quantity.add(HALF_ULP));
}

describe("I-543: a room's walls are measured run by run, one run to one soffit", () => {
  test("a room under two soffits is two runs, and their plaster and paint lines sum to F-ARCH's golden", async () => {
    const { exact } = await canon();
    for (const ruleId of [WALL_FACE_PLASTER_RULE_ID, WALL_FACE_PAINT_RULE_ID]) {
      const method = await masonryMethod({ ruleId, version: MASONRY_VERSION });
      const golden = ruleId === WALL_FACE_PLASTER_RULE_ID ? "PLASTER" : "PAINT";
      for (const one of ROOMS) {
        const lines = one.runs.map((run, index) =>
          exact(
            String(
              method.evaluate({
                P: { value: run.P },
                H: { value: run.H },
                f: { value: one.f },
                openings: { value: index === 0 ? one.bandOpenings : "0" },
                threshold: { value: "0.1" },
              }),
            ),
          ),
        );
        const sum = lines.reduce((total, line) => total.add(line));
        const owed = exact(goldenOf(one.room, golden, "WALL"));
        expect(
          roundsTo(sum, owed),
          `${ruleId} over ${LEVEL} ${one.room}'s two runs sums to ${sum.toString()}; F-ARCH's golden ${golden} WALL row is ${owed.toString()} (A-18: each edge up to the soffit over it)`,
        ).toBe(true);
      }
    }
  });

  test("the runs are the room's whole boundary: the skirting and the dado rows close over their sum", async () => {
    const { exact } = await canon();
    const tiling = await masonryMethod({ ruleId: WALL_FACE_TILING_RULE_ID, version: MASONRY_VERSION });
    for (const one of ROOMS) {
      const boundary = one.runs.map((run) => exact(run.P)).reduce((total, run) => total.add(run));
      if (one.doorWidths !== undefined) {
        const skirting = boundary.sub(one.doorWidths);
        const owed = exact(goldenOf(one.room, "SKIRTING", "SKIRTING"));
        expect(roundsTo(skirting, owed), `${LEVEL} ${one.room}'s runs less its doors are ${skirting.toString()} m; the golden SKIRTING row is ${owed.toString()}`).toBe(
          true,
        );
      }
      if (one.dado !== undefined) {
        // The dado stands below every soffit, so its band is the same whether the room is one run or
        // two: the tiling closes over the whole boundary, and over the two runs as well.
        const owed = exact(goldenOf(one.room, "WALL_TILE", "DADO"));
        const whole = exact(
          String(tiling.evaluate({ P: { value: boundary.toString() }, h: { value: one.dado.h }, openings: { value: one.dado.openings }, threshold: { value: "0.1" } })),
        );
        const dado = one.dado;
        const byRun = one.runs
          .map((run, index) =>
            exact(String(tiling.evaluate({ P: { value: run.P }, h: { value: dado.h }, openings: { value: index === 0 ? dado.openings : "0" }, threshold: { value: "0.1" } }))),
          )
          .reduce((total, line) => total.add(line));
        expect(roundsTo(whole, owed), `${WALL_FACE_TILING_RULE_ID} over ${LEVEL} ${one.room}'s whole boundary is ${whole.toString()}; the golden WALL_TILE row is ${owed.toString()}`).toBe(true);
        expect(byRun.eq(whole), `and over its two runs it is the same ${whole.toString()} — it answered ${byRun.toString()}`).toBe(true);
      }
    }
  });

  test("one clear height for the whole room misses the golden: the higher over-measures (a hard block), the lower under-measures", async () => {
    const { exact } = await canon();
    const method = await masonryMethod({ ruleId: WALL_FACE_PLASTER_RULE_ID, version: MASONRY_VERSION });
    for (const one of ROOMS) {
      const boundary = one.runs.map((run) => exact(run.P)).reduce((total, run) => total.add(run));
      const owed = exact(goldenOf(one.room, "PLASTER", "WALL"));
      const at = (H: string): DecimalLike =>
        exact(String(method.evaluate({ P: { value: boundary.toString() }, H: { value: H }, f: { value: one.f }, openings: { value: one.bandOpenings }, threshold: { value: "0.1" } })));
      const higher = at(UNDER_125);
      const lower = at(UNDER_150);
      expect(
        owed.add(HALF_ULP).lte(higher) && !higher.eq(owed.add(HALF_ULP)),
        `${LEVEL} ${one.room} under the higher soffit alone is ${higher.toString()} against the golden ${owed.toString()} — over-measurement, never a disclosure (L-QTY-04)`,
      ).toBe(true);
      expect(
        lower.lte(owed.sub(HALF_ULP)) && !lower.eq(owed.sub(HALF_ULP)),
        `${LEVEL} ${one.room} under the lower soffit alone is ${lower.toString()} against the golden ${owed.toString()} — a shortfall a line would have to declare`,
      ).toBe(true);
    }
  });
});
