// @vitest-environment node
/**
 * The companion roster for the registry this area appends: `SLAB_WALL_STAIR_RAIL_CODES` (AM-11, Q-07).
 *
 * A rail-local roster is a closed list, so it is frozen here by name rather than derived: a
 * derivation cannot catch a code the roster dropped, and a code the roster gained without a case
 * behind it is exactly the claim Q-07 forbids — "a registered code that nothing can reach is a code
 * nobody will ever read". What the roster CLAIMS is judged first (each code is registered, whole, in
 * the one closed taxonomy the tree reads), and that each is REACHED is judged after it: every code
 * of the roster is driven here, over an input engineered so that the branch behind that code is the
 * one the rail takes, against the very row and entity the reader is sent to.
 *
 * Pure: a code is data, the register is data, and a rail "is a pure function returning
 * `{ offers, observations }`" (L-MEA-08). Nothing here reaches a store or a clock.
 */
import { describe, expect, test } from "vitest";
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import { REFUSALS } from "@/core/errors";
import { SLABS_REFUSALS } from "@/core/errors/slabs";
import type {
  JunctionReading,
  LevelSetup,
  MemberVariantSetup,
  PlacementSetup,
  PlanReadingSetup,
  Rail,
  RailBatch,
  RailSetup,
  ReadingSetup,
  RegisterObjectRow,
} from "@/core/offers/contract";
import { SLAB_WALL_STAIR_RAIL_CODES, SLAB_WALL_STAIR_RULE_IDS, type SlabWallStairRailCode, slabWallStairConcreteRail, slabWallStairFormworkRail } from "./index";

describe("AM-11: the slab, shear-wall and stair rails' code roster", () => {
  test("the roster is this shard's five and the two it borrows, in the order it reports them", () => {
    expect(
      [...SLAB_WALL_STAIR_RAIL_CODES],
      "the roster names every code one of these rails reports and no other — a code a rail reports and the roster omits is a refusal nobody can enumerate, and one the roster names and no rail reports is a refusal the tree cannot make (AM-11, Q-07)",
    ).toEqual(["JUNCTION_DEFERRED", "JUNCTION_UNBOUNDED", "COMPLEX_STAIR_GEOMETRY", "PLAN_READING_ABSENT", "OUTLINE_NOT_CLOSED", "SECTION_BAND_UNCOVERED", "VIEW_SCALE_UNAFFIRMED"]);
  });

  test("every code of the roster is registered whole, and this area's own five are registered here", () => {
    for (const code of SLAB_WALL_STAIR_RAIL_CODES) {
      const entry = REFUSALS[code];
      expect(entry, `\`${code}\` stands in the one closed register the whole tree reads — a rail's roster never mints a code of its own (Q-07)`).toBeTruthy();
      expect((entry?.message ?? "").length, `\`${code}\` says what was refused, in words`).toBeGreaterThan(0);
      expect((entry?.remedy ?? "").length, `\`${code}\` says what to do about it — a refusal teaches the next action (R-UI-050)`).toBeGreaterThan(0);
    }

    // `VIEW_SCALE_UNAFFIRMED` and `SECTION_BAND_UNCOVERED` are the register's from before this area:
    // a code has one home, and this shard's own five are the ones written in its own area file (AM-11).
    expect(
      Object.keys(SLABS_REFUSALS).sort(),
      "the slabs area registers exactly the codes its own rails are the first to need — a plan nobody read, an outline that does not close, a stair no rule of AM-06 §3 measures, and the two readings of a junction",
    ).toEqual(["JUNCTION_DEFERRED", "JUNCTION_UNBOUNDED", "COMPLEX_STAIR_GEOMETRY", "PLAN_READING_ABSENT", "OUTLINE_NOT_CLOSED"].sort());

    // L-QTY-04 is the whole severity table: a bound is deducted at and disclosed in stride, and a
    // junction nothing bounds blocks, because an over-measured figure is never a disclosure.
    for (const entry of Object.values(SLABS_REFUSALS)) {
      expect({ severity: entry.severity, surface: entry.surface }, `\`${entry.code}\` is refused in stride and rendered inline`).toEqual({
        severity: entry.code === "JUNCTION_UNBOUNDED" ? "error" : "warning",
        surface: "inline",
      });
    }
  });
});

