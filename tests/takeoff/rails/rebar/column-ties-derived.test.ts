/**
 * R6b — F-RCC6-BNBC's column ties, derived under D-003, against the corrected golden (W-28 GC-1..GC-4;
 * the owner's A′; s-bbs I-656).
 *
 * Two readings of one joint, each proved over every rectangular column of the fixture's own model:
 *
 * - RESOLVED — the joint read off EVERY beam the model frames the column with (the generator's own
 *   `tie_zones_from_framing`). N at that depth is the golden's `bars_per_unit`, row for row: the
 *   product's rule and the yardstick's agree wherever the joint is known.
 * - BOUNDED — the joint read off the framing the partition placed before FRM-3 (`placedBeforeFrm3`).
 *   The count is the exact minimum over the depths the bound leaves open, it equals the brute-force
 *   oracle, and it is never over the golden: the whole of A′'s promise.
 *
 * The yardstick is not independent of the rule (the ties map's §8 risk): the generator derives its
 * counts from the same BNBC zones. What this proves is that the product reads the rule the golden
 * was authored under, exactly, and that its bound is never over; the drawing's evidence for the rule
 * is D-003's and W-28's.
 */
import { describe, expect, test } from "vitest";
import {
  BAR_SHAPE_NOT_HELD,
  COMPLETE,
  REBAR_ANCHORAGE_UNSTATED,
  REBAR_PAIRS,
  REBAR_PAIRS_V2,
  REBAR_RAIL_MODULE,
  REBAR_TIE_JOINT_BOUNDED,
  REBAR_TIE_JOINT_UNREAD,
  REBAR_TIE_ZONE_UNSTATED,
  productModule,
  type BarRowShape,
  type OfferShape,
  type RailBatchShape,
  type RailInputShape,
} from "./support/rebar-contract";
import {
  deepestOf,
  detailingLap50MixContested,
  framingAt,
  markSpacings,
  modelColumnsInput,
  oracleNeverOver,
  oracleSetsAt,
  placedBeforeFrm3,
  readGoldenBars,
  readModel,
  storeyAbove,
  type InputColumn,
  type ModelMember,
  type OracleProbe,
} from "./support/column-ties";

/** The method's two counting doors (`synthesis-v2.ts`). */
type TiesDoor = {
  tieSetsAt: (probe: { storeyRunMm: string; bMm: string; dMm: string; endSpacingMm: string; midSpacingMm: string }, depthMm: string) => number;
  tieSetsNeverOver: (probe: { storeyRunMm: string; bMm: string; dMm: string; endSpacingMm: string; midSpacingMm: string }, joint: { standing: "RESOLVED" | "BOUNDED"; depthMm: string }) => { sets: number; jointMm: string };
};

/** A golden bar row's mass, printed to the gram. */
type GoldenBarKg = { kg: string };

/** Every rectangular column the golden ties, with its model member and the golden's count. */
function rectangularTieRows(): { member: ModelMember; golden: number; probe: OracleProbe }[] {
  const model = readModel();
  const byId = new Map(model.members.map((member) => [member.id, member]));
  const spacings = markSpacings(model);
  return readGoldenBars()
    .filter((row) => row.class === "COLUMN" && row.role === "TIE" && row.shape === "51")
    .map((row) => {
      const member = byId.get(row.member) as ModelMember;
      const spacing = spacings.get(member.mark) as { end: string; mid: string };
      return { member, golden: row.bars_per_unit, probe: { h: String(member.h), b: String(member.b), d: String(member.d), se: Number(spacing.end), sm: Number(spacing.mid) } };
    });
}

/** The product probe for an oracle probe. */
function productProbe(probe: OracleProbe): { storeyRunMm: string; bMm: string; dMm: string; endSpacingMm: string; midSpacingMm: string } {
  return { storeyRunMm: probe.h, bMm: probe.b, dMm: probe.d, endSpacingMm: String(probe.se), midSpacingMm: String(probe.sm) };
}

