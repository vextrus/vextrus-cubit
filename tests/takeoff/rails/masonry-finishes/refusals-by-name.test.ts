/**
 * AC-4 — every code of the masonry refusal shard, registered and DRIVEN by name (Q-07, L-MEA-02,
 * L-MEA-03, L-QTY-02, L-QTY-04, AM-11).
 *
 * A registered code that nothing can reach is a code nobody will ever read: each of the nine is
 * driven out of the rail door by a hand-built input leaving exactly the reading the code is about
 * unstated, and the two sighting codes with them. Nothing is reached for but what the spec's
 * interfaces name — the rails are pure functions of what they are handed (L-MEA-08), so every case
 * here is one call and one answer.
 *
 * The codes are read off `offer.omitted[].code` and `observation.code`, never off a message: a
 * reason code is a closed enum and never prose (L-QTY-04).
 */
import { describe, expect, test } from "vitest";
import {
  BRICK_WALL,
  FINISH_GROSS_UNSTATED,
  FINISH_PAINT,
  FINISH_PLASTER,
  FINISH_SELECTOR_UNSTATED,
  INLINE,
  MASONRY_BRICKWORK,
  MASONRY_ERRORS_MODULE,
  MASONRY_RAIL_CODES_OWED,
  MASONRY_SHARD_CODES,
  MEMBER_TYPE_UNKNOWN,
  OPENING_FLOOR_UNJUDGEABLE,
  OPENING_NOT_AREABLE,
  OPENING_SCHEDULE_ABSENT,
  PARTITION_PLACEMENT,
  SURFACE,
  SURFACE_NOT_CLOSED,
  SURFACE_PLACEMENT,
  VIEW_SCALE_UNAFFIRMED,
  WALL_OMISSION,
  WARNING,
  masonryRailDoor,
  opening,
  partitionScenario,
  productModule,
  refusalRegister,
  reading,
  seedEdition,
  surfaceScenario,
  type EditionSetupShape,
  type OpeningSetupShape,
  type RailBatchShape,
  type RailInputShape,
  type RailShape,
  type SurfaceSetupShape,
  type WallSetupShape,
} from "./support/masonry-contract";

/** The three kinds, each with the class it is borne by and the rail that measures it. */
const RAILS: readonly { kind: string; class: string; rail: "brickworkRail" | "plasterRail" | "paintRail" }[] = [
  { kind: MASONRY_BRICKWORK, class: BRICK_WALL, rail: "brickworkRail" },
  { kind: FINISH_PLASTER, class: SURFACE, rail: "plasterRail" },
  { kind: FINISH_PAINT, class: SURFACE, rail: "paintRail" },
];

/** The two finish rails, which read the same surface and must say the same thing about it. */
const FINISH_RAILS = RAILS.filter((one) => one.class === SURFACE);

/** One case's answer, with the codes it reported pulled out for the message. */
function codesOf(batch: RailBatchShape): string[] {
  return batch.observations.map((observation) => observation.code);
}

/** The one observation of a batch carrying this code, asserted to be there and to be one. */
function observed(batch: RailBatchShape, code: string, what: string): { code: string; objectKey?: string; sourceEntity?: string; detail?: Record<string, unknown> } {
  const held = batch.observations.filter((observation) => observation.code === code);
  expect(held.length, `${what} — the rail reported ${JSON.stringify(codesOf(batch))}`).toBe(1);
  return held[0] as { code: string; objectKey?: string; sourceEntity?: string; detail?: Record<string, unknown> };
}

/** The wall of the partition scenario, with one reading of it changed. */
function walledInput(edition: EditionSetupShape, change: (held: WallSetupShape) => WallSetupShape): RailInputShape {
  const scenario = partitionScenario(edition);
  const input = scenario.input;
  const held = input.setup.walls[PARTITION_PLACEMENT] as WallSetupShape;
  return { ...input, setup: { ...input.setup, walls: { [PARTITION_PLACEMENT]: change(held) } } };
}

/** The surface of the surface scenario, with one reading of it changed. */
function surfacedInput(edition: EditionSetupShape, kind: string, change: (held: SurfaceSetupShape) => SurfaceSetupShape): RailInputShape {
  const scenario = surfaceScenario(edition, kind);
  const input = scenario.input;
  const held = input.setup.surfaces[SURFACE_PLACEMENT] as SurfaceSetupShape;
  return { ...input, setup: { ...input.setup, surfaces: { [SURFACE_PLACEMENT]: change(held) } } };
}

