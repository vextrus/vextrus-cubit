/**
 * AC-1 — `rcc.formwork` is a kind the product measures (R-TO-032, L-MEA-04, L-MEA-08, L-FRM-03).
 *
 * The catalogue is the one place that says what a quantity IS: the kinds, what each is measured in,
 * which discipline and algebra it belongs to, and which element classes bear it. This grades that
 * statement through the consts themselves and through the roster the measure job runs — the two
 * surfaces every other criterion of this leaf stands on.
 *
 * The emitted tables under `db/catalogue/` are the same statement, rendered: that they are re-emitted
 * from these consts, byte for byte, with the digest re-taken and the gate's drift stage green, is
 * proved by tests/catalogue/catalogue-tables.test.ts, which derives its answer from the consts and
 * needs no second copy here (ARCH-02).
 *
 * The other half of AC-1 — that the database's four closed-kind CHECKs admit a line of the new kind —
 * is a live-database claim, and is proved beside the rails in
 * tests/takeoff/rails/frame-kind-line.test.ts, which publishes one through the shipped gate.
 */
import { describe, expect, test } from "vitest";
import {
  AREA,
  BEAM_CLASS,
  BEARS_MODULE,
  CATALOGUE_MODULE,
  COLUMN_CLASS,
  FRAME_KINDS,
  FRAME_PAIRS,
  KINDS_MODULE,
  KIND_LAW_MODULE,
  LINTEL_CLASS,
  MAPS_MODULE,
  RCC_CONCRETE,
  RCC_FORMWORK,
  SQUARE_METRES,
  TIE_BEAM_CLASS,
  canon,
  productModule,
  railsRoster,
} from "../takeoff/rails/support/frame-rail-stage";

/** The discipline and the algebra the new kind stands in (AC-1). */
const STRUCTURAL = "STRUCTURAL";
const MEMBER_ALGEBRA = "member";

/** The precision a formwork figure is documented at (AC-1). */
const DOCUMENT_PRECISION = 2;

/**
 * What the FOUNDATIONS leaf appends to the two closed rosters this file grades, in the order it
 * appends them — the four kinds its rails measure, and the nine `bears` rows its classes hold.
 *
 * Re-baselined here rather than derived: a derivation cannot catch a roster an increment dropped, and
 * this file's claim is that the frame's own statement did not move when another area landed beside it
 * (B-19, the same re-baselining `src/modules/takeoff/rails/aggregate.test.ts` carries).
 */
const FOUNDATIONS_KINDS: readonly string[] = Object.freeze(["piling.bored", "piling.boring", "earthwork.excavation", "pcc.blinding"]);

/**
 * And what the MASONRY leaf appends after it, in the order it appends them: the brickwork a mason
 * builds and the two finishes a surface bears, with the three `bears` rows those two classes hold
 * (R-TO-032, L-MEA-03). Re-baselined here for the same reason as the four above.
 */
const MASONRY_KINDS: readonly string[] = Object.freeze(["masonry.brickwork", "finish.plaster", "finish.paint"]);

const MASONRY_BEARS: readonly { class: string; kind: string }[] = Object.freeze([
  { class: "brick_wall", kind: "masonry.brickwork" },
  { class: "surface", kind: "finish.plaster" },
  { class: "surface", kind: "finish.paint" },
]);

const FOUNDATIONS_BEARS: readonly { class: string; kind: string }[] = Object.freeze([
  { class: "footing", kind: RCC_CONCRETE },
  { class: "pile_cap", kind: RCC_CONCRETE },
  { class: "pile", kind: RCC_CONCRETE },
  { class: "pile", kind: "piling.bored" },
  { class: "pile", kind: "piling.boring" },
  { class: "footing", kind: "earthwork.excavation" },
  { class: "pile_cap", kind: "earthwork.excavation" },
  { class: "footing", kind: "pcc.blinding" },
  { class: "pile_cap", kind: "pcc.blinding" },
]);

/**
 * And what the REBAR leaf appends after those: `rcc.rebar`, reinforcement measured as nominal mass,
 * with the ten `bears` rows the classes that hold steel carry (R-TO-032, L-FRM-05). Re-baselined
 * here for the same reason as the rosters above — a derivation cannot catch a kind a leaf dropped.
 */
const REBAR_KINDS: readonly string[] = Object.freeze(["rcc.rebar"]);

const REBAR_BEARS: readonly { class: string; kind: string }[] = Object.freeze([
  { class: "column", kind: "rcc.rebar" },
  { class: "beam", kind: "rcc.rebar" },
  { class: "tie_beam", kind: "rcc.rebar" },
  { class: "slab", kind: "rcc.rebar" },
  { class: "footing", kind: "rcc.rebar" },
  { class: "pile_cap", kind: "rcc.rebar" },
  { class: "pile", kind: "rcc.rebar" },
  { class: "shear_wall", kind: "rcc.rebar" },
  { class: "stair", kind: "rcc.rebar" },
  { class: "lintel", kind: "rcc.rebar" },
]);

/** Every kind the product measures, frame first, in the order the closed roster names them. */
const MEASURED_KINDS: readonly string[] = Object.freeze([...FRAME_KINDS, ...FOUNDATIONS_KINDS, ...MASONRY_KINDS, ...REBAR_KINDS]);

