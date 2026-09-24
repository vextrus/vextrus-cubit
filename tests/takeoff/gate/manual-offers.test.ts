/**
 * S3: a hand measurement reaches the gate (s-measure I-382, I-384, I-389, I-539).
 *
 * The one builder (`src/core/manual/offer.ts`) offers a traced ring under the pairing `MANUAL_RULES`
 * holds, the gate's own `judgeOffer` answers the figure, and the figure is what the drawing states:
 * the ring's area less the openings the edition's threshold deducts, less every member standing
 * through it clipped to what the ring holds, through the thickness the condition states. The expected
 * figure is DERIVED here from the rectangles this suite draws, never transcribed.
 *
 * Beside it: the fail-closed arm (a member nobody can lay on the ring refuses the measurement by
 * name), the cell rule on both arms at the gate, and the machine's rails handed no hand row.
 */
import { describe, expect, test } from "vitest";
import type { PinnedEdition } from "@/core/campaigns";
import { REFUSALS } from "@/core/errors";
import { judgeOffer, withoutSharedCells, type CellClaims, type Judged, type MeasuredUnder, type RegisteredLevel } from "@/core/gate/evaluate";
import { levelSegment } from "@/core/identity";
import { frameTranslation, junctionsOf, type FrameAxis, type JunctionFacts, type StandingMember } from "@/core/manual/junctions";
import type { JudgedPoint, MeasuredGeometry, Recipe } from "@/core/manual/law";
import { machineRowsOf, manualOffersOf, type ManualSetup, type OfferableMeasurement } from "@/core/manual/offer";
import { cellKeyOf } from "@/core/manual/overlap";
import type { Offer, RailSetup, RegisterObjectRow } from "@/core/offers/contract";
import { MANUAL_BLINDING_METHOD } from "@/core/rulesets/methods/manual/blinding";
import { SEED_EDITION_CONTENT } from "@/core/rulesets/seed";
import { exact } from "@/core/units/canon";
import { RAILS } from "@/modules/takeoff/rails";

/** The campaign every offer is judged under — a snapshot, not a store read. */
const UNDER: MeasuredUnder = {
  campaignId: "1a1d6c3a-0a5e-4a7b-9c2d-5252525252a1",
  projectId: "2b2d6c3a-0a5e-4a7b-9c2d-5252525252a2",
  setRevisionId: "3c3d6c3a-0a5e-4a7b-9c2d-5252525252a3",
  editionId: "4d4d6c3a-0a5e-4a7b-9c2d-5252525252a4",
  editionDigest: "0".repeat(64),
};

/** An edition citing the manual pair beside the seed's own parameters. */
const EDITION: PinnedEdition = { editionId: UNDER.editionId, digest: UNDER.editionDigest, parameters: SEED_EDITION_CONTENT.parameters, methods: [MANUAL_BLINDING_METHOD] };

const GF = "6eaf4fa7-0a5e-4a7b-9c2d-5252525252a9";
const OBJECT_KEY = `v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.5b1f0c9ad2e7|0.0,0.0@${GF}`;
const REGISTERED: ReadonlyMap<string, RegisteredLevel> = new Map([[OBJECT_KEY, { levelSlot: null, levelId: GF }]]);
const CALIBRATION = "cal:2073";

/** The ring's view and the columns' view: one drawing, two plans, the columns' 1 200 000 mm to the east (as BNBC's S-08 and S-10). */
const RING_VIEW = { ingestId: "ingest-1", viewKey: "LAYOUT_PLAN:DXF_HANDLE:2073" };
const COLUMN_VIEW = { ingestId: "ingest-1", viewKey: "LAYOUT_PLAN:DXF_HANDLE:20B6" };
const EAST = 1_200_000;
const SCALE = { factorX: "0.001", factorY: "0.001" };

/** A rectangle's corners, anticlockwise. */
type Rect = readonly [number, number, number, number];
const corners = ([x0, y0, x1, y1]: Rect): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const snappedRing = (rect: Rect, source: string): JudgedPoint[] => corners(rect).map(([x, y]) => ({ x: String(x), y: String(y), basis: "MEASURED", sources: [source] }));
const width = ([x0, , x1]: Rect): number => x1 - x0;
const depth = ([, y0, , y1]: Rect): number => y1 - y0;
const areaOf = (rect: Rect): string => exact(width(rect)).times(depth(rect)).toFixed();

