/**
 * AC-3 — BS 8666, exact over every bar mark of F-RCC6-BNBC (AM-01, AM-03(c), AM-03(d), L-FRM-05).
 *
 * The roster is the fixture's own: `bbs.golden.json` carries every bar the fixture's independent
 * detailing model produced, with the three lengths AM-01 names — the raw cutting length (never
 * rounded), the one rounded surface, and the IS-additive figure recorded beside them. Nothing here
 * types a bar, a shape or a length: the file is the yardstick and the product is graded against it,
 * row by row.
 *
 * Two rules are proved beside the roster. The GENERIC form governs (AM-03(d)): every shape's raw
 * length is Σlegs − bends·(0.5r + d), and shape 51 — three 90° bends and two 135° — comes out at
 * 2(A+B) + 2C − 2.5r − 5d, which is why an explicit per-code formula that disagrees is void. And the
 * IS-additive figure is a FIELD OF ITS OWN: it differs from the raw where the conventions diverge,
 * and no call of the module answers it in the raw's place (AM-03(c): recorded, never asserted equal).
 *
 * Mismatches are collected rather than asserted one by one: 4,127 rows named in one message say what
 * is wrong, where a per-row assertion would stop at the first and cost the lane its budget.
 */
import { describe, expect, test } from "vitest";
import {
  BNBC_FIXTURE_ID,
  BS8666_MODULE,
  bbsGoldenDocument,
  bs8666Door,
  detailingEdition,
  detailingLookups,
  massDoor,
  type BbsGoldenRow,
} from "./support/rebar-contract";

/** How far a computed length may stand from the golden's printed 3-dp figure and still be it. */
const HALF_ULP_MM = 0.0005;

/** The legs a shape may carry, in the order BS 8666 letters them. */
const LEG_LETTERS: readonly string[] = ["A", "B", "C", "D", "E", "F"];

/** The bar the criterion names as the one whose IS convention and BS raw part company. */
const DIVERGENT_MARK = "C1-t";
const DIVERGENT_RAW = "1380.000";
const DIVERGENT_IS_ADDITIVE = "1360.000";

/** The bar the criterion names as the one whose raw length keeps its fractional millimetres. */
const FRACTIONAL_RAW = "3083.200";

/** The golden, read once — 4,127 rows are parsed once and every case reads the same document. */
const golden = bbsGoldenDocument(BNBC_FIXTURE_ID);

/** One row's legs, in the shape's own order — the dims the file states, and no others. */
function legsOf(row: BbsGoldenRow): string[] {
  return LEG_LETTERS.filter((letter) => row.dims_mm[letter] !== undefined).map((letter) => String(row.dims_mm[letter]));
}

/** Is a computed figure the golden's printed one, to the place the file prints? */
function stands(answered: unknown, printed: string): boolean {
  const value = Number(answered);
  return Number.isFinite(value) && Math.abs(value - Number(printed)) < HALF_ULP_MM;
}

/** The first few of a list of disagreements, as one message a reader can act on. */
function say(what: string, found: readonly string[], total: number): string {
  return `${what}: ${found.length} of ${total} rows disagree — ${found.slice(0, 5).join(" · ")}`;
}

