/**
 * S1: RECORD_MANUAL_MEASUREMENT — the act's place in L-ACT-02's total map and L-ACT-03's permission
 * map, the MEASUREMENT arm's payload bound by the digest (I-373), and the act's judgement over a
 * staged world held in memory: every refusal the preview answers, by its registered name, and the
 * edit, delete and re-trace readings of I-379.
 *
 * The judgement is the act's own (`deriveMeasurement`) over the reader port its transaction answers in
 * production; here the port is answered from a stage, so every code is proved without a store. The
 * same judgement over a live database is `manual-act.test.ts`.
 */
import { describe, expect, test } from "vitest";
import { ACT_MAP, ACT_PERMISSION, ACT_TYPES, consequenceDigest, type Consequence } from "../../../src/core/acts";
import { deriveMeasurement, type Derived, type ManualReader, type RecordManualMeasurementInput } from "../../../src/core/acts/record-manual-measurement";
import { REFUSALS } from "../../../src/core/errors";
import { refusalCodeOf } from "../../../src/core/faults/refusal-marker";
import { levelSegment } from "../../../src/core/identity";
import type { Recipe, StatedPoint } from "../../../src/core/manual/law";
import type { DrawingFacts } from "../../../src/core/manual/snaps";
import type { LineOfCell, StoredMeasurement } from "../../../src/core/manual/store";
import type { ViewRecord } from "../../../src/core/views";

const ACT = "RECORD_MANUAL_MEASUREMENT";
const TENANT = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const PROJECT = "3f2504e0-4f89-41d3-9a0c-0305e82c3302";
const REVISION = "3f2504e0-4f89-41d3-9a0c-0305e82c3303";
const DRAWING = "3f2504e0-4f89-41d3-9a0c-0305e82c3304";
const GF = "3f2504e0-4f89-41d3-9a0c-0305e82c3305";
const PLAN = "LAYOUT_PLAN:DXF_HANDLE:A0";
const DETAIL = "DETAIL:DXF_HANDLE:B0";
const SHA = "ab".repeat(32);
/** A condition the project's chest holds, one it retired, and one it never held. */
const CONDITION = "3f2504e0-4f89-41d3-9a0c-0305e82c3306";
const RETIRED = "3f2504e0-4f89-41d3-9a0c-0305e82c3307";
const UNHELD = "3f2504e0-4f89-41d3-9a0c-0305e82c3308";

/** S-08 in miniature: a slab outline and a lift pit on the plan, and a detail beside it. */
const SLAB = "DXF_HANDLE:10";
const PIT = "DXF_HANDLE:11";
const SLAB_POINTS: readonly [number, number][] = [
  [0, 0],
  [10000, 0],
  [10000, 8000],
  [0, 8000],
];
const PIT_POINTS: readonly [number, number][] = [
  [4000, 3000],
  [5000, 3000],
  [5000, 4000],
  [4000, 4000],
];

const view = (viewKey: string, type: ViewRecord["type"], anchorKey: string | null): ViewRecord => ({ viewKey, type, reason: null, caption: viewKey, anchorKey, proposed: null, confirmed: null });

const RECIPE: Recipe = {
  conditionId: null,
  conditionName: "75 CC blinding under SOG",
  geometry: "POLYGON",
  elementClass: "slab",
  kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding.area" }],
  readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm", basis: "ENTERED", sourceKey: null }],
};

/** A world as the reader answers it — each part replaceable by a case. */
type World = {
  campaign: boolean;
  manifest: readonly string[];
  views: readonly ViewRecord[];
  discipline: string | null;
  factor: string | null;
  levels: readonly string[];
  measurements: StoredMeasurement[];
  repudiated: Set<string>;
  lines: LineOfCell[];
  facts: DrawingFacts;
  /** The project's chest: each condition by id, and whether it was retired. */
  conditions: ReadonlyMap<string, { retired: boolean }>;
};