describe("AC-4: every code of the masonry shard is registered and exercised by name", () => {
  test("AC-4: MASONRY_REFUSALS registers exactly the nine, and the closed taxonomy holds every one", async () => {
    const area = await productModule<{ MASONRY_REFUSALS: Record<string, { code: string; message: string; remedy: string; severity: string; surface: string }> }>(
      MASONRY_ERRORS_MODULE,
    );
    const register = await refusalRegister();

    expect(Object.keys(area.MASONRY_REFUSALS).sort(), `${MASONRY_ERRORS_MODULE} registers exactly this area's nine codes and no others (AM-11, Q-07)`).toEqual([...MASONRY_SHARD_CODES].sort());
    for (const code of MASONRY_SHARD_CODES) {
      const entry = area.MASONRY_REFUSALS[code];
      expect(entry?.code, `\`${code}\` restates its own key — a seam answering it reads the code out of the register (Q-07)`).toBe(code);
      expect((entry?.message ?? "").length, `\`${code}\` says what was refused, in words`).toBeGreaterThan(0);
      expect((entry?.remedy ?? "").length, `\`${code}\` says what to do about it — a refusal teaches the next action (R-UI-050)`).toBeGreaterThan(0);
      expect(
        { severity: entry?.severity, surface: entry?.surface },
        `\`${code}\` is refused in stride and rendered inline — a reading nobody stated is expected and recoverable, not an error state (AC-4)`,
      ).toEqual({ severity: WARNING, surface: INLINE });
      expect(register[code], `\`${code}\` stands in the one closed register the whole tree reads (Q-07)`).toBeTruthy();
    }
  });

  test("AC-4: MASONRY_RAIL_CODES is exactly this shard's nine plus the two sighting codes", async () => {
    const door = await masonryRailDoor();
    expect(
      [...door.MASONRY_RAIL_CODES].sort(),
      "the rail door's roster names every code its rails can report and nothing else — a roster naming a code no rail reports claims a refusal the tree cannot make (AM-11)",
    ).toEqual([...MASONRY_RAIL_CODES_OWED].sort());
  });

  test("AC-4: a wall or surface the setup does not hold, and one whose openings are null, defer OPENING_SCHEDULE_ABSENT", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();

    // The seam empty, exactly as the measure job leaves it until the S-25 reader lands (scope).
    for (const { kind, rail } of RAILS) {
      const scenario = kind === MASONRY_BRICKWORK ? partitionScenario(edition) : surfaceScenario(edition, kind);
      const input: RailInputShape = { ...scenario.input, setup: { ...scenario.input.setup, walls: {}, surfaces: {} } };
      const batch = (door[rail] as RailShape)(input);
      expect(batch.offers, `${kind}: a face with no schedule behind it is NOT MEASURED — gross area would over-measure (L-MEA-02)`).toEqual([]);
      const said = observed(batch, OPENING_SCHEDULE_ABSENT, `${kind} defers by name rather than in silence`);
      expect(said.sourceEntity, "citing the placement the schedule was looked for at (AC-4)").toBe(scenario.placementKey);
    }

    // The entry there, its schedule not: the same fact, said the same way.
    const nulled = walledInput(edition, (held) => ({ ...held, openings: null }));
    const batch = (door.brickworkRail as RailShape)(nulled);
    expect(batch.offers, "a wall whose `openings` is null is a wall nothing scheduled — and is not measured (L-MEA-02)").toEqual([]);
    expect(codesOf(batch), "and says so by name").toContain(OPENING_SCHEDULE_ABSENT);
  });

  test("AC-4: an opening seen but not areable defers OPENING_NOT_AREABLE, citing the row it was read at", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    const unreadable: OpeningSetupShape = opening({ mark: "oX", area: null, count: "1", floors: null, source: "sched#oX" });

    const wallBatch = (door.brickworkRail as RailShape)(walledInput(edition, (held) => ({ ...held, openings: [...(held.openings ?? []), unreadable] })));
    expect(wallBatch.offers, "an opening seen but not areable is FLAGGED, and the wall it stands in is not measured over it (L-MEA-03)").toEqual([]);
    expect(observed(wallBatch, OPENING_NOT_AREABLE, "the wall flags the unreadable opening by name").sourceEntity, "citing the schedule row it was read at").toBe("sched#oX");

    const surfaceBatch = (door.plasterRail as RailShape)(
      surfacedInput(edition, FINISH_PLASTER, (held) => ({ ...held, openings: [...(held.openings ?? []), unreadable] })),
    );
    expect(surfaceBatch.offers, "and a surface says the same thing about the same row").toEqual([]);
    expect(observed(surfaceBatch, OPENING_NOT_AREABLE, "the surface flags it too").sourceEntity, "citing the same row").toBe("sched#oX");
  });

  test("AC-4: a schedule row claiming a floor the stack cannot place defers OPENING_FLOOR_UNJUDGEABLE", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    const unplaceable: OpeningSetupShape = opening({
      mark: "oZ",
      area: reading("900000", "mm2", { source: "sched#oZ" }),
      count: "1",
      floors: { from: "1F", to: "MEZZANINE" },
      source: "sched#oZ",
    });
    const batch = (door.brickworkRail as RailShape)(walledInput(edition, (held) => ({ ...held, openings: [...(held.openings ?? []), unplaceable] })));
    expect(
      batch.offers,
      "a band naming an endpoint no live level carries is a statement nothing can judge — the wall is not measured over it rather than measured as if the row said nothing (L-MEA-02, L-CAD-07)",
    ).toEqual([]);
    expect(observed(batch, OPENING_FLOOR_UNJUDGEABLE, "and it is deferred by name").sourceEntity, "citing the row that claimed the floors").toBe("sched#oZ");
  });

  test("AC-4: a surface that is not a closed outline defers SURFACE_NOT_CLOSED from both finish rails, and is never bounding-boxed", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    for (const { kind, rail } of FINISH_RAILS) {
      const batch = (door[rail] as RailShape)(surfacedInput(edition, kind, (held) => ({ ...held, closed: false })));
      expect(batch.offers, `${kind}: a surface that is not a closed outline defers — never bounding-boxed (L-MEA-03)`).toEqual([]);
      expect(observed(batch, SURFACE_NOT_CLOSED, `${kind} defers by name`).sourceEntity, "citing the placement it was read at").toBe(SURFACE_PLACEMENT);
    }
  });

  test("AC-4: a wall with a schedule but an unstated L, h or t keeps its row and declares what it left out", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    const fields: readonly { field: "length" | "height" | "thickness"; variable: string }[] = [
      { field: "length", variable: "L" },
      { field: "height", variable: "h" },
      { field: "thickness", variable: "t" },
    ];
    for (const { field, variable } of fields) {
      const batch = (door.brickworkRail as RailShape)(walledInput(edition, (held) => ({ ...held, [field]: null })));
      expect(batch.offers.length, `an unread ${field} is never a zero: the row is KEPT and the omission declared (L-QTY-02)`).toBe(1);
      const offer = batch.offers[0];
      expect(offer?.coverage, `and the coverage says so — PARTIAL_UNDECLARED is unrepresentable (L-QTY-02)`).toBe("PARTIAL_DECLARED");
      expect(
        [...(offer?.omitted ?? [])],
        `the row names exactly \`${variable}\`, under the code that says which reading a person has to go and read (AC-4)`,
      ).toEqual([{ variable, code: WALL_OMISSION[variable] }]);
      expect(Object.keys(offer?.bindings ?? {}), `and binds nothing for it — a row cannot both carry a component and enumerate it as left out`).not.toContain(variable);
    }
  });

  test("AC-4: a closed surface whose gross nobody read keeps its row and omits `gross` by name", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    for (const { kind, rail } of FINISH_RAILS) {
      const batch = (door[rail] as RailShape)(surfacedInput(edition, kind, (held) => ({ ...held, gross: null })));
      expect(batch.offers.length, `${kind}: the row is kept with no quantity, never dropped (L-QTY-02)`).toBe(1);
      expect([...(batch.offers[0]?.omitted ?? [])], `${kind} names exactly \`gross\`, under FINISH_GROSS_UNSTATED (AC-4)`).toEqual([{ variable: "gross", code: FINISH_GROSS_UNSTATED }]);
      expect(batch.offers[0]?.coverage, "and declares the partiality").toBe("PARTIAL_DECLARED");
    }
  });

  test("AC-4: a plaster surface missing a SELECTING fact still offers, unpriced, beside FINISH_SELECTOR_UNSTATED naming it", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    for (const selector of ["thickness", "mix"] as const) {
      const batch = (door.plasterRail as RailShape)(surfacedInput(edition, FINISH_PLASTER, (held) => ({ ...held, [selector]: null })));
      expect(
        batch.offers.length,
        `a selecting attribute is the right number at the wrong rate, never a wrong number: the quantity still stands and the ITEM is the one that cannot be priced (L-QTY-01, L-QTY-03)`,
      ).toBe(1);
      const offer = batch.offers[0];
      expect(Object.keys(offer?.selectors ?? {}), `the unread \`${selector}\` leaves its key absent — never a default (L-MEA-06: defaults are barred)`).not.toContain(selector);
      const said = observed(batch, FINISH_SELECTOR_UNSTATED, `the rail says which selecting fact was unstated`);
      expect(said.detail?.["selector"], "naming the selector in its detail (AC-4)").toBe(selector);
    }
  });

  test("AC-4: an unaffirmed view and a placement the setup does not hold are sighting observations, from all three rails", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    for (const { kind, rail } of RAILS) {
      const scenario = kind === MASONRY_BRICKWORK ? partitionScenario(edition) : surfaceScenario(edition, kind);

      const unaffirmed: RailInputShape = { ...scenario.input, setup: { ...scenario.input.setup, calibrations: {} } };
      const first = (door[rail] as RailShape)(unaffirmed);
      expect(
        first.offers,
        `${kind}: a line always carries a non-empty set of affirmed calibration references, so a view nobody affirmed measures nothing (L-QTY-03, L-QTY-04)`,
      ).toEqual([]);
      observed(first, VIEW_SCALE_UNAFFIRMED, `${kind} reports the unaffirmed view by name`);

      const unplaced: RailInputShape = { ...scenario.input, setup: { ...scenario.input.setup, placements: {} } };
      const second = (door[rail] as RailShape)(unplaced);
      expect(second.offers, `${kind}: a register row the setup places nowhere is read off nothing`).toEqual([]);
      observed(second, MEMBER_TYPE_UNKNOWN, `${kind} reports the unplaced row by name`);
    }
  });
});