describe("AC-3: every bar of F-RCC6-BNBC cuts, rounds, records and bills as the golden says", () => {
  test("AC-3: the golden carries the roster this criterion is graded over", () => {
    expect(golden.fixture, "the document is F-RCC6-BNBC's own (AM-01)").toBe("F-RCC6-BNBC");
    expect(golden.rows.length, "and it carries the bar marks the fixture's detailing model produced").toBeGreaterThan(0);
    expect(
      golden.rows.some((row) => row.bar_mark === DIVERGENT_MARK),
      `${DIVERGENT_MARK} — the tie whose IS-additive figure and BS raw length part company — stands in the golden`,
    ).toBe(true);
  });

  test("AC-3: cuttingLengthOf reproduces every raw cutting length, and rounds none of them", async () => {
    const door = await bs8666Door();
    const cuttingLengthOf = door["cuttingLengthOf"] as (probe: { shape: string; diameterMm: number; legsMm: readonly string[] }) => string;
    const wrong: string[] = [];
    let fractional = 0;
    for (const row of golden.rows) {
      const answered = cuttingLengthOf({ shape: row.shape, diameterMm: row.dia_mm, legsMm: legsOf(row) });
      if (!stands(answered, row.cutting_raw_mm)) wrong.push(`${row.bar_mark} (${row.shape}, ⌀${row.dia_mm}) answered ${String(answered)} for ${row.cutting_raw_mm}`);
      // A raw length is never rounded (AM-03(c)): where the golden's own figure carries fractional
      // millimetres, so must the answer — a figure that lost them was rounded somewhere.
      if (!row.cutting_raw_mm.endsWith(".000")) {
        fractional += 1;
        if (Number.isInteger(Number(answered))) wrong.push(`${row.bar_mark} answered the whole millimetre ${String(answered)} where the raw length is ${row.cutting_raw_mm}`);
      }
    }
    expect(wrong, say(`${BS8666_MODULE} cuts every bar of the golden to its raw length`, wrong, golden.rows.length)).toEqual([]);
    expect(fractional, "and the golden holds raw lengths with fractional millimetres to keep (AM-03(c))").toBeGreaterThan(0);

    const kept = golden.rows.find((row) => row.cutting_raw_mm === FRACTIONAL_RAW);
    expect(kept, `the golden holds a bar cut at ${FRACTIONAL_RAW} mm — the raw length that must survive whole`).toBeTruthy();
    const answered = cuttingLengthOf({ shape: (kept as BbsGoldenRow).shape, diameterMm: (kept as BbsGoldenRow).dia_mm, legsMm: legsOf(kept as BbsGoldenRow) });
    expect(Number(answered), `a ${FRACTIONAL_RAW} raw stays ${FRACTIONAL_RAW} — cuttingLengthOf never rounds`).toBeCloseTo(Number(FRACTIONAL_RAW), 3);
  });

  test("AC-3: every raw length is the generic form Σlegs − bends·(0.5r + d), shape 51 included", async () => {
    const door = await bs8666Door();
    const edition = await detailingEdition();
    const { bendRadiusOf } = await detailingLookups();
    const radiusOf = bendRadiusOf as unknown as (e: unknown, diameterMm: number) => number;
    const generic = door["genericCuttingLength"] as (legsMm: readonly string[], bends: readonly { angle: number; count: number }[], rMm: number, dMm: number) => string;
    const shapes = door["SHAPES"] as Record<string, { legs: readonly string[]; bends: readonly { angle: number; count: number }[] }>;

    const wrong: string[] = [];
    const seen = new Set<string>();
    for (const row of golden.rows) {
      const shape = shapes[row.shape];
      if (shape === undefined) {
        wrong.push(`${row.bar_mark} is shape ${row.shape}, which ${BS8666_MODULE} does not hold`);
        continue;
      }
      seen.add(row.shape);
      // The legs the file states ARE the legs the shape declares: a shape whose roster disagrees
      // with the fixture's detailing is a shape table read from somewhere else.
      const stated = LEG_LETTERS.filter((letter) => row.dims_mm[letter] !== undefined);
      if (JSON.stringify(stated) !== JSON.stringify([...shape.legs])) wrong.push(`${row.bar_mark} states legs ${stated.join("")} where shape ${row.shape} declares ${[...shape.legs].join("")}`);
      const answered = generic(legsOf(row), shape.bends, radiusOf(edition, row.dia_mm), row.dia_mm);
      if (!stands(answered, row.cutting_raw_mm)) wrong.push(`${row.bar_mark}: the generic form answered ${String(answered)} for ${row.cutting_raw_mm}`);
    }
    expect(wrong, say("the generic form governs every shape (AM-03(d))", wrong, golden.rows.length)).toEqual([]);
    const codes = door["SHAPE_CODES"] as readonly string[];
    expect([...seen].filter((code) => !codes.includes(code)), `every shape the golden details stands in \`SHAPE_CODES\` (it holds ${codes.join(", ")})`).toEqual([]);

    // Shape 51, read as AM-03(d) states it: 2(A + B) + 2C − 2.5r − 5d, where A and B are the two
    // sides to the outer bend line and C is the hook extension — the letters by the ROLE the clause
    // names them in, not by the slot a fixture happens to print them in. On a closed link that
    // roster is two side pairs and two hooks, so the letters are read off the legs themselves.
    //
    // What the clause demands is that the per-code spelling and the generic form answer the SAME
    // length, and that the length is the file's own: a code formula that disagrees with the generic
    // form is void (AM-03(d)). Both are asserted here, on every closed link the golden details.
    const links = golden.rows.filter((row) => row.shape === "51");
    expect(links.length, "the golden carries closed links (shape 51) — the mark AM-03(d) corrects").toBeGreaterThan(0);
    const bends51 = (shapes["51"] as { bends: readonly { angle: number; count: number }[] }).bends;
    const offForm: string[] = [];
    for (const closed of links) {
      const d = closed.dia_mm;
      const r = radiusOf(edition, d);
      const legs = legsOf(closed).map(Number);
      if (legs.length !== 6) {
        offForm.push(`${closed.bar_mark} states ${legs.length} legs where a closed link runs on six`);
        continue;
      }
      const sides = legs.slice(0, 4).sort((left, right) => left - right);
      const hooks = legs.slice(4);
      if (sides[0] !== sides[1] || sides[2] !== sides[3] || hooks[0] !== hooks[1]) {
        offForm.push(`${closed.bar_mark} runs ${legs.join("/")} mm, which is no closed link of two sides and two hooks`);
        continue;
      }
      const stated51 = 2 * ((sides[0] as number) + (sides[2] as number)) + 2 * (hooks[0] as number) - 2.5 * r - 5 * d;
      const answered51 = generic(legsOf(closed), bends51, r, d);
      if (Math.abs(Number(answered51) - stated51) >= 0.0005) {
        offForm.push(`${closed.bar_mark}: the generic form answered ${String(answered51)} where 2(A+B) + 2C − 2.5r − 5d on its own legs is ${stated51}`);
      }
      if (!stands(answered51, closed.cutting_raw_mm)) offForm.push(`${closed.bar_mark}: ${String(answered51)} is not the golden's own raw length ${closed.cutting_raw_mm}`);
    }
    expect(offForm, say("the shape-51 spelling and the generic form cut every closed link to the same length (AM-03(d))", offForm, links.length)).toEqual([]);
  });

  test("AC-3: roundedCuttingLengthOf is the one rounded surface, at 25 mm and never under the raw", async () => {
    const door = await bs8666Door();
    const roundedCuttingLengthOf = door["roundedCuttingLengthOf"] as (rawMm: string) => string;
    const wrong: string[] = [];
    for (const row of golden.rows) {
      const answered = roundedCuttingLengthOf(row.cutting_raw_mm);
      if (!stands(answered, row.cutting_rounded_mm)) wrong.push(`${row.bar_mark} rounded to ${String(answered)} where the golden holds ${row.cutting_rounded_mm}`);
      if (Number(answered) < Number(row.cutting_raw_mm)) wrong.push(`${row.bar_mark} rounded DOWN, to ${String(answered)} from ${row.cutting_raw_mm} — a bar a site cannot cut`);
      if (Number(answered) % golden.rounding_mm !== 0) wrong.push(`${row.bar_mark} rounded to ${String(answered)}, which is no multiple of ${golden.rounding_mm} mm`);
    }
    expect(wrong, say("every bar has exactly one rounded surface (AM-03(c))", wrong, golden.rows.length)).toEqual([]);
  });

  test("AC-3: the IS-additive figure is a field of its own, and never stands in for the raw", async () => {
    const door = await bs8666Door();
    const isAdditiveLengthOf = door["isAdditiveLengthOf"] as (probe: { shape: string; diameterMm: number; legsMm: readonly string[] }) => string;
    const cuttingLengthOf = door["cuttingLengthOf"] as (probe: { shape: string; diameterMm: number; legsMm: readonly string[] }) => string;

    const wrong: string[] = [];
    let diverged = 0;
    for (const row of golden.rows) {
      const probe = { shape: row.shape, diameterMm: row.dia_mm, legsMm: legsOf(row) };
      const answered = isAdditiveLengthOf(probe);
      if (!stands(answered, row.cutting_is_additive_mm)) wrong.push(`${row.bar_mark} recorded ${String(answered)} where the golden holds ${row.cutting_is_additive_mm}`);
      if (row.cutting_is_additive_mm !== row.cutting_raw_mm) {
        diverged += 1;
        // Where the two conventions disagree the RAW is still what cuttingLengthOf answers: the
        // additive figure is recorded beside it and never substituted for it (AM-03(c)).
        if (stands(cuttingLengthOf(probe), row.cutting_is_additive_mm)) wrong.push(`${row.bar_mark}: cuttingLengthOf answered the IS-additive figure ${row.cutting_is_additive_mm}`);
      }
    }
    expect(wrong, say("the IS-additive convention is recorded beside the raw length", wrong, golden.rows.length)).toEqual([]);
    expect(diverged, "the golden holds bars where the IS and BS conventions part company — the divergence is recorded, never asserted equal").toBeGreaterThan(0);

    const tie = golden.rows.find((row) => row.bar_mark === DIVERGENT_MARK) as BbsGoldenRow;
    expect(tie.cutting_raw_mm, `${DIVERGENT_MARK} cuts at ${DIVERGENT_RAW} mm by BS 8666`).toBe(DIVERGENT_RAW);
    expect(tie.cutting_is_additive_mm, `and is recorded at ${DIVERGENT_IS_ADDITIVE} mm by the IS additive convention`).toBe(DIVERGENT_IS_ADDITIVE);
    const probe = { shape: tie.shape, diameterMm: tie.dia_mm, legsMm: legsOf(tie) };
    expect(Number(cuttingLengthOf(probe)), "the module cuts it by BS 8666").toBeCloseTo(Number(DIVERGENT_RAW), 3);
    expect(Number(isAdditiveLengthOf(probe)), "and records the IS figure separately").toBeCloseTo(Number(DIVERGENT_IS_ADDITIVE), 3);
  });

  test("AC-3: massOf reproduces kg_net, kg_lap and kg for every row, off the table", async () => {
    const edition = await detailingEdition();
    const door = await massDoor();
    const massOf = door["massOf"] as (probe: { billableMm: string; diameterMm: number; bars: string; edition: unknown }) => string;
    const kilos = (billableMm: number, row: BbsGoldenRow): string => massOf({ billableMm: String(billableMm), diameterMm: row.dia_mm, bars: row.bars, edition });

    const wrong: string[] = [];
    for (const row of golden.rows) {
      const raw = Number(row.cutting_raw_mm);
      const lapped = Number(row.lap_mm) * row.laps_per_bar;
      const net = kilos(raw, row);
      const lap = kilos(lapped, row);
      const whole = kilos(raw + lapped, row);
      if (!stands(net, row.kg_net)) wrong.push(`${row.bar_mark} nets ${String(net)} kg where the golden holds ${row.kg_net}`);
      if (!stands(lap, row.kg_lap)) wrong.push(`${row.bar_mark} laps ${String(lap)} kg where the golden holds ${row.kg_lap}`);
      if (!stands(whole, row.kg)) wrong.push(`${row.bar_mark} bills ${String(whole)} kg where the golden holds ${row.kg}`);
    }
    expect(wrong, say("billed mass is billable length × the kg/m table (AM-03(b))", wrong, golden.rows.length)).toEqual([]);
  });
});
