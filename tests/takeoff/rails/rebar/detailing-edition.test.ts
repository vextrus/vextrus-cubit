/**
 * AC-2 — the detailing edition is DATA, resolved by a method pair and looked up by pure functions
 * (L-FRM-05, AM-03(f), AM-03(g), L-MEA-01, riskNotes (2)).
 *
 * Every figure below is the Bible's own: L-FRM-05 states the ℓd table for fy 420, the laps, the
 * hooks, the covers, the tie-spacing rule, the kg/m lookup, the bend radius and the stock bar, and
 * AM-03(f) states the fy 500 rows scaled from them. Nothing is read off the product — the roster is
 * the law's, and what the edition answers is graded against it.
 *
 * The edition is asked through the pair that resolves it (`DETAILING_BNBC2020_BD.resolve()`), never
 * off a JSON file or a source read: a resolver-role method is code that answers, and this is what it
 * answers.
 */
import { describe, expect, test } from "vitest";
import {
  DETAILING_MODULE,
  DETAILING_ROW_NOT_IN_EDITION,
  EDITION_NAME,
  EDITION_VERSION,
  ROUNDING_MM,
  STOCK_BAR_MM,
  detailingEdition,
  detailingLookups,
} from "./support/rebar-contract";

/** The ℓd table, whole: L-FRM-05's fy 420 rows and AM-03(f)'s fy 500 rows, in multiples of d_b. */
const LD_TABLE: readonly { fyMPa: number; fcPsi: number; confined: readonly [number, number]; otherwise: readonly [number, number] }[] = [
  { fyMPa: 420, fcPsi: 3000, confined: [44, 54], otherwise: [66, 83] },
  { fyMPa: 420, fcPsi: 3500, confined: [41, 50], otherwise: [61, 78] },
  { fyMPa: 420, fcPsi: 4000, confined: [38, 47], otherwise: [57, 72] },
  { fyMPa: 500, fcPsi: 3000, confined: [52, 64], otherwise: [79, 99] },
  { fyMPa: 500, fcPsi: 3500, confined: [49, 60], otherwise: [73, 93] },
  { fyMPa: 500, fcPsi: 4000, confined: [45, 56], otherwise: [68, 86] },
];

/** The two diameter columns of every row: 19 mm or less, and 20 mm or more (L-FRM-05). */
const SMALL_BAR = 16;
const LARGE_BAR = 25;

/** The covers L-FRM-05 states, by the class the cover is asked for. */
const COVERS: Readonly<Record<string, number>> = Object.freeze({ beam: 25, column: 40, shear_wall: 20, slab: 20, footing: 75, pile_cap: 75, pile: 75 });

/** The unit-weight lookup L-FRM-05 states, in kg/m — the table that BILLS (AM-03(b)). */
const KG_PER_METRE: Readonly<Record<number, number>> = Object.freeze({
  8: 0.395,
  10: 0.616,
  12: 0.888,
  16: 1.579,
  20: 2.466,
  22: 2.98,
  25: 3.854,
  28: 4.828,
  32: 6.313,
  36: 7.981,
  40: 9.864,
});

/** The floor every development length and lap stands above (L-FRM-05). */
const FLOOR_MM = 300;

/** A lookup that answers `{ ok, ... }` — an unread row is an answer, never a throw (interfaces). */
type LdAnswer = { ok: true; multiplier: number } | { ok: false; code: string };
type MmAnswer = { ok: boolean; mm?: number; code?: string };