/** The slab and what the QS cut out of it, in millimetres. */
const SLAB: Rect = [0, 0, 20000, 16000];
const PIT: Rect = [8000, 8000, 10000, 11000]; // 6 m²: above the 0.1 m² threshold, deducted
const DUCT: Rect = [1000, 1000, 1200, 1300]; // 0.06 m²: under it, kept
const TRACED_COLUMN: Rect = [3000, 12000, 3300, 12300]; // a column the QS traced: deducted whole

/** The register's columns of the storey below, drawn on their own plan (in that plan's frame). */
const INSIDE: Rect = [EAST + 4800, 4800, EAST + 5200, 5200]; // wholly inside: 0.16 m²
const STRADDLING: Rect = [EAST - 200, 4800, EAST + 200, 5200]; // half past the slab's edge: 0.08 m² held
const IN_THE_PIT: Rect = [EAST + 8800, 8800, EAST + 9200, 9200]; // the pit already took it
const OUTSIDE: Rect = [EAST + 30000, 4800, EAST + 30400, 5200]; // the ring does not meet it

/** Both plans' grids: letters along y, numerals along x, the columns' plan 1 200 000 mm east (float noise on one axis). */
const AXES: readonly FrameAxis[] = [
  ...[
    ["A", 0],
    ["B", 8000],
  ].flatMap(([label, position]) => [
    { ...RING_VIEW, family: "letter", axis: "y", label: String(label), position: Number(position) },
    { ...COLUMN_VIEW, family: "letter", axis: "y", label: String(label), position: Number(position) },
  ]),
  ...[
    ["1", 0],
    ["2", 10000],
  ].flatMap(([label, position]) => [
    { ...RING_VIEW, family: "numeral", axis: "x", label: String(label), position: Number(position) + 2.991758887410948e-15 },
    { ...COLUMN_VIEW, family: "numeral", axis: "x", label: String(label), position: Number(position) + EAST + 0.000000001 },
  ]),
];

const member = (key: string, rect: Rect, over: Partial<StandingMember> = {}): StandingMember => ({
  objectKey: `register:${key}`,
  source: `placement:${key}`,
  frame: COLUMN_VIEW,
  scale: SCALE,
  plan: corners(rect).map(([x, y]) => ({ x: String(x), y: String(y) })),
  ...over,
});

const MEMBERS: readonly StandingMember[] = [member("C-inside", INSIDE), member("C-straddling", STRADDLING), member("C-pit", IN_THE_PIT), member("C-outside", OUTSIDE)];
const FACTS: JunctionFacts = { ring: { ...RING_VIEW, scale: SCALE }, members: MEMBERS, axes: AXES };

const RECIPE: Recipe = {
  conditionId: null,
  conditionName: "75 CC blinding under SOG",
  geometry: "POLYGON",
  elementClass: "slab",
  kinds: [{ kind: "pcc.blinding", ruleId: MANUAL_BLINDING_METHOD.ruleId }],
  readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm", basis: "ENTERED", sourceKey: null }],
};

const TRACED: MeasuredGeometry = {
  geometry: "POLYGON",
  outer: snappedRing(SLAB, "DXF_HANDLE:81D"),
  cutouts: [
    { role: "OPENING", ring: snappedRing(PIT, "DXF_HANDLE:830") },
    { role: "OPENING", ring: snappedRing(DUCT, "DXF_HANDLE:831") },
    { role: "MEMBER", ring: snappedRing(TRACED_COLUMN, "DXF_HANDLE:832") },
  ],
};

function measurement(over: Partial<OfferableMeasurement> = {}): OfferableMeasurement {
  return {
    objectKey: OBJECT_KEY,
    setRevisionId: UNDER.setRevisionId,
    actId: "7f7d6c3a-0a5e-4a7b-9c2d-5252525252a7",
    drawingId: "5e5d6c3a-0a5e-4a7b-9c2d-5252525252a5",
    viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:2073",
    recipe: RECIPE,
    traced: TRACED,
    figureUnit: "mm2",
    calibrationKey: CALIBRATION,
    multiplier: "1",
    junctions: FACTS,
    ...over,
  };
}

/** The one offer the builder makes of a measurement, or a failure naming what it answered. */
function offerOf(m: OfferableMeasurement): Offer {
  const [answer] = manualOffersOf(m, EDITION);
  if (answer?.state !== "offered") throw new Error(`the builder did not offer: ${JSON.stringify(answer)}`);
  return answer.offer;
}