/** The campaign, revision and sighting every drive below is made over — no figure is judged here. */
const CAMPAIGN = "00000000-0000-4000-8000-000000000001";
const REVISION = "00000000-0000-4000-8000-000000000002";
const TENANT = "00000000-0000-4000-8000-000000000003";
const PROJECT = "00000000-0000-4000-8000-000000000004";
const GROUND = "00000000-0000-4000-8000-000000000010";
const FIRST = "00000000-0000-4000-8000-000000000011";
const SECOND = "00000000-0000-4000-8000-000000000012";

const DRAWING = "dwg-1";
const INGEST = "ingest-1";
const VIEW = "view-1";
const ENTITY = "entity-1";
const FAMILY = "SW1";
const PLACEMENT = "placement-1";
const SCALE = "calibration-1";

/** One reading, as the plan reader states it: what was read, in the unit it was written in (L-REG-01). */
function reading(value: string, unit: string): ReadingSetup {
  return { value, unit, basis: "MEASURED", source: ENTITY };
}

/** A junction the reader could state a figure for, resolved outright or only bounded (L-QTY-04). */
function held(value: string, standing: "RESOLVED" | "BOUNDED"): JunctionReading {
  return { reading: reading(value, "m2"), standing };
}

/** A junction nothing bounds at all: there is no bound to deduct at (L-QTY-04). */
const UNBOUNDED: JunctionReading = { reading: null, standing: "UNBOUNDED" };

function level(levelId: string, label: string, ordinal: number): LevelSetup {
  return { levelId, label, ordinal, height: { standing: "AGREED", value: "3", unit: "m", basis: "ENTERED", sourceKey: ENTITY } };
}

/** One member-type variant of the family, as a schedule bands it (L-FRM-02). */
function variant(variantKey: string, bandFrom: string | null, bandTo: string | null, sectionWidth: number | null): MemberVariantSetup {
  return {
    variantKey,
    bandFrom,
    bandTo,
    sectionText: sectionWidth === null ? "" : `${sectionWidth} thk`,
    sectionWidth,
    sectionDepth: null,
    sectionUnit: sectionWidth === null ? null : "mm",
    sourceKeys: [`schedule/${variantKey}`],
    dimensions: {},
    rebar: [],
  };
}

const PLACED: PlacementSetup = { drawingId: DRAWING, ingestId: INGEST, viewKey: VIEW, memberFamily: FAMILY, engine: "VECTOR", sourceEntity: ENTITY, outline: null };

/** The setup a drive starts from: one placement, its affirmed scale, a three-level stack, no plan. */
function setupOf(over: Partial<RailSetup> = {}): RailSetup {
  return {
    placements: { [PLACEMENT]: PLACED },
    memberTypes: {},
    levels: [level(GROUND, "GF", 0), level(FIRST, "1F", 1), level(SECOND, "2F", 2)],
    calibrations: { [INGEST]: { [VIEW]: SCALE } },
    grades: {},
    plans: {},
    runs: {},
    lintels: {},
    walls: {},
    surfaces: {},
    siteFacts: {},
    edition: { digest: "edition", parameters: {} },
    detailing: { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: [], sourceKeys: [] },
    ...over,
  };
}

/** One register row of one of the three classes these rails measure, standing on the first floor. */
function objectRow(elementType: ElementType, over: Partial<RegisterObjectRow> = {}): RegisterObjectRow {
  return {
    tenantId: TENANT,
    projectId: PROJECT,
    setRevisionId: REVISION,
    objectKey: `${elementType}/M1@1F`,
    discipline: "STRUCTURAL",
    elementType,
    mark: "M1",
    viewKey: VIEW,
    placementKey: PLACEMENT,
    levelId: FIRST,
    levelSlot: null,
    levelLabel: null,
    standing: "MEASURED",
    semantic: `${elementType}/M1`,
    registeredAt: new Date(0),
    ...over,
  };
}