describe("AC-2: the detailing edition BNBC2020_BD @ 2026.07 is data, and its lookups are the law's", () => {
  test("AC-2: the pair resolves the edition the interfaces name, with the stock bar and the allowances on it", async () => {
    const edition = await detailingEdition();
    expect(edition["identity"], `${DETAILING_MODULE} resolves the edition this increment versions (interfaces)`).toEqual({ name: EDITION_NAME, version: EDITION_VERSION });
    expect(Number(edition["fyDefaultMPa"]), "fy defaults to 420 MPa (L-FRM-05)").toBe(420);
    expect(Number(edition["fcDefaultPsi"]), "f'c defaults to 3000 psi (L-FRM-05)").toBe(3000);
    expect(Number(edition["topBarFactor"]), "a top bar takes ×1.3 (L-FRM-05)").toBe(1.3);
    expect(Number(edition["ldFloorMm"]), "and every ℓd stands above 300 mm").toBe(FLOOR_MM);
    expect(Number(edition["STOCK_BAR_MM"]), "the stock bar is 12,000 mm (L-FRM-05)").toBe(Number(STOCK_BAR_MM));
    expect(Number(edition["roundingMm"]), "the one rounded surface rounds to 25 mm (AM-03(c))").toBe(ROUNDING_MM);
    expect(Number(edition["wastageFraction"]), "wastage is three per cent — resource only (AM-03(a))").toBe(0.03);
    expect(Number(edition["bindingWireKgPerTonne"]), "and binding wire is 8 kg per tonne — resource only").toBe(8);

    const lap = edition["lap"] as Record<string, unknown>;
    expect(Number(lap["A"]), "Class A is 1.0 ℓd (L-FRM-05)").toBe(1);
    expect(Number(lap["B"]), "Class B is 1.3 ℓd").toBe(1.3);
    expect(String(lap["default"]), "and Class B is the default").toBe("B");
    expect(Number(lap["floorMm"]), "a lap stands above 300 mm").toBe(FLOOR_MM);
    expect(Number(lap["compressionMultiplier"]), "a compression lap is ≈30d — edition data, applied by no schedule here (riskNotes (3))").toBe(30);
  });

  test("AC-2: ldMultiplierOf answers every (fy, f'c, diameter, confinement) cell of the table", async () => {
    const edition = await detailingEdition();
    const { ldMultiplierOf } = await detailingLookups();
    const ask = ldMultiplierOf as unknown as (e: unknown, probe: Record<string, unknown>) => LdAnswer;

    for (const row of LD_TABLE) {
      for (const [confined, columns] of [
        [true, row.confined],
        [false, row.otherwise],
      ] as const) {
        for (const [index, diameterMm] of [SMALL_BAR, LARGE_BAR].entries()) {
          const answered = ask(edition, { fyMPa: row.fyMPa, fcPsi: row.fcPsi, diameterMm, confined, top: false });
          const owed = columns[index] as number;
          expect(answered.ok, `fy ${row.fyMPa} / f'c ${row.fcPsi} psi / d ${diameterMm} mm / ${confined ? "confined" : "otherwise"} stands in the edition: ${JSON.stringify(answered)}`).toBe(true);
          expect((answered as { multiplier: number }).multiplier, `and it is ${owed} d_b (L-FRM-05, AM-03(f))`).toBeCloseTo(owed, 9);
        }
      }
    }
  });

  test("AC-2: f'c clamps to the row at-or-below, and a top bar takes ×1.3", async () => {
    const edition = await detailingEdition();
    const { ldMultiplierOf } = await detailingLookups();
    const ask = ldMultiplierOf as unknown as (e: unknown, probe: Record<string, unknown>) => LdAnswer;
    const multiplierOf = (probe: Record<string, unknown>): number => {
      const answered = ask(edition, probe);
      expect(answered.ok, `the edition answers ${JSON.stringify(probe)}: ${JSON.stringify(answered)}`).toBe(true);
      return (answered as { multiplier: number }).multiplier;
    };

    const base = { fyMPa: 420, diameterMm: SMALL_BAR, confined: true, top: false };
    const at3000 = multiplierOf({ ...base, fcPsi: 3000 });
    const at4000 = multiplierOf({ ...base, fcPsi: 4000 });
    expect(multiplierOf({ ...base, fcPsi: 3200 }), "3200 psi clamps DOWN to the 3000 row — never up, which would shorten the bar (L-FRM-05)").toBeCloseTo(at3000, 9);
    expect(multiplierOf({ ...base, fcPsi: 4500 }), "4500 psi clamps to the 4000 row, the strongest the edition holds").toBeCloseTo(at4000, 9);
    expect(multiplierOf({ ...base, fcPsi: 2500 }), "and below the first row it stands at the 3000 row").toBeCloseTo(at3000, 9);
    expect(multiplierOf({ ...base, fcPsi: 3000, top: true }), "a top bar takes ×1.3 off the same cell").toBeCloseTo(at3000 * 1.3, 9);
  });

  test("AC-2: an fy the table has no row for is answered, never scaled and never thrown", async () => {
    const edition = await detailingEdition();
    const { ldMultiplierOf } = await detailingLookups();
    const ask = ldMultiplierOf as unknown as (e: unknown, probe: Record<string, unknown>) => LdAnswer;
    const answered = ask(edition, { fyMPa: 550, fcPsi: 3000, diameterMm: SMALL_BAR, confined: true, top: false });
    expect(answered.ok, "fy 550 MPa has no row in BNBC2020_BD @ 2026.07 (AM-03(f))").toBe(false);
    expect((answered as { code: string }).code, "so the lookup defers by name rather than inventing a row").toBe(DETAILING_ROW_NOT_IN_EDITION);
  });

  test("AC-2: developmentLengthOf and lapLengthOf floor at 300 mm, and a lap is its class times ℓd", async () => {
    const edition = await detailingEdition();
    const { ldMultiplierOf, developmentLengthOf, lapLengthOf } = await detailingLookups();
    const askLd = ldMultiplierOf as unknown as (e: unknown, probe: Record<string, unknown>) => LdAnswer;
    const askMm = developmentLengthOf as unknown as (e: unknown, probe: Record<string, unknown>) => MmAnswer;
    const askLap = lapLengthOf as unknown as (e: unknown, probe: Record<string, unknown>) => number;

    // Every cell of the table, read as a LENGTH: the multiplier times the bar, never under the floor.
    for (const row of LD_TABLE) {
      for (const diameterMm of [SMALL_BAR, LARGE_BAR]) {
        for (const confined of [true, false]) {
          const multiplier = askLd(edition, { fyMPa: row.fyMPa, fcPsi: row.fcPsi, diameterMm, confined, top: false });
          expect(multiplier.ok, `the cell stands: ${JSON.stringify(multiplier)}`).toBe(true);
          const owed = Math.max((multiplier as { multiplier: number }).multiplier * diameterMm, FLOOR_MM);
          const answered = askMm(edition, { fyMPa: row.fyMPa, fcPsi: row.fcPsi, diameterMm, confined, top: false });
          expect(answered.ok, `the length stands where its cell does: ${JSON.stringify(answered)}`).toBe(true);
          expect(Number(answered.mm), `ℓd is max(${owed} mm, the 300 mm floor) for fy ${row.fyMPa} / f'c ${row.fcPsi} / d ${diameterMm}`).toBeCloseTo(owed, 6);
        }
      }
    }

    // A short bar in a strong mix is what the floor is FOR: 38 × 8 = 304 mm clears it, 8 mm at a
    // multiplier under 37.5 would not — so the floor is proved on a length the table drives under it.
    const short = askMm(edition, { fyMPa: 420, fcPsi: 4000, diameterMm: 8, confined: true, top: false });
    expect(Number(short.mm) >= FLOOR_MM, `ℓd never stands under 300 mm (it answered ${JSON.stringify(short)})`).toBe(true);

    expect(askLap(edition, { diameterMm: 20, ldMm: 1000, class: "A" }), "Class A is 1.0 ℓd (L-FRM-05)").toBeCloseTo(1000, 6);
    expect(askLap(edition, { diameterMm: 20, ldMm: 1000, class: "B" }), "Class B is 1.3 ℓd").toBeCloseTo(1300, 6);
    expect(askLap(edition, { diameterMm: 8, ldMm: 200, class: "A" }), "and a lap under 300 mm stands at the floor").toBeCloseTo(FLOOR_MM, 6);
  });

  test("AC-2: hookExtensionOf answers the three angles, with the 135° stirrup hook at max(6d, 75 mm)", async () => {
    const edition = await detailingEdition();
    const { hookExtensionOf } = await detailingLookups();
    const ask = hookExtensionOf as unknown as (e: unknown, probe: { angle: number; diameterMm: number }) => number;

    for (const diameterMm of [8, 10, 12, 16, 20, 25, 32]) {
      expect(ask(edition, { angle: 90, diameterMm }), `a 90° hook is 12d at ${diameterMm} mm (L-FRM-05)`).toBeCloseTo(12 * diameterMm, 6);
      expect(ask(edition, { angle: 180, diameterMm }), `a 180° hook is max(4d, 65 mm) at ${diameterMm} mm`).toBeCloseTo(Math.max(4 * diameterMm, 65), 6);
      expect(ask(edition, { angle: 135, diameterMm }), `a 135° stirrup hook is max(6d, 75 mm) at ${diameterMm} mm (AM-03(g))`).toBeCloseTo(Math.max(6 * diameterMm, 75), 6);
    }
    expect(ask(edition, { angle: 135, diameterMm: 10 }), "a 10 mm tie's hook is the 75 mm minimum, not 60 mm").toBeCloseTo(75, 6);
    expect(ask(edition, { angle: 135, diameterMm: 16 }), "and a 16 mm one is 96 mm, where 6d has risen above it").toBeCloseTo(96, 6);
  });

  test("AC-2: coverOf, tieSpacingOf, kgPerMetreOf and bendRadiusOf answer L-FRM-05's own figures", async () => {
    const edition = await detailingEdition();
    const { coverOf, tieSpacingOf, kgPerMetreOf, bendRadiusOf } = await detailingLookups();
    const cover = coverOf as unknown as (e: unknown, elementType: string) => number;
    const spacing = tieSpacingOf as unknown as (e: unknown, probe: { longitudinalMm: number; tieMm: number; leastDimensionMm: number }) => number;
    const kgm = kgPerMetreOf as unknown as (e: unknown, diameterMm: number) => string;
    const radius = bendRadiusOf as unknown as (e: unknown, diameterMm: number) => number;

    for (const [elementType, mm] of Object.entries(COVERS)) {
      expect(cover(edition, elementType), `the cover of a ${elementType} is ${mm} mm (L-FRM-05)`).toBeCloseTo(mm, 6);
    }

    // Least of the three, whichever of them is least: each arm is driven by making it the smallest.
    expect(spacing(edition, { longitudinalMm: 16, tieMm: 10, leastDimensionMm: 900 }), "16 × d_long where that is least (16 × 16 = 256)").toBeCloseTo(256, 6);
    expect(spacing(edition, { longitudinalMm: 25, tieMm: 6, leastDimensionMm: 900 }), "48 × d_tie where that is least (48 × 6 = 288)").toBeCloseTo(288, 6);
    expect(spacing(edition, { longitudinalMm: 25, tieMm: 10, leastDimensionMm: 250 }), "and the least section dimension where that is least").toBeCloseTo(250, 6);

    for (const [diameterMm, rate] of Object.entries(KG_PER_METRE)) {
      expect(Number(kgm(edition, Number(diameterMm))), `${diameterMm} mm bills at ${rate} kg/m — the table, never d²/162 (AM-03(b))`).toBeCloseTo(rate, 9);
    }
    expect(Object.keys(edition["kgPerMetre"] as Record<string, unknown>).map(Number).sort((a, b) => a - b), "the table holds exactly L-FRM-05's eleven rows").toEqual(
      Object.keys(KG_PER_METRE).map(Number).sort((a, b) => a - b),
    );

    for (const diameterMm of [8, 10, 12, 16]) expect(radius(edition, diameterMm), `a bend of ${diameterMm} mm turns on 2d (L-FRM-05)`).toBeCloseTo(2 * diameterMm, 6);
    for (const diameterMm of [20, 25, 32, 40]) expect(radius(edition, diameterMm), `and above 16 mm on 3.5d`).toBeCloseTo(3.5 * diameterMm, 6);
  });
});