describe("R6b: F-RCC6-BNBC's column ties, derived under D-003", () => {
  test("RESOLVED joints from model.json reproduce the corrected golden's bars_per_unit, member by member", async () => {
    const door = await productModule<TiesDoor>("src/core/rulesets/methods/rebar/synthesis-v2.ts");
    const model = readModel();
    const rows = rectangularTieRows();
    expect(rows.length, "the golden ties 208 rectangular column members (W-28; C7's two are hoops)").toBe(208);
    const cells = new Set<string>();
    const misses: string[] = [];
    for (const { member, golden, probe } of rows) {
      const drawn = deepestOf(framingAt(model, member).map((one) => one.depthMm)) ?? "0";
      const sets = door.tieSetsNeverOver(productProbe(probe), { standing: "RESOLVED", depthMm: drawn }).sets;
      expect(sets, `${member.id}: the oracle's own N at the drawn joint`).toBe(oracleSetsAt(probe, drawn));
      if (sets !== golden) misses.push(`${member.id} ${String(sets)} ≠ ${String(golden)}`);
      if (member.level !== "FDN" && member.level !== "ROOF") cells.add(`${member.level}|${member.mark}`);
    }
    expect(misses, "every rectangular member's derived count is the golden's").toEqual([]);
    expect(cells.size, "the rectangular (level, mark) cells GF–6F the ties map counts (41: C5 stands on no ground-floor cell)").toBe(41);
  });

  test("BOUNDED by the framing placed before FRM-3: the oracle's exact minimum, and never over the golden", async () => {
    const door = await productModule<TiesDoor>("src/core/rulesets/methods/rebar/synthesis-v2.ts");
    const model = readModel();
    const over: string[] = [];
    let bounded = 0;
    let under = 0;
    for (const { member, golden, probe } of rectangularTieRows()) {
      const placed = deepestOf(framingAt(model, member, placedBeforeFrm3).map((one) => one.depthMm));
      if (placed === undefined) continue; // UNREAD FRAMING: declared by name, never counted (A′)
      bounded += 1;
      const sets = door.tieSetsNeverOver(productProbe(probe), { standing: "BOUNDED", depthMm: placed }).sets;
      expect(sets, `${member.id}: the exact minimum from D_lo ${placed}`).toBe(oracleNeverOver(probe, placed));
      if (sets > golden) over.push(`${member.id} ${String(sets)} > ${String(golden)}`);
      if (sets < golden) under += 1;
    }
    expect(over, "no bounded column is counted over the golden (L-QTY-04: over-measurement is a hard block)").toEqual([]);
    expect(bounded, "the columns the placed framing bounds, GF–6F (C6 and the FDN necks stay unread)").toBeGreaterThan(150);
    expect(under, "some bounded columns stand under — the bound's cost, disclosed on the line").toBeGreaterThan(0);
  });
});