function panel(over: Partial<Extract<PlanReadingSetup, { member: "SLAB_PANEL" }>> = {}): PlanReadingSetup {
  return {
    member: "SLAB_PANEL",
    outline: "CLOSED",
    bearing: "FRAMED",
    area: reading("120", "m2"),
    members: held("3.5", "RESOLVED"),
    beamSoffit: held("20", "RESOLVED"),
    freeEdge: reading("12", "m"),
    thickness: reading("150", "mm"),
    thickness2: null,
    openings: [],
    ...over,
  };
}

function flight(shape: "STRAIGHT" | "COMPLEX"): PlanReadingSetup {
  return {
    member: "STAIR_FLIGHT",
    shape,
    sloped: reading("2.8", "m"),
    width: reading("1.2", "m"),
    waist: reading("150", "mm"),
    going: reading("250", "mm"),
    rise: reading("1.68", "m"),
    risers: reading("10", "nr"),
  };
}

function landing(shape: "RECT" | "COMPLEX"): PlanReadingSetup {
  return { member: "STAIR_LANDING", shape, area: reading("2.4", "m2"), thickness: reading("150", "mm") };
}

const WALL: PlanReadingSetup = { member: "WALL_RUN", length: reading("6", "m"), thickness: reading("200", "mm"), contact: reading("0", "m2"), ends: reading("0", "m2") };

function drive(rail: Rail, kind: Kind, rows: readonly RegisterObjectRow[], setup: RailSetup): RailBatch {
  return rail({ campaignId: CAMPAIGN, setRevisionId: REVISION, kind, objects: rows, setup });
}

const concreteOver = (rows: readonly RegisterObjectRow[], setup: RailSetup): RailBatch => drive(slabWallStairConcreteRail, "rcc.concrete", rows, setup);
const formworkOver = (rows: readonly RegisterObjectRow[], setup: RailSetup): RailBatch => drive(slabWallStairFormworkRail, "rcc.formwork", rows, setup);

/** The codes one batch reported, in the order it reported them. */
function codesOf(batch: RailBatch): readonly string[] {
  return batch.observations.map((observation) => observation.code);
}

/**
 * One drive per code of the roster: an input engineered so the branch behind that code is the branch
 * taken. Keyed BY the code, so a code the roster gains with no case behind it does not compile —
 * "a registered code that nothing can reach is a code nobody will ever read" (Q-07).
 */
const DRIVES: Readonly<Record<SlabWallStairRailCode, () => RailBatch>> = {
  // Nothing was sighted at this row's placement key: there is no drawing, no view and no engine to
  // offer it under, so the row reaches the residue as evidence — even with a plate read beside it.
  PLAN_READING_ABSENT: () => concreteOver([objectRow("slab")], setupOf({ placements: {}, plans: { [PLACEMENT]: panel() } })),
  // A line always carries "a non-empty set of affirmed calibration references" (L-QTY-03).
  VIEW_SCALE_UNAFFIRMED: () => concreteOver([objectRow("slab")], setupOf({ calibrations: {}, plans: { [PLACEMENT]: panel() } })),
  // L-MEA-03: a surface that is not a closed outline defers with a reason, never bounding-boxed.
  OUTLINE_NOT_CLOSED: () => concreteOver([objectRow("slab")], setupOf({ plans: { [PLACEMENT]: panel({ outline: "OPEN" }) } })),
  // Over-measurement is a hard block, never a disclosure: there is no bound to deduct the columns at.
  JUNCTION_UNBOUNDED: () => concreteOver([objectRow("slab")], setupOf({ plans: { [PLACEMENT]: panel({ members: UNBOUNDED }) } })),
  // Deducted at the bound the reading could state: the published figure is then UNDER (L-QTY-04).
  JUNCTION_DEFERRED: () => concreteOver([objectRow("slab")], setupOf({ plans: { [PLACEMENT]: panel({ members: held("3.5", "BOUNDED") }) } })),
  // AM-06 §3 measures a straight flight and a rectangular landing; anything else is left to a person.
  COMPLEX_STAIR_GEOMETRY: () => concreteOver([objectRow("stair")], setupOf({ plans: { [PLACEMENT]: flight("COMPLEX") } })),
  // L-FRM-02: a banded vertical prices each band's own section, and a level no band covers defers.
  SECTION_BAND_UNCOVERED: () =>
    concreteOver(
      [objectRow("shear_wall", { levelId: GROUND, objectKey: "shear_wall/M1@GF" })],
      setupOf({ plans: { [PLACEMENT]: WALL }, memberTypes: { [INGEST]: { [FAMILY]: [variant("SW1-upper", "1F", "2F", 200)] } } }),
    ),
};