function world(over: Partial<World> = {}): World {
  return {
    campaign: true,
    manifest: [DRAWING],
    views: [view(PLAN, "LAYOUT_PLAN", "DXF_HANDLE:A0"), view(DETAIL, "DETAIL", "DXF_HANDLE:B0"), view("SCHEDULE:DXF_HANDLE:C0", "SCHEDULE", "DXF_HANDLE:C0")],
    discipline: "STRUCTURAL",
    factor: "0.001000000000",
    levels: [GF],
    measurements: [],
    repudiated: new Set(),
    lines: [],
    facts: {
      shapes: new Map([
        [SLAB, { space: "model", paths: [{ points: SLAB_POINTS, closed: true }] }],
        [PIT, { space: "model", paths: [{ points: PIT_POINTS, closed: true }] }],
        ["DXF_HANDLE:20", { space: "model", paths: [{ points: [[50000, 0], [60000, 0]], closed: false }] }],
        ["DXF_HANDLE:30", { space: "model", paths: [{ points: [[20000, 0], [30000, 0], [30000, 5000], [20000, 5000]], closed: true }] }],
        ["DXF_HANDLE:NOTE", { space: "model", paths: [{ points: [[100, 100]], closed: false }] }],
      ]),
      assigned: new Map([
        [SLAB, PLAN],
        [PIT, PLAN],
        ["DXF_HANDLE:NOTE", PLAN],
        ["DXF_HANDLE:20", DETAIL],
        ["DXF_HANDLE:30", DETAIL],
      ]),
      axes: new Map(),
    },
    conditions: new Map([[CONDITION, { retired: false }], [RETIRED, { retired: true }]]),
    ...over,
  };
}

function readerOf(w: World): ManualReader {
  const scope = { tenantId: TENANT, projectId: PROJECT, setRevisionId: REVISION };
  return {
    campaign: async () => (w.campaign ? { scope, campaignId: "campaign-1" } : null),
    condition: async (conditionId) => {
      const held = w.conditions.get(conditionId);
      return held === undefined ? null : { conditionId, retired: held.retired };
    },
    manifest: async () => w.manifest.map((revisionId) => ({ drawingId: revisionId, revisionId, sha256: SHA, name: "S-08.dxf" })),
    record: async (drawingId) => (drawingId === DRAWING ? { ingestId: "ingest-1", drawingId, artifactSha256: "cd".repeat(32), extractor: { scheme: "DXF_HANDLE" }, facts: {} } : null),
    views: async () => w.views,
    sheetDiscipline: async () => w.discipline as never,
    calibration: async () => (w.factor === null ? null : { factorX: w.factor, factorY: w.factor, calibrationKey: "k".repeat(64) }),
    tolerance: async () => "0.01",
    drawingFacts: async () => w.facts,
    liveLevels: async () => new Set(w.levels),
    measurements: async () => w.measurements,
    repudiated: async () => w.repudiated,
    lines: async () => w.lines,
  };
}

const snapped = (points: readonly [number, number][], key: string): StatedPoint[] => points.map(([x, y]) => ({ x, y, cites: [key] }));

function tracing(over: Partial<RecordManualMeasurementInput> = {}): RecordManualMeasurementInput {
  return {
    type: ACT,
    projectId: PROJECT,
    drawingId: DRAWING,
    layoutName: "model",
    viewKey: PLAN,
    recipe: RECIPE,
    level: { levelId: GF },
    geometry: { geometry: "POLYGON", outer: snapped(SLAB_POINTS, SLAB), cutouts: [{ role: "OPENING", ring: snapped(PIT_POINTS, PIT) }] },
    replaces: null,
    ...over,
  };
}