describe("S3: the offer builder, judged by the gate (I-384, I-389)", () => {
  test("the ring less the pit, the traced column and the members it holds — clipped — through 75 mm; the duct under the threshold kept", () => {
    const judgement = judgeOffer(offerOf(measurement()), UNDER, EDITION, REGISTERED);
    expect(judgement.arm, JSON.stringify(judgement)).toBe("published");
    if (judgement.arm !== "published") return;
    // Derived from the rectangles: the straddling column holds only the part inside x ≥ 0.
    const held = exact(STRADDLING[2] - EAST - SLAB[0]).times(depth(STRADDLING)).toFixed();
    const net = exact(areaOf(SLAB)).minus(areaOf(PIT)).minus(areaOf(TRACED_COLUMN)).minus(areaOf(INSIDE)).minus(held);
    const expected = net.times("75").div(exact(10).pow(9)); // mm² × mm → m³
    expect(exact(judgement.line.value ?? "NaN").eq(expected), `${judgement.line.value} m³ against ${expected.toFixed()} m³`).toBe(true);
    expect(judgement.line.unit).toBe("m3");
    expect(judgement.line.quantityBasis, "the weakest of the geometry, the entered thickness and the derived sums").toBe("ENTERED");
    expect(judgement.line.calibrationKeys).toEqual([CALIBRATION]);
    const sides = (judgement.line.deductions ?? []) as readonly { channel: string; measure: { value: string; source: string }; side: string }[];
    expect(sides.filter((one) => one.side === "kept").map((one) => one.measure.source), "the duct is kept, listed, and not deducted").toEqual(["DXF_HANDLE:831"]);
    expect(
      sides.filter((one) => one.channel === "junction").map((one) => [one.measure.source, one.measure.value]),
      "the traced column whole; the members the ring holds, each clipped; the one in the pit and the one outside nothing",
    ).toEqual([
      ["DXF_HANDLE:832", areaOf(TRACED_COLUMN)],
      ["placement:C-inside", areaOf(INSIDE)],
      ["placement:C-straddling", held],
    ]);
  });

  test("a member nobody can lay on the ring — no plan, no shared grid, another scale — refuses the measurement MANUAL_JUNCTION_UNPROVEN, naming it", () => {
    const cases: readonly [string, StandingMember][] = [
      ["no plan read", member("C-unread", INSIDE, { plan: null })],
      ["a plan with no grid the ring's shares", member("C-elsewhere", INSIDE, { frame: { ingestId: "ingest-2", viewKey: "LAYOUT_PLAN:DXF_HANDLE:9" } })],
      ["a plan affirmed at another scale", member("C-scaled", INSIDE, { scale: { factorX: "0.3048", factorY: "0.3048" } })],
    ];
    for (const [what, unplaced] of cases) {
      const [answer] = manualOffersOf(measurement({ junctions: { ...FACTS, members: [...MEMBERS, unplaced] } }), EDITION);
      expect(answer?.state, what).toBe("refused");
      if (answer?.state !== "refused") continue;
      expect(answer.code, what).toBe(REFUSALS.MANUAL_JUNCTION_UNPROVEN.code);
      expect(answer.detail["members"], what).toEqual([unplaced.objectKey]);
    }
    // And a ring whose own view stands under another scale now lays nothing at all.
    const [stale] = manualOffersOf(measurement({ junctions: { ...FACTS, ring: { ...RING_VIEW, scale: null } } }), EDITION);
    expect(stale?.state === "refused" ? stale.code : stale?.state).toBe(REFUSALS.MANUAL_JUNCTION_UNPROVEN.code);
  });

  test("two plans are one frame only where every shared label agrees on the placement lattice, two per world axis", () => {
    expect(frameTranslation(AXES, COLUMN_VIEW, RING_VIEW), "the float noise of two grids is the lattice's to absorb").toEqual({ dx: `-${EAST}.0`, dy: "0.0" });
    const bent = AXES.map((axis) => (axis.viewKey === COLUMN_VIEW.viewKey && axis.label === "2" ? { ...axis, position: axis.position + 500 } : axis));
    expect(frameTranslation(bent, COLUMN_VIEW, RING_VIEW), "labels that disagree are no frame").toBeNull();
    expect(frameTranslation(AXES.filter((axis) => axis.label !== "B"), COLUMN_VIEW, RING_VIEW), "one shared label on an axis proves nothing").toBeNull();
    expect(junctionsOf(TRACED, { ...FACTS, members: [] }), "a ring with no member deducts none").toEqual({ candidates: [], unplaced: [] });
  });

  test("a clipped area that does not end is rounded up — the larger deduction, the figure only under", () => {
    // A triangle-cut member: the ring's chamfer at 45° through a member whose plan it cuts by a third.
    const chamfered: MeasuredGeometry = {
      geometry: "POLYGON",
      outer: [
        { x: "0", y: "0", basis: "MEASURED", sources: [] },
        { x: "3", y: "0", basis: "MEASURED", sources: [] },
        { x: "0", y: "1", basis: "MEASURED", sources: [] },
      ],
      cutouts: [],
    };
    const facts: JunctionFacts = { ring: { ...RING_VIEW, scale: SCALE }, axes: [], members: [{ ...member("C", [0, 0, 1, 1]), frame: RING_VIEW }] };
    const [candidate] = junctionsOf(chamfered, facts).candidates;
    // The member [0,1]² under y = 1 − x/3 holds 1 − 1/6 = 5/6.
    expect(candidate?.area).toBe("0.833333333334");
    expect(exact(candidate?.area ?? "0").gt(exact(5).div(6))).toBe(true);
  });

  test("a kind no pairing holds for this geometry and class is not offered, and no rule is guessed (I-539)", () => {
    const concrete: Recipe = { ...RECIPE, kinds: [{ kind: "rcc.concrete", ruleId: "rcc.concrete.slab" }] };
    expect(manualOffersOf(measurement({ recipe: concrete }), EDITION)).toEqual([{ kind: "rcc.concrete", state: "not-offered" }]);
    const renamed: Recipe = { ...RECIPE, kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding_rect" }] };
    expect(manualOffersOf(measurement({ recipe: renamed }), EDITION)[0]?.state).toBe("not-offered");
    const unread: Recipe = { ...RECIPE, readings: [] };
    const [answer] = manualOffersOf(measurement({ recipe: unread }), EDITION);
    expect(answer?.state === "refused" ? answer.code : answer?.state, "no thickness is no offer, never a default").toBe(REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  });

  test("the preview's reading and the run's differ only in what an ENTERED reading cites, never in the figure", () => {
    const preview = judgeOffer(offerOf(measurement({ actId: null })), UNDER, EDITION, REGISTERED);
    const run = judgeOffer(offerOf(measurement()), UNDER, EDITION, REGISTERED);
    if (preview.arm !== "published" || run.arm !== "published") throw new Error("both publish");
    expect([preview.line.value, preview.line.formula, preview.line.quantityBasis]).toEqual([run.line.value, run.line.formula, run.line.quantityBasis]);
  });
});

describe("S3: a cell is the machine's or the person's, never both — refused by name on both arms (I-382)", () => {
  const level = levelSegment({ levelId: GF });
  const cell = cellKeyOf("slab", "pcc.blinding", level);
  const machineKey = `v:LAYOUT_PLAN:DXF_HANDLE:2073|SOG|0.0,0.0@${GF}`;
  const registered = new Map<string, RegisteredLevel>([...REGISTERED, [machineKey, { levelSlot: null, levelId: GF }]]);
  const published = (offer: Offer): Judged => {
    const judgement = judgeOffer(offer, UNDER, EDITION, registered);
    if (judgement.arm !== "published") throw new Error(JSON.stringify(judgement));
    return { offer, judgement };
  };
  const hand = offerOf(measurement());
  const machine: Offer = { ...hand, register: { ...hand.register, objectKey: machineKey } };
  const codeOf = (judged: Judged): string | null => (judged.judgement.arm === "refused" ? judged.judgement.refusal.code : null);

  test("a machine offer into a cell a standing hand measurement claims is CELL_MEASURED_BY_HAND, whatever the batch order", () => {
    const claims: CellClaims = { hand: new Set([OBJECT_KEY]), handCells: new Set([cell]), machineCells: new Set() };
    for (const batch of [
      [published(machine), published(hand)],
      [published(hand), published(machine)],
    ]) {
      const answered = withoutSharedCells(batch, registered, claims);
      const byKey = new Map(answered.map((one) => [one.offer.register.objectKey, codeOf(one)]));
      expect(byKey.get(machineKey)).toBe(REFUSALS.CELL_MEASURED_BY_HAND.code);
      expect(byKey.get(OBJECT_KEY), "the person's line stands").toBeNull();
    }
    expect(codeOf(withoutSharedCells([published(machine)], registered, { ...claims, handCells: new Set() })[0] as Judged), "a struck hand measurement claims nothing").toBeNull();
  });

  test("a hand offer into a cell where a standing machine object published is MANUAL_CELL_MACHINE_MEASURED", () => {
    const claims: CellClaims = { hand: new Set([OBJECT_KEY]), handCells: new Set([cell]), machineCells: new Set([cell]) };
    expect(codeOf(withoutSharedCells([published(hand)], registered, claims)[0] as Judged)).toBe(REFUSALS.MANUAL_CELL_MACHINE_MEASURED.code);
    const elsewhere: CellClaims = { ...claims, machineCells: new Set([cellKeyOf("slab", "rcc.concrete", level)]) };
    expect(codeOf(withoutSharedCells([published(hand)], registered, elsewhere)[0] as Judged), "another kind of the same class and level is another cell").toBeNull();
  });
});

describe("S3: the machine's rails never read a hand row; the kind's manual arm offers it (I-384)", () => {
  /** A setup every rail can read, with nothing in it but the hand measurement. */
  const setup = (manual: ManualSetup | undefined): RailSetup => ({
    placements: {},
    memberTypes: {},
    levels: [{ levelId: GF, label: "GF", ordinal: 0, height: { standing: "NONE", value: null, unit: null, basis: null, sourceKey: null } }],
    calibrations: {},
    grades: {},
    plans: {},
    runs: {},
    lintels: {},
    walls: {},
    surfaces: {},
    siteFacts: {},
    edition: { digest: EDITION.digest, parameters: EDITION.parameters },
    detailing: { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: [], sourceKeys: [] },
    ...(manual === undefined ? {} : { manual }),
  });
  const handRow = {
    tenantId: "8a8d6c3a-0a5e-4a7b-9c2d-5252525252a8",
    setRevisionId: UNDER.setRevisionId,
    objectKey: OBJECT_KEY,
    projectId: UNDER.projectId,
    discipline: "STRUCTURAL",
    elementType: "slab",
    mark: "~m.5b1f0c9ad2e7",
    viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:2073",
    placementKey: "v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.5b1f0c9ad2e7|0.0,0.0",
    levelId: GF,
    levelSlot: null,
    levelLabel: null,
    standing: "MEASURED",
    semantic: "0".repeat(64),
    registeredAt: new Date(0),
  } as RegisterObjectRow;
  const manual: ManualSetup = { origin: [OBJECT_KEY], measurements: [measurement()] };

  /** Every kind's rail over these rows and this setup: what each offered and observed, joined. */
  function runAll(objects: readonly RegisterObjectRow[], rails: RailSetup) {
    const offers: Offer[] = [];
    const observed: string[] = [];
    for (const [kind, rail] of Object.entries(RAILS)) {
      const batch = rail?.({ campaignId: UNDER.campaignId, setRevisionId: UNDER.setRevisionId, kind: kind as Offer["kind"], objects, setup: rails });
      offers.push(...(batch?.offers ?? []));
      for (const observation of batch?.observations ?? []) if (observation.objectKey === OBJECT_KEY) observed.push(`${observation.kind}:${observation.code}`);
    }
    return { offers, observed };
  }

  test("handed the hand row, a machine rail reports on it as a sighting it failed — which is why the run filters it out", () => {
    expect(runAll([handRow], setup(undefined)).observed.length, "the slab rails read a slab row with no plan as their own").toBeGreaterThan(0);
  });

  test("the run's rows are the machine's; every rail observes nothing about the hand row, and the blinding's arm offers it once", () => {
    const rows = machineRowsOf([handRow], manual);
    expect(rows, "the manual-origin fact, not the mark, takes it out").toEqual([]);
    const { offers, observed } = runAll(rows, setup(manual));
    expect(observed, "no rail says anything about the hand row").toEqual([]);
    expect(offers.map((offer) => [offer.kind, offer.register.objectKey, offer.ruleId])).toEqual([["pcc.blinding", OBJECT_KEY, MANUAL_BLINDING_METHOD.ruleId]]);
    expect(machineRowsOf([handRow], undefined), "a setup with no hand measurement filters nothing").toEqual([handRow]);
  });

  test("a measurement the builder refuses is the arm's observation, by its registered code", () => {
    const blocked: ManualSetup = { origin: [OBJECT_KEY], measurements: [measurement({ junctions: { ...FACTS, members: [member("C-unread", INSIDE, { plan: null })] } })] };
    const { offers, observed } = runAll([], setup(blocked));
    expect(offers).toEqual([]);
    expect(observed).toEqual([`pcc.blinding:${REFUSALS.MANUAL_JUNCTION_UNPROVEN.code}`]);
  });
});