describe("Q-07: every code the roster names is one these rails actually reach", () => {
  test.each([...SLAB_WALL_STAIR_RAIL_CODES])("%s is what the rail reports over the input engineered to earn it", (code) => {
    const batch = DRIVES[code]();
    expect(
      codesOf(batch),
      `the branch behind \`${code}\` reports that code and no other — a rail that reported a different one would send the reader to the wrong thing to fix (L-MEA-08, Q-07)`,
    ).toEqual([code]);
  });

  test("a row the rail could not read publishes nothing, and a row read at a bound publishes and discloses", () => {
    for (const code of SLAB_WALL_STAIR_RAIL_CODES.filter((one) => one !== "JUNCTION_DEFERRED")) {
      expect(
        DRIVES[code]().offers,
        `\`${code}\` is a row the rail did not offer: an offer beside it would publish a figure the rail has just said it could not read (L-MEA-08, L-QTY-04)`,
      ).toEqual([]);
    }
    const deferred = DRIVES.JUNCTION_DEFERRED();
    expect(
      deferred.offers.length,
      "a junction the reading could only BOUND is deducted at its bound and the row publishes: the figure is then UNDER, which L-QTY-04 admits as a disclosure",
    ).toBe(1);
  });

  test("each report names the one thing the reader has to go and look at", () => {
    expect(
      DRIVES.PLAN_READING_ABSENT().observations[0]?.sourceEntity,
      "a row whose placement the setup does not hold is reported against the placement key — there is no entity to name, because nothing was sighted (L-MEA-08)",
    ).toBe(PLACEMENT);
    expect(DRIVES.VIEW_SCALE_UNAFFIRMED().observations[0]?.sourceEntity, "a view nobody affirmed a scale for is reported against THE VIEW — what a reader has to go and affirm (L-QTY-03)").toBe(VIEW);
    expect(DRIVES.OUTLINE_NOT_CLOSED().observations[0]?.sourceEntity, "a plan the rail could not measure from sends the reader to the entity it was read from (L-MEA-03)").toBe(ENTITY);
    expect(DRIVES.OUTLINE_NOT_CLOSED().observations[0]?.objectKey, "and to the register row it was made about (L-MEA-08)").toBe("slab/M1@1F");
  });

  test("the questions are asked in the order a reader would ask them", () => {
    expect(
      codesOf(concreteOver([objectRow("slab")], setupOf({ placements: {}, calibrations: {} }))),
      "there is no point asking what scale a view stands at when nothing was sighted in it at all (L-MEA-08)",
    ).toEqual(["PLAN_READING_ABSENT"]);
    expect(
      codesOf(concreteOver([objectRow("slab")], setupOf({ calibrations: { [INGEST]: { [VIEW]: "" } } }))),
      "a scale affirmed as nothing is no affirmed scale, and it is asked before the plan the row would be measured from (L-QTY-03)",
    ).toEqual(["VIEW_SCALE_UNAFFIRMED"]);
    expect(
      codesOf(concreteOver([objectRow("slab")], setupOf())),
      "a placement nobody read a plate, drop, flight, landing or wall run of is reported once its view stands affirmed (L-QTY-01)",
    ).toEqual(["PLAN_READING_ABSENT"]);
  });

  test("a stair is judged by the shape the reader stated, for both kinds and for both its members", () => {
    for (const plan of [flight("COMPLEX"), landing("COMPLEX")]) {
      const rows = [objectRow("stair")];
      const setup = setupOf({ plans: { [PLACEMENT]: plan } });
      expect(codesOf(concreteOver(rows, setup)), "a helical, spiral, fan-tread or curved-landing stair defers rather than being measured as the nearest shape the machine knows (AM-06 §3)").toEqual(["COMPLEX_STAIR_GEOMETRY"]);
      expect(codesOf(formworkOver(rows, setup)), "and the formwork of the same stair is deferred with it — a shuttering figure for a shape nobody measured is the same over-measurement (AM-06 §3)").toEqual([
        "COMPLEX_STAIR_GEOMETRY",
      ]);
      expect(formworkOver(rows, setup).offers, "neither kind publishes a line for it").toEqual([]);
    }
  });

  test("a plate's formwork asks BOTH its junctions, and a slab on grade asks neither", () => {
    const rows = [objectRow("slab")];
    expect(
      codesOf(formworkOver(rows, setupOf({ plans: { [PLACEMENT]: panel({ beamSoffit: UNBOUNDED }) } }))),
      "the beam soffits the plate stands over are a junction of their own — the beam owns that face (L-MEA-09)",
    ).toEqual(["JUNCTION_UNBOUNDED"]);
    expect(
      codesOf(formworkOver(rows, setupOf({ plans: { [PLACEMENT]: panel({ members: held("3.5", "BOUNDED"), beamSoffit: held("20", "BOUNDED") }) } }))),
      "two junctions taken at their bounds are one line under one disclosure, not the same disclosure twice (L-QTY-04)",
    ).toEqual(["JUNCTION_DEFERRED"]);

    const onGround = formworkOver(rows, setupOf({ plans: { [PLACEMENT]: panel({ bearing: "GROUND", members: UNBOUNDED, beamSoffit: UNBOUNDED }) } }));
    expect(codesOf(onGround), "the ground bears the soffit and nobody forms it, so no member junction enters the figure at all (L-FRM-03)").toEqual([]);
    expect(onGround.offers[0]?.ruleId, "a slab on grade forms its edges and nothing else").toBe(SLAB_WALL_STAIR_RULE_IDS.slabEdgeFormwork);
  });

  test("a wall is cast at the section of the band that covers its level, and at the plan's own where no schedule bands the family", () => {
    const rows = [objectRow("shear_wall")];
    const banded = setupOf({
      plans: { [PLACEMENT]: WALL },
      memberTypes: { [INGEST]: { [FAMILY]: [variant("SW1-lower", "GF", "1F", 250), variant("SW1-upper", "2F", null, 200)] } },
    });
    const offer = concreteOver(rows, banded).offers[0];
    expect(offer?.ruleId, "a shear wall's storey is one concrete line (L-MEA-09)").toBe(SLAB_WALL_STAIR_RULE_IDS.wallConcrete);
    expect(
      offer?.bindings["t"],
      "the band's own section, carried as the schedule wrote it and provenanced to the cell it was read from — a banded vertical prices each band's own section (L-FRM-02, L-QTY-03)",
    ).toEqual({ value: "250", unit: "mm", basis: "TRANSCRIBED", source: "schedule/SW1-lower" });

    expect(
      concreteOver(rows, setupOf({ plans: { [PLACEMENT]: WALL } })).offers[0]?.bindings["t"],
      "a family no schedule bands is cast at the thickness the plan itself states — a rail never guesses a section (L-QTY-01)",
    ).toEqual(reading("200", "mm"));

    expect(
      concreteOver(rows, setupOf({ plans: { [PLACEMENT]: WALL }, memberTypes: { [INGEST]: { [FAMILY]: [variant("SW1-only", null, null, null)] } } })).offers[0]?.bindings["t"],
      "a variant that states no section is no section a rail can carry into metres, so the plan's own reading stands — the weaker reading, never an invented one (L-QTY-01)",
    ).toEqual(reading("200", "mm"));
  });
});