/** A derived measurement as the store would hold it after its act. */
function stored(derived: Derived): StoredMeasurement {
  const m = derived.measurement;
  return {
    objectKey: m.objectKey,
    conditionName: m.recipe.conditionName,
    elementClass: m.recipe.elementClass,
    kinds: m.recipe.kinds.map((entry) => entry.kind),
    recipe: m.recipe,
    level: levelSegment(m.level),
    viewKey: m.viewKey,
    space: m.layoutName,
    traced: m.traced,
    supersedes: m.supersedes,
    actId: "00000000-0000-4000-8000-0000000000ac",
    drawingId: m.drawingId,
    ingestId: derived.ingestId,
    partitionViewKey: m.partitionViewKey,
    levelRef: m.level,
    calibrationKey: m.calibrationKey,
    drawnUnit: derived.drawnUnit,
    figureUnit: derived.figureUnit,
  };
}

/** The code a judgement refused with — the refusal named, never merely a failure. */
async function refusedWith(work: Promise<unknown>): Promise<string | null> {
  try {
    await work;
  } catch (failure) {
    return refusalCodeOf(failure);
  }
  return null;
}

/** The judgement refuses, by the registered code named — an assertion helper, as the register reads one. */
async function expectRefusal(work: Promise<unknown>, code: string): Promise<void> {
  expect(await refusedWith(work), `the preview answers ${code}`).toBe(code);
}

describe("S1: RECORD_MANUAL_MEASUREMENT joins L-ACT-02's total map under MEASURE", () => {
  test("the enum, the permission map and the act map all carry it", () => {
    expect(ACT_TYPES as readonly string[]).toContain(ACT);
    expect(ACT_PERMISSION[ACT], "L-ACT-03 cuts MEASURE on manual measurement acts").toBe("MEASURE");
    expect(typeof ACT_MAP[ACT].preview).toBe("function");
    expect(typeof ACT_MAP[ACT].commit).toBe("function");
  });

  test("the digest binds the MEASUREMENT arm's payload, and an act with no such arm digests as it did", async () => {
    const derived = await deriveMeasurement(tracing(), readerOf(world()));
    const consequence: Consequence = { actType: ACT, tenantId: TENANT, projectId: PROJECT, rendering: "MEASUREMENT", subjects: [], measurement: derived.measurement };
    const moved: Consequence = { ...consequence, measurement: { ...derived.measurement, figure: { measure: "AREA", gross: "1", cutouts: [] } } };
    expect(consequenceDigest(moved), "a different figure is a different consequence (I-373)").not.toBe(consequenceDigest(consequence));
    const reread: Consequence = { ...consequence, measurement: { ...derived.measurement, recipe: { ...RECIPE, readings: [{ ...RECIPE.readings[0], valueAsWritten: "100" } as Recipe["readings"][number]] } } };
    expect(consequenceDigest(reread), "and so is a different recipe").not.toBe(consequenceDigest(consequence));
    const plain: Consequence = { actType: "REPUDIATE", tenantId: TENANT, projectId: PROJECT, rendering: "SUBJECTS", subjects: [{ subjectId: "x", before: ["REGISTERED"], after: ["REPUDIATED"] }] };
    expect(consequenceDigest({ ...plain, measurement: undefined }), "no payload, no change to any other act's digest").toBe(consequenceDigest(plain));
  });
});