describe("R6b: the rebar rail under an edition citing synthesis@2, over every column of the model (A′)", () => {
  /** The rail's two answers for one input. */
  type Rail = (input: RailInputShape) => RailBatchShape;
  type Door = { rebarRail: Rail; barRowsOf: (input: RailInputShape) => BarRowShape[] };

  /** The rail run once for the file: every case below reads the same pure answer. */
  let once: Promise<{ batch: RailBatchShape; rows: BarRowShape[]; columns: InputColumn[] }> | undefined;
  function measured(): Promise<{ batch: RailBatchShape; rows: BarRowShape[]; columns: InputColumn[] }> {
    once ??= (async () => {
      const door = await productModule<Door>(REBAR_RAIL_MODULE);
      const { input, columns } = modelColumnsInput({ joints: "placed", methods: REBAR_PAIRS_V2, detailing: detailingLap50MixContested() });
      return { batch: door.rebarRail(input), rows: door.barRowsOf(input), columns };
    })();
    return once;
  }

  test("a bounded column bills its ties (shape 51) at the oracle's never-over count, never over the golden, and its line stands COMPLETE and says so", async () => {
    const { batch, rows, columns } = await measured();
    const golden = new Map(readGoldenBars().filter((row) => row.class === "COLUMN" && row.role === "TIE").map((row) => [row.member, row.bars_per_unit]));
    const model = readModel();
    let bounded = 0;
    for (const column of columns) {
      const placed = deepestOf(framingAt(model, column.member, placedBeforeFrm3).map((one) => one.depthMm));
      if (column.round || placed === undefined || column.spacing === undefined || storeyAbove(model, column.member.level) === undefined) continue;
      bounded += 1;
      const ties = rows.filter((row) => row.objectKey === column.objectKey && row.role === "TIE");
      const probe: OracleProbe = { h: String(column.member.h), b: String(column.member.b), d: String(column.member.d), se: Number(column.spacing.end), sm: Number(column.spacing.mid) };
      expect(ties.map((row) => [row.shape, row.barsPerUnit]), `${column.member.id}: one shape-51 row at the never-over count`).toEqual([["51", oracleNeverOver(probe, placed)]]);
      expect(Number(ties[0]?.barsPerUnit) <= (golden.get(column.member.id) ?? -1), `${column.member.id}: never over the golden`).toBe(true);
      const offer = batch.offers.find((one) => one.register.objectKey === column.objectKey) as OfferShape;
      expect(offer.coverage, `${column.member.id}: the line binds net, lap and ties`).toBe(COMPLETE);
      expect(Object.keys(offer.bindings).sort()).toEqual(["lap", "net", "ties"]);
      const said = batch.observations.find((one) => one.objectKey === column.objectKey && one.code === REBAR_TIE_JOINT_BOUNDED);
      expect(said?.detail, `${column.member.id}: the line says its ties stand at the joint's bound, citing the method and the clauses`).toMatchObject({
        method: "rcc.rebar.synthesis@2",
        clauses: ["BNBC 2020 §8.3.10.5(a)", "BNBC 2020 §6.4.9.2"],
        boundMm: placed,
        sets: oracleNeverOver(probe, placed),
      });
    }
    expect(bounded, "every rectangular column GF–6F the placed framing bounds").toBeGreaterThan(150);
  });

  test("the rest are declared by name: an unread joint, a round column's hoops, and the neck's anchorage", async () => {
    const { batch, columns } = await measured();
    const model = readModel();
    const omittedTies = (column: InputColumn): string | undefined => batch.offers.find((one) => one.register.objectKey === column.objectKey)?.omitted.find((one) => one.variable === "ties")?.code;
    for (const column of columns) {
      const placed = deepestOf(framingAt(model, column.member, placedBeforeFrm3).map((one) => one.depthMm));
      if (column.round) expect(omittedTies(column), `${column.member.id}: a round column's hoops are a shape the roster does not hold (I-596)`).toBe(BAR_SHAPE_NOT_HELD);
      else if (placed === undefined || storeyAbove(model, column.member.level) === undefined) {
        expect(omittedTies(column), `${column.member.id}: no framing read bounds its joint, so the ties are left out, never counted over`).toBe(REBAR_TIE_JOINT_UNREAD);
      }
      const anchorage = batch.observations.some((one) => one.objectKey === column.objectKey && one.code === REBAR_ANCHORAGE_UNSTATED);
      expect(anchorage, `${column.member.id}: the neck's anchorage into the cap is declared exactly at FDN`).toBe(column.member.level === "FDN");
    }
    const c6 = columns.filter((column) => column.member.mark === "C6" && column.member.level !== "FDN");
    expect(c6.length, "C6 stands at GF–6F").toBe(7);
    for (const column of c6) expect(omittedTies(column), "C6 is framed only by the slanted beams, which wait on D13").toBe(REBAR_TIE_JOINT_UNREAD);
  });

  test("the forecast A′ was ruled on: the 34 bounded (level, mark) cells GF–6F, whole members within 3 % under the golden, and no cell's ties over it", async () => {
    const { rows, columns, batch } = await measured();
    const golden = readGoldenBars() as (GoldenBarKg & ReturnType<typeof readGoldenBars>[number])[];
    const cellOf = new Map(columns.map((column) => [column.objectKey, `${column.member.level}|${column.member.mark}`]));
    const complete = new Set(batch.offers.filter((one) => one.coverage === COMPLETE).map((one) => one.register.objectKey));
    const incomplete = new Set(columns.filter((column) => !complete.has(column.objectKey)).map((column) => `${column.member.level}|${column.member.mark}`));
    const sum = (map: Map<string, number>, key: string, kg: number): void => void map.set(key, (map.get(key) ?? 0) + kg);
    const product = new Map<string, number>();
    const productTies = new Map<string, number>();
    for (const row of rows) {
      const cell = cellOf.get(row.objectKey) as string;
      sum(product, cell, Number(row.kg));
      if (row.role === "TIE") sum(productTies, cell, Number(row.kg));
    }
    const byId = new Map(columns.map((column) => [column.member.id, column]));
    const expected = new Map<string, number>();
    const expectedTies = new Map<string, number>();
    for (const row of golden) {
      const column = byId.get(row.member);
      if (row.class !== "COLUMN" || column === undefined) continue;
      const cell = `${column.member.level}|${column.member.mark}`;
      sum(expected, cell, Number(row.kg));
      if (row.role === "TIE") sum(expectedTies, cell, Number(row.kg));
    }
    // a golden row is printed to the gram, so a cell of n rows may lie n half-grams from its sum
    const allowance = (cell: string): number => 0.0005 * golden.filter((row) => byId.has(row.member) && `${byId.get(row.member)?.member.level}|${byId.get(row.member)?.member.mark}` === cell).length;
    const compared = [...expected.keys()].filter((cell) => !cell.startsWith("FDN|") && !cell.startsWith("ROOF|") && !incomplete.has(cell)).sort();
    let worst = 0;
    for (const cell of compared) {
      const ratio = (product.get(cell) ?? 0) / (expected.get(cell) as number);
      worst = Math.min(worst, ratio - 1);
      expect(ratio >= 0.97, `${cell}: the whole member stands within three per cent under the golden (${(100 * (ratio - 1)).toFixed(2)} %)`).toBe(true);
      expect((productTies.get(cell) ?? 0) <= (expectedTies.get(cell) as number) + allowance(cell), `${cell}: the ties are never over the golden's`).toBe(true);
      expect((product.get(cell) ?? 0) <= (expected.get(cell) as number) + allowance(cell), `${cell}: the whole member is never over the golden`).toBe(true);
    }
    expect(compared.length, "C1–C5 at GF–6F: 41 rectangular cells less C6's seven, which A′ declares").toBe(34);
    expect(worst, "the worst cell is 5F C3 at −2.42 %, as forecast before FRM-3").toBeGreaterThan(-0.0243);
  });

  test("@1 under the same input still declares every tie zone unstated (the pinned campaigns' reading)", async () => {
    const door = await productModule<Door>(REBAR_RAIL_MODULE);
    const { input } = modelColumnsInput({ joints: "placed", methods: REBAR_PAIRS, detailing: detailingLap50MixContested() });
    const batch = door.rebarRail(input);
    expect(new Set(batch.offers.map((one) => one.omitted.find((omitted) => omitted.variable === "ties")?.code)), "@1 derives no tie").toEqual(new Set([REBAR_TIE_ZONE_UNSTATED]));
    expect(batch.observations.filter((one) => [REBAR_TIE_JOINT_BOUNDED, REBAR_ANCHORAGE_UNSTATED].includes(one.code)), "@1 says nothing @2 says").toEqual([]);
  });
});