describe("AC-1: rcc.formwork is a kind the product measures", () => {
  test("AC-1: KINDS answers the two kinds the frame measures, and the new one offends no vocabulary", async () => {
    const kinds = await productModule<{ KINDS: readonly string[]; isKind: (value: unknown) => boolean }>(KINDS_MODULE);
    const law = await productModule<{ offendingTokens: (name: string) => readonly { token: string; vocabulary: string }[] }>(KIND_LAW_MODULE);

    expect([...kinds.KINDS], `${KINDS_MODULE} closes over the two kinds this area measures, concrete first, and the foundations leaf's four beside them (AC-1)`).toEqual([
      ...MEASURED_KINDS,
    ]);
    expect(kinds.isKind(RCC_FORMWORK), "and admits the new one as a kind — the closed list and its guard are one statement").toBe(true);
    expect(
      law.offendingTokens(RCC_FORMWORK),
      "a kind names a trade and material only: `rcc.formwork` borrows no dimension, unit, element class, pricing role or book code (L-MEA-04)",
    ).toEqual([]);
  });

  test("AC-1: the catalogue states what a formwork quantity is, in the canonical unit of its dimension", async () => {
    const catalogue = await productModule<{ WORK_ITEM_CATALOGUE: Record<string, { description: string; dimension: string; canonicalUnit: string; documentPrecision: number }> }>(
      CATALOGUE_MODULE,
    );
    const units = await canon();
    const entry = catalogue.WORK_ITEM_CATALOGUE[RCC_FORMWORK];

    expect(entry, `${CATALOGUE_MODULE} carries an entry for ${RCC_FORMWORK} — every member of KINDS is a work item (AC-1)`).toBeTruthy();
    expect(entry?.dimension, "formwork is a contact AREA, never a volume (L-FRM-03)").toBe(AREA);
    expect(entry?.canonicalUnit, "stated in the canonical unit of that dimension, which the canon decides and the catalogue copies (L-FRM-06)").toBe(units.CANONICAL_UNIT[AREA]);
    expect(entry?.canonicalUnit, "— square metres (AC-1)").toBe(SQUARE_METRES);
    expect(entry?.documentPrecision, "and documented to two decimals (AC-1)").toBe(DOCUMENT_PRECISION);
    expect(typeof entry?.description, "beside the description a bill prints for it").toBe("string");
  });

  test("AC-1: the new kind is structural, and measured by the member algebra", async () => {
    const maps = await productModule<{ KIND_DISCIPLINE: Record<string, string>; KIND_ALGEBRA: Record<string, string> }>(MAPS_MODULE);

    expect(maps.KIND_DISCIPLINE[RCC_FORMWORK], "formwork to reinforced concrete is structural work (L-MEA-04)").toBe(STRUCTURAL);
    expect(maps.KIND_ALGEBRA[RCC_FORMWORK], "and is measured member by member — a section along a run, never a face of a space (L-MEA-08)").toBe(MEMBER_ALGEBRA);
    for (const kind of FRAME_KINDS) {
      expect(maps.KIND_DISCIPLINE[kind], `every kind the product measures names a discipline (${kind})`).toBeTruthy();
      expect(maps.KIND_ALGEBRA[kind], `and the algebra it is measured by (${kind})`).toBeTruthy();
    }
  });

  test("AC-1: BEARS says which classes bear which kind, and beam, tie beam and lintel are no longer unborne", async () => {
    const bears = await productModule<{ BEARS: readonly { class: string; kind: string }[]; UNBORNE: readonly string[] }>(BEARS_MODULE);

    // The relation this leaf leaves behind, derived from the six (class × kind) pairs it lands and
    // the one the column leaf landed before it — never a table of rows typed here (B-19).
    const owed = [
      { class: COLUMN_CLASS, kind: RCC_CONCRETE },
      ...FRAME_PAIRS.map((held) => ({ class: held.class, kind: held.kind })),
      ...FOUNDATIONS_BEARS,
      ...MASONRY_BEARS,
      ...REBAR_BEARS,
    ];
    expect(
      bears.BEARS.map((row) => ({ class: row.class, kind: row.kind })),
      "the column's concrete stands first, and each frame class bears both of the kinds this area measures (AC-1)",
    ).toEqual(owed);

    for (const className of [BEAM_CLASS, TIE_BEAM_CLASS, LINTEL_CLASS]) {
      expect(bears.UNBORNE, `${className} bears a kind now, so it is no longer a class nothing measures`).not.toContain(className);
    }
  });

  test("AC-1: the roster the measure job runs answers exactly the two kinds", async () => {
    const rails = await railsRoster();

    expect(
      Object.keys(rails).sort(),
      "a kind with no rail is a kind nothing measures, and a rail under no kind is never run: the roster is exactly the kinds this product measures (L-MEA-08)",
    ).toEqual([...MEASURED_KINDS].sort());
    for (const kind of MEASURED_KINDS) expect(typeof rails[kind], `${kind} is measured by a pure function (L-MEA-08)`).toBe("function");
  });
});