describe("S1: the act's judgement over what stands", () => {
  test("a lawful trace: one markless key on the plan, the exact figure, the pit a cut-out, MEASURED by its snaps", async () => {
    const derived = await deriveMeasurement(tracing(), readerOf(world()));
    const m = derived.measurement;
    expect(m.objectKey).toMatch(/^v:LAYOUT_PLAN:DXF_HANDLE:A0\|~m\.[0-9a-f]{16}\|0\.0,0\.0@3f2504e0-4f89-41d3-9a0c-0305e82c3305$/u);
    expect(m.figure).toEqual({ measure: "AREA", gross: "80000000", cutouts: [{ role: "OPENING", area: "1000000" }] });
    expect([m.drawnUnit, m.figureUnit, m.basis, m.demoted]).toEqual(["mm", "mm2", "MEASURED", 0]);
    expect([m.supersedes, m.replaces]).toEqual([null, null]);
    expect(derived.discipline, "the register row's discipline is the sheet's confirmed one (I-376)").toBe("STRUCTURAL");
  });

  test("the anchorless view is keyed by the drawing revision's bytes (I-375)", async () => {
    const anchorless = world({ views: [view("UNASSIGNED", "UNASSIGNED", null)], facts: { ...world().facts, assigned: new Map([[SLAB, "UNASSIGNED"], [PIT, "UNASSIGNED"]]) } });
    const derived = await deriveMeasurement(tracing({ viewKey: "UNASSIGNED" }), readerOf(anchorless));
    expect(derived.measurement.objectKey.startsWith(`v:UNASSIGNED:FILE:${SHA}|~m.`)).toBe(true);
  });

  test("a snapped point the drawing does not reproduce is counted as placed by hand, and a note it cannot find transcribes nothing", async () => {
    const outer = snapped(SLAB_POINTS, SLAB);
    outer[2] = { x: 9999.3, y: 7999.4, cites: [SLAB] };
    const recipe: Recipe = { ...RECIPE, readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm", basis: "TRANSCRIBED", sourceKey: "DXF_HANDLE:FFFF" }] };
    const derived = await deriveMeasurement(tracing({ recipe, geometry: { geometry: "POLYGON", outer, cutouts: [] } }), readerOf(world()));
    expect([derived.measurement.demoted, derived.measurement.basis]).toEqual([1, "ENTERED"]);
    expect(derived.measurement.recipe.readings[0]).toMatchObject({ basis: "ENTERED", sourceKey: null });
    const noted = await deriveMeasurement(tracing({ recipe: { ...recipe, readings: [{ ...recipe.readings[0], sourceKey: "DXF_HANDLE:NOTE" } as Recipe["readings"][number]] } }), readerOf(world()));
    expect(noted.measurement.recipe.readings[0], "a note the drawing holds is TRANSCRIBED and cited").toMatchObject({ basis: "TRANSCRIBED", sourceKey: "DXF_HANDLE:NOTE" });
  });

  test(`a recipe applied from the chest names a condition that stands in it, or is ${REFUSALS.MANUAL_CONDITION_NOT_STANDING.code} (I-374)`, async () => {
    const applied = (conditionId: string | null): RecordManualMeasurementInput => tracing({ recipe: { ...RECIPE, conditionId } });
    await expect(deriveMeasurement(applied(CONDITION), readerOf(world()))).resolves.toBeDefined();
    await expect(deriveMeasurement(applied(null), readerOf(world({ conditions: new Map() }))), "a recipe stated whole cites no condition, and none is asked after").resolves.toBeDefined();
    await expectRefusal(deriveMeasurement(applied(RETIRED), readerOf(world())), REFUSALS.MANUAL_CONDITION_NOT_STANDING.code);
    await expectRefusal(deriveMeasurement(applied(UNHELD), readerOf(world())), REFUSALS.MANUAL_CONDITION_NOT_STANDING.code);
  });

  test("refuses where the project, the sheet or the view cannot hold a measurement — each by name", async () => {
    await expectRefusal(deriveMeasurement(tracing(), readerOf(world({ campaign: false }))), REFUSALS.MANUAL_NO_CAMPAIGN.code);
    await expectRefusal(deriveMeasurement(tracing(), readerOf(world({ manifest: [] }))), REFUSALS.MANUAL_SHEET_NOT_PINNED.code);
    await expectRefusal(deriveMeasurement(tracing({ viewKey: "LAYOUT_PLAN:DXF_HANDLE:ZZ" }), readerOf(world())), REFUSALS.PARTITION_NOT_AVAILABLE.code);
    await expectRefusal(deriveMeasurement(tracing({ viewKey: "SCHEDULE:DXF_HANDLE:C0" }), readerOf(world())), REFUSALS.MANUAL_VIEW_DRAWS_NO_SCOPE.code);
    await expectRefusal(deriveMeasurement(tracing(), readerOf(world({ discipline: null }))), REFUSALS.MANUAL_DISCIPLINE_UNCONFIRMED.code);
    await expectRefusal(deriveMeasurement(tracing(), readerOf(world({ discipline: "ARCHITECTURAL" }))), REFUSALS.MANUAL_KIND_NOT_THIS_DISCIPLINE.code);
  });

  test("refuses a view with no scale of record, or one drawn full size in no unit the bill converts", async () => {
    await expectRefusal(deriveMeasurement(tracing(), readerOf(world({ factor: null }))), REFUSALS.VIEW_SCALE_UNAFFIRMED.code);
    await expectRefusal(deriveMeasurement(tracing(), readerOf(world({ factor: "0.100000000000" }))), REFUSALS.MANUAL_UNIT_NOT_CONVERTIBLE.code);
  });

  test("refuses no level, the UNRESOLVED slot and a level the stack does not hold (I-377, I-368)", async () => {
    await expectRefusal(deriveMeasurement(tracing({ level: null }), readerOf(world())), REFUSALS.MANUAL_LEVEL_UNSTATED.code);
    await expectRefusal(deriveMeasurement(tracing({ level: { slot: "UNRESOLVED" } }), readerOf(world())), REFUSALS.MANUAL_LEVEL_UNSTATED.code);
    await expectRefusal(deriveMeasurement(tracing({ level: { levelId: "3f2504e0-4f89-41d3-9a0c-0305e82c3399" } }), readerOf(world())), REFUSALS.MANUAL_LEVEL_UNSTATED.code);
  });

  test("a foundation class stands in the FOUNDATION slot whatever was stated; a class on a storey never does (I-377, L-CAD-07)", async () => {
    const footing: Recipe = { ...RECIPE, conditionName: "75 CC blinding under footings", elementClass: "footing" };
    const derived = await deriveMeasurement(tracing({ recipe: footing, level: { levelId: GF } }), readerOf(world()));
    expect(derived.measurement.level, "the slot the placement stands a drawn footing in, so the two meet in one cell (I-382)").toEqual({ slot: "FOUNDATION" });
    expect(derived.measurement.objectKey.endsWith("@FOUNDATION")).toBe(true);
    await expectRefusal(deriveMeasurement(tracing({ level: { slot: "FOUNDATION" } }), readerOf(world())), REFUSALS.MANUAL_LEVEL_UNSTATED.code);
  });

  test("refuses a point off the named view, a degenerate outline and a reading that is no number", async () => {
    const offView = [...snapped(SLAB_POINTS.slice(0, 3), SLAB), { x: 50000, y: 0, cites: ["DXF_HANDLE:20"] }];
    await expectRefusal(deriveMeasurement(tracing({ geometry: { geometry: "POLYGON", outer: offView, cutouts: [] } }), readerOf(world())), REFUSALS.MANUAL_RING_OFF_VIEW.code);
    await expectRefusal(deriveMeasurement(tracing({ geometry: { geometry: "POLYGON", outer: snapped(SLAB_POINTS.slice(0, 2), SLAB), cutouts: [] } }), readerOf(world())), REFUSALS.MANUAL_GEOMETRY_DEGENERATE.code);
    const unread: Recipe = { ...RECIPE, readings: [{ ...RECIPE.readings[0], valueAsWritten: "N/A" } as Recipe["readings"][number]] };
    await expectRefusal(deriveMeasurement(tracing({ recipe: unread }), readerOf(world())), REFUSALS.READING_NOT_NUMERIC.code);
  });

  test("refuses an edit of a measurement that does not stand, and a cell the product already measures (I-379, I-382)", async () => {
    await expectRefusal(deriveMeasurement(tracing({ replaces: "v:LAYOUT_PLAN:DXF_HANDLE:A0|~m.0000000000000000|0.0,0.0@x" }), readerOf(world())), REFUSALS.MANUAL_PREDECESSOR_NOT_STANDING.code);
    const machine: LineOfCell = { objectKey: "v:LAYOUT_PLAN:DXF_HANDLE:A0|SOG|0.0,0.0@x", elementClass: "slab", kind: "pcc.blinding", level: `@${GF}` };
    await expectRefusal(deriveMeasurement(tracing(), readerOf(world({ lines: [machine] }))), REFUSALS.MANUAL_CELL_MACHINE_MEASURED.code);
  });

  test("a line of a struck object, or at another level or kind, does not claim the cell (I-382)", async () => {
    const line = (over: Partial<LineOfCell>): LineOfCell => ({ objectKey: "machine", elementClass: "slab", kind: "pcc.blinding", level: `@${GF}`, ...over });
    await expect(deriveMeasurement(tracing(), readerOf(world({ lines: [line({ kind: "rcc.concrete" }), line({ level: "@FOUNDATION" })] })))).resolves.toBeDefined();
    await expect(deriveMeasurement(tracing(), readerOf(world({ lines: [line({})], repudiated: new Set(["machine"]) })))).resolves.toBeDefined();
  });
});

describe("S1: on a metre drawing the act judges each point within one micrometre, never a lattice step (I-387)", () => {
  /** The review's probe: a 10 m slab drawn in metres as four LINEs, affirmed full size in metres. */
  const EDGES: readonly (readonly [string, readonly [number, number], readonly [number, number]])[] = [
    ["DXF_HANDLE:L1", [0, 0], [10, 0]],
    ["DXF_HANDLE:L2", [10, 0], [10, 10]],
    ["DXF_HANDLE:L3", [10, 10], [0, 10]],
    ["DXF_HANDLE:L4", [0, 10], [0, 0]],
  ];
  const metres = world({
    factor: "1.000000000000",
    facts: {
      shapes: new Map(EDGES.map(([key, from, to]) => [key, { space: "model", paths: [{ points: [from, to], closed: false }] }])),
      assigned: new Map(EDGES.map(([key]) => [key, PLAN])),
      axes: new Map(),
    },
  });
  const corners = (push: number): StatedPoint[] => [
    { x: -push, y: -push, cites: ["DXF_HANDLE:L4", "DXF_HANDLE:L1"] },
    { x: 10 + push, y: -push, cites: ["DXF_HANDLE:L1", "DXF_HANDLE:L2"] },
    { x: 10 + push, y: 10 + push, cites: ["DXF_HANDLE:L2", "DXF_HANDLE:L3"] },
    { x: -push, y: 10 + push, cites: ["DXF_HANDLE:L3", "DXF_HANDLE:L4"] },
  ];
  const traced = (push: number): RecordManualMeasurementInput => tracing({ geometry: { geometry: "POLYGON", outer: corners(push), cutouts: [] } });

  test("the honest trace: 100 m², MEASURED, carried in m²", async () => {
    const m = (await deriveMeasurement(traced(0), readerOf(metres))).measurement;
    expect([m.figure.gross, m.basis, m.demoted, m.drawnUnit, m.figureUnit]).toEqual(["100", "MEASURED", 0, "m", "m2"]);
  });

  test("four corners pushed 70 mm outward: every one demoted, and the figure the card shows is ENTERED, not the drawing's", async () => {
    const m = (await deriveMeasurement(traced(0.07), readerOf(metres))).measurement;
    expect([m.basis, m.demoted]).toEqual(["ENTERED", 4]);
  });
});

describe("S1: a second measurement, an edit, a delete and a re-trace (I-379, I-380, I-381, L-REG-03)", () => {
  test(`the same trace again is ${REFUSALS.DUPLICATE_IDENTITY.code}`, async () => {
    const first = await deriveMeasurement(tracing(), readerOf(world()));
    const again = world({ measurements: [stored(first)] });
    expect(await refusedWith(deriveMeasurement(tracing(), readerOf(again)))).toBe(REFUSALS.DUPLICATE_IDENTITY.code);
  });

  test(`an overlapping outline on the same view is ${REFUSALS.MANUAL_OVERLAP.code}; one on another view is ${REFUSALS.MANUAL_CELL_OTHER_VIEW.code}`, async () => {
    const first = await deriveMeasurement(tracing({ geometry: { geometry: "POLYGON", outer: snapped(SLAB_POINTS, SLAB), cutouts: [] } }), readerOf(world()));
    const standing = world({ measurements: [stored(first)] });
    const inner = snapped(PIT_POINTS, PIT);
    expect(await refusedWith(deriveMeasurement(tracing({ geometry: { geometry: "POLYGON", outer: inner, cutouts: [] } }), readerOf(standing)))).toBe(REFUSALS.MANUAL_OVERLAP.code);
    const elsewhere = tracing({ viewKey: DETAIL, geometry: { geometry: "POLYGON", outer: snapped([[20000, 0], [30000, 0], [30000, 5000], [20000, 5000]], "DXF_HANDLE:30"), cutouts: [] } });
    expect(await refusedWith(deriveMeasurement(elsewhere, readerOf(standing)))).toBe(REFUSALS.MANUAL_CELL_OTHER_VIEW.code);
  });

  test("an attribute-only edit supersedes: a key of its own, naming its predecessor, which it strikes — never refused as overlapping it", async () => {
    const first = await deriveMeasurement(tracing(), readerOf(world()));
    const standing = world({ measurements: [stored(first)] });
    const thicker: Recipe = { ...RECIPE, readings: [{ ...RECIPE.readings[0], valueAsWritten: "100" } as Recipe["readings"][number]] };
    const edit = await deriveMeasurement(tracing({ recipe: thicker, replaces: first.measurement.objectKey }), readerOf(standing));
    expect(edit.measurement.objectKey).not.toBe(first.measurement.objectKey);
    expect([edit.measurement.supersedes, edit.measurement.replaces]).toEqual([first.measurement.objectKey, first.measurement.objectKey]);
    expect(edit.predecessor?.objectKey).toBe(first.measurement.objectKey);
  });

  test(`an edit that changes nothing is ${REFUSALS.ACT_CHANGES_NOTHING.code}`, async () => {
    const first = await deriveMeasurement(tracing(), readerOf(world()));
    expect(await refusedWith(deriveMeasurement(tracing({ replaces: first.measurement.objectKey }), readerOf(world({ measurements: [stored(first)] }))))).toBe(REFUSALS.ACT_CHANGES_NOTHING.code);
  });

  test("delete then re-trace works: the trace succeeds its own struck key, and again after a second delete", async () => {
    const first = await deriveMeasurement(tracing(), readerOf(world()));
    const deleted = world({ measurements: [stored(first)], repudiated: new Set([first.measurement.objectKey]) });
    const retrace = await deriveMeasurement(tracing(), readerOf(deleted));
    expect(retrace.measurement.supersedes, "it succeeds the key it re-derives, which stands struck").toBe(first.measurement.objectKey);
    expect(retrace.measurement.replaces, "and strikes nothing: what it succeeds is already struck").toBeNull();
    const twice = world({ measurements: [stored(first), stored(retrace)], repudiated: new Set([first.measurement.objectKey, retrace.measurement.objectKey]) });
    const third = await deriveMeasurement(tracing(), readerOf(twice));
    expect(third.measurement.supersedes).toBe(retrace.measurement.objectKey);
    expect(new Set([first, retrace, third].map((d) => d.measurement.objectKey)).size, "three keys, one per act").toBe(3);
  });
});
