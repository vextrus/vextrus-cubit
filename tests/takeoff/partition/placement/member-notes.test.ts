/**
 * I-303 AND I-304, AT THE STAGE THAT READS THEM: a plan note that NAMES a mark is evidence about
 * that MEMBER, so the member it names is not one of the plan's typical — it stands on the level the
 * plan DRAWS, or over the range its own note STATES, and never over the view's authored range.
 *
 * The stage half of the rule, which is the half this file grades: the two phases the note pass runs
 * in (a note whose mark placed a row BINDS to it; a note whose mark placed nothing MINTS one), the
 * four fences the minting answers to, both halves of the singularity guard, and the expansion's own
 * answer — the lowest level a noted member stands on is MEASURED and everything above it DERIVED.
 * The reading of a TEXT is `src/modules/takeoff/partition/placement/law.test.ts`'s and is not
 * re-graded here; what is graded here is what the stage DOES with a text that reading answered for.
 *
 * PURE, and in the unit lane on purpose: two functions over one hand-built artifact, no database, no
 * store and no clock. The corpus this rule was written for is graded where the corpus lives — the
 * db-lane case in `./journey-partition.test.ts` names the outline F-RCC6-BNBC's own C5 note anchored
 * and holds the 26 members that stood without it numerically still. A drawing is not a test's input
 * (B-19): every geometry below is drawn HERE, to the bands this file states it drew to, so an
 * edition authored with other shares moves nothing about what these cases mean.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { GridAxisRow, DetectedGrid } from "@/modules/takeoff/partition/grid/detect";
import { detectPlacements } from "@/modules/takeoff/partition/placement/detect";
import type { FamilyNamed, PlacementEvidence, PlacementRow } from "@/modules/takeoff/partition/placement/rows";
import type { PlacementShares } from "@/modules/takeoff/partition/placement/shares";
import { resolveExpansion, type StackedLevel } from "@/modules/takeoff/partition/expansion/resolve";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";

/* ------------------------------------------------------------------ the drawing these cases draw */

/** The grid every plan below is drawn on, and therefore the distance every share scales by. */
const SPACING = 4000;

/** The bands this file draws to, as the shares an edition states them in (L-MEA-01, handed in). */
const SHARES: PlacementShares = { containmentMerge: "0.08", nearAnchor: "0.9", footprintMin: "0.6", footprintMax: "2.5" };

/** What those shares come to on this grid: a mark or a note reaches 3,600 drawing units. */
const REACH = Number(SHARES.nearAnchor) * SPACING;

/** The side every ordinary member of these plans is drawn at — so the footprint median is this. */
const SIDE = 400;

/** The view every entity below stands in, and the anchor its caption was read at. */
const CAPTION_KEY = "DXF_HANDLE:1";
const VIEW: PartitionedView = { viewKey: `${VIEW_TYPE.LAYOUT_PLAN}:${CAPTION_KEY}`, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "COLUMN LAYOUT PLAN", anchorKey: CAPTION_KEY };

/** L-REG-04's spelling of that same view, which is what a placement row keys itself by. */
const VIEW_KEY = `v:${VIEW_TYPE.LAYOUT_PLAN}:${CAPTION_KEY}`;

/** A colour every drawn record carries: the artifact's own shape, never a spelled colour (L-CAD-05). */
const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };

/**
 * The ONE layer everything below is drawn on — marks, notes, outlines and the caption alike.
 *
 * Deliberate, and the point of drawing it this way: L-CAD-07 reads a drawing by content signature
 * and never by layer names, and on F-RCC6-BNBC every note happens to stand on `S-TEXT2` while every
 * mark stands on `S-TEXT`. A rule that read the layer would pass that drawing and mean nothing on
 * the next one. Here there is no layer to read, so a reading that leant on one is red.
 */
const LAYER = "PLAN";

/** One piece of the drawing: a text where it stands, or a closed ring of a stated size. */
type Piece =
  | { readonly said: string; readonly at: readonly [number, number] }
  | { readonly ring: readonly [number, number]; readonly side?: number; readonly long?: number };

/** The four corners of a rectangle centred on a point. */
function corners(centre: readonly [number, number], width: number, height: number): [number, number][] {
  const [x, y] = centre;
  return [
    [x - width / 2, y - height / 2],
    [x + width / 2, y - height / 2],
    [x + width / 2, y + height / 2],
    [x - width / 2, y + height / 2],
  ];
}

/** One plan's entities, keyed in the order the drawing drew them (L-CAD-02). */
function entitiesOf(pieces: readonly Piece[]): EntityGraph["entities"] {
  return pieces.map((piece, index) => {
    const key = `DXF_HANDLE:${(index + 2).toString(16).toUpperCase()}`;
    if ("said" in piece) return { key, type: "TEXT", space: "Model", layer: LAYER, colour: COLOUR, text: piece.said, height: 200, points: [[piece.at[0], piece.at[1]]] as [number, number][] };
    const side = piece.side ?? SIDE;
    return { key, type: "LWPOLYLINE", space: "Model", layer: LAYER, colour: COLOUR, closed: true, points: corners(piece.ring, piece.long ?? side, side) };
  });
}

/** The backbone this plan is georeferenced by: one axis of each family, so a member has a reference. */
const AXES: readonly GridAxisRow[] = [
  { viewKey: VIEW.viewKey, family: "letter", label: "A", axis: "x", position: 0, bubbleKey: "DXF_HANDLE:F01", labelKey: "DXF_HANDLE:F02", minSpacing: SPACING },
  { viewKey: VIEW.viewKey, family: "numeral", label: "1", axis: "y", position: 0, bubbleKey: "DXF_HANDLE:F03", labelKey: "DXF_HANDLE:F04", minSpacing: SPACING },
];

const GRID: DetectedGrid = { views: 1, axes: AXES, deferrals: [] };

/** What one plan places, read by the shipped detector over the shipped stages' own shapes. */
function placedIn(pieces: readonly Piece[], families: readonly FamilyNamed[] = []): ReturnType<typeof detectPlacements> {
  const entities = entitiesOf(pieces);
  const graph: EntityGraph = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-test", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: "Model", kind: "model", bbox: null, strays_rejected: 0 }],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  };
  const evidence: PlacementEvidence = {
    graph,
    views: [VIEW],
    assignments: new Map(entities.map((entity) => [entity.key, VIEW.viewKey])),
    grid: GRID,
    shares: SHARES,
    families,
  };
  return detectPlacements(evidence);
}

/** The rows one reading placed, in the key's own order, so two readings compare as lists (L-REG-05). */
function rowsOf(pieces: readonly Piece[], families: readonly FamilyNamed[] = []): PlacementRow[] {
  return [...placedIn(pieces, families).placements].sort((left, right) => (left.placementKey < right.placementKey ? -1 : 1));
}

/** One row of a reading, by the mark it stands under — asserted singular rather than assumed. */
function oneRow(rows: readonly PlacementRow[], mark: string): PlacementRow {
  const found = rows.filter((row) => row.mark === mark);
  expect(found.length, `exactly one member stands under ${mark} (${rows.map((row) => row.mark).join(", ")})`).toBe(1);
  return found[0] as PlacementRow;
}

/* ------------------------------------------------------------------ the plans these cases draw */

/** Six ordinary members of one mark, in a row a bay apart: the plan's own population, median 400. */
const TYPICAL: readonly Piece[] = [0, 1, 2, 3, 4, 5].flatMap((index) => [
  { ring: [index * SPACING, 0] as const },
  { said: "C1", at: [index * SPACING, 0] as const },
]);

/** The porch member and its own mark, standing clear of the six: the note's binding case (C7). */
const PORCH: readonly Piece[] = [
  { ring: [0, -SPACING * 3] as const, side: 450 },
  { said: "C7", at: [0, -SPACING * 3] as const },
];

/** The ring no mark names, standing clear of everything: the note's minting case (C5). */
const UNCLAIMED: readonly Piece[] = [{ ring: [SPACING * 5, -SPACING * 3] as const, side: 450, long: 300 }];

/** Where a note about that unclaimed ring stands — well inside the reach, as S-10's own does. */
const NOTE_AT = [SPACING * 5 + 800, -SPACING * 3] as const;

/** The two sentences F-RCC6-BNBC writes, in the drawing's own spelling (`%%C` is what a DXF writes). */
const PORCH_NOTE = "C7 %%C450 PORCH COLUMN";
const FLOATING_NOTE = "C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)";

describe("I-303: a plan note that names a mark binds to the member that mark placed", () => {
  test("the noted member carries the note's own key, words and statements; nobody else carries one", () => {
    const drawn = [...TYPICAL, ...PORCH, { said: PORCH_NOTE, at: [900, -SPACING * 3] as const }] as const;
    const rows = rowsOf(drawn);
    const porch = oneRow(rows, "C7");

    expect(porch.note?.text, "the note's words are kept beside the reading (L-CAD-03)").toBe(PORCH_NOTE);
    expect(porch.note?.sourceKey, "and its own entity is the third atom the member was read from").toBe(entitiesOf(drawn).find((entity) => entity.text === PORCH_NOTE)?.key);
    expect(porch.note?.shape, "the PLAN states the shape (I-304): a diameter in the remainder is a round column").toBe("ROUND");
    expect(porch.note?.band, "and this note states no range at all, which is not a band with open ends").toBeNull();

    expect(porch.markKey, "binding changes nothing about how the member was placed: its own mark still anchors it").toBe(oneRow(rowsOf([...TYPICAL, ...PORCH]), "C7").markKey);
    expect(rows.filter((row) => row.note !== null).length, "and no member the note did not name carries one").toBe(1);
  });

  test("a note whose remainder states a RANGE carries the two ends the drawing wrote", () => {
    const rows = rowsOf([...TYPICAL, { ring: [0, -SPACING * 3] }, { said: "C5", at: [0, -SPACING * 3] }, { said: FLOATING_NOTE, at: [900, -SPACING * 3] }]);
    expect(oneRow(rows, "C5").note?.band, "`STARTS AT 1F` is 1F upwards, read by the grammar and by nothing spelled here").toEqual({ from: "1F", to: null });
  });

  test("adding the note to the drawing moves NOTHING about the members that stood without it", () => {
    const without = rowsOf([...TYPICAL, ...PORCH]);
    const with_ = rowsOf([...TYPICAL, ...PORCH, { said: PORCH_NOTE, at: [900, -SPACING * 3] as const }]);
    // The note pass runs over a population already closed, so the plan's footprint median and the
    // drawing's scale were read off the mark-anchored candidates alone (L-MEA-01, L-QTY-06).
    expect(with_.map((row) => ({ ...row, note: null })), "every key, point and grid reference is what it was").toEqual(without);
  });

  test("a note written beyond the plan's own reach OF THE MARK binds nothing", () => {
    // I-303's fifth statement. The reach is the one every other placement question on this plan is
    // already answered at, and a sentence naming a mark from the far side of the sheet is a sentence
    // about something else (L-MEA-01).
    const far = [...TYPICAL, ...PORCH, { said: PORCH_NOTE, at: [0, -SPACING * 3 - REACH - 1] as const }] as const;
    expect(oneRow(rowsOf(far), "C7").note, "out of reach is out of evidence").toBeNull();
    expect(placedIn(far).noted, "and no member of this plan is noted at all").toBe(0);
  });

  test("the census says how many members a plan's notes named and how many they placed", () => {
    const read = placedIn([...TYPICAL, ...PORCH, { said: PORCH_NOTE, at: [900, -SPACING * 3] }]);
    expect([read.noted, read.minted], "one member named, none placed by a note: its own mark placed it").toEqual([1, 0]);
    expect(placedIn([...TYPICAL, ...PORCH]), "a plan with no note names nothing and places nothing by one").toMatchObject({ noted: 0, minted: 0 });
  });
});

describe("I-303: a note whose mark placed nothing PLACES the member itself", () => {
  const drawn = [...TYPICAL, ...UNCLAIMED, { said: FLOATING_NOTE, at: NOTE_AT }] as const;

  test("the minted member stands on the ring no mark names, cited back to the ring and the sentence", () => {
    const rows = rowsOf(drawn);
    const floating = oneRow(rows, "C5");

    const ring = entitiesOf(drawn).find((entity) => entity.closed === true && entity.points?.[0]?.[0] === SPACING * 5 - 150);
    const note = entitiesOf(drawn).find((entity) => entity.text === FLOATING_NOTE);
    expect(floating.outlineKey, "the ring it stands on is the one the note reached").toBe(ring?.key);
    // L-CAD-03 asks that a placement be traceable to the two entities it was read from. The NOTE is
    // the naming entity here — the sheet tags only its ground-floor columns and this member has none
    // — so the note's key and its words are what `mark_key` and `mark_text` carry.
    expect(floating.markKey, "and the sentence that named it is the other").toBe(note?.key);
    expect(floating.markText, "which is what the drawing SPELLED, kept beside what the rule compares").toBe(FLOATING_NOTE);
    expect(floating.mark, "the mark is the note's own, normalised the way every other mark is").toBe("C5");
    expect(floating.elementType, "and the class is the one that mark names").toBe("column");
  });

  test("the minted member is keyed by the grammar and referenced off the plan's own backbone", () => {
    const floating = oneRow(rowsOf(drawn), "C5");
    expect(floating.viewKey, "L-REG-04's view key, derived and never spelled").toBe(VIEW_KEY);
    expect(floating.placementKey, "and L-REG-04's placement key: the view, the mark and the quantised point").toBe(`${VIEW_KEY}|C5|${floating.x.toFixed(1)},${floating.y.toFixed(1)}`);
    expect([floating.gridLetter, floating.gridNumeral], "a minted member carries a grid reference like any other").toEqual(["A", "1"]);
  });

  test("minting one moves nothing about the members that stood without it, and says so in the census", () => {
    const without = rowsOf(TYPICAL);
    const with_ = rowsOf(drawn).filter((row) => row.mark !== "C5");
    expect(with_, "the six the marks placed are the six the marks placed").toEqual(without);
    expect(placedIn(drawn), "one member named by a note, and that member placed by it").toMatchObject({ noted: 1, minted: 1 });
  });

  test("the ring is minted only where the note REACHES it", () => {
    const far = [...TYPICAL, ...UNCLAIMED, { said: FLOATING_NOTE, at: [SPACING * 5 + REACH + 1, -SPACING * 3] as const }] as const;
    expect(rowsOf(far).some((row) => row.mark === "C5"), "a sentence beyond the plan's own near-anchor reach names no ring").toBe(false);
    expect(placedIn(far).minted, "and nothing is minted").toBe(0);
  });

  test("the NEAREST free ring is the one the note names, and the others are left alone", () => {
    const two = [...TYPICAL, ...UNCLAIMED, { ring: [SPACING * 5 + 2000, -SPACING * 3] as const, side: 450, long: 300 }, { said: FLOATING_NOTE, at: NOTE_AT }] as const;
    const nearest = entitiesOf(two).find((entity) => entity.closed === true && entity.points?.[0]?.[0] === SPACING * 5 - 150);
    expect(oneRow(rowsOf(two), "C5").outlineKey, "800 away, not 1,200 away").toBe(nearest?.key);
  });

  test("a ring a mark already anchors is never minted, however near the note stands", () => {
    // The ring stands under the porch mark AND under a note about a mark that placed nothing. The
    // mark's claim is the older one, and counting the ring twice is the over-measurement L-REG-03
    // makes unrepresentable.
    const contested = [...TYPICAL, ...PORCH, { said: FLOATING_NOTE, at: [900, -SPACING * 3] as const }] as const;
    const rows = rowsOf(contested);
    expect(rows.some((row) => row.mark === "C5"), "the note reached a ring, and the ring was already somebody's member").toBe(false);
    expect(oneRow(rows, "C7").note, "and the porch member, which that note does not name, carries no note").toBeNull();
  });

  test("a ring outside the plan's own footprint band is not the member the note names", () => {
    const oversize = [...TYPICAL, { ring: [SPACING * 5, -SPACING * 3] as const, side: 450, long: SIDE * 3 }, { said: FLOATING_NOTE, at: NOTE_AT }] as const;
    // 1,200 against a median of 400 is three times the plan's own members; the band admits 2.5.
    expect(rowsOf(oversize).some((row) => row.mark === "C5"), "a stair well a sentence stands near is not a column (riskNotes (1))").toBe(false);
  });

  test("a ring outside the section its mark's SCHEDULE states is not the member the note names", () => {
    // The plan draws its members at the sizes the schedules give them, so the drawing's own scale is
    // 1 here; a schedule stating 150 for C5 puts the 450 ring at three times its stated section.
    const families: readonly FamilyNamed[] = [
      { family: "C1", variants: [{ sectionWidth: SIDE, sectionDepth: SIDE }] },
      { family: "C5", variants: [{ sectionWidth: 150, sectionDepth: 150 }] },
    ];
    expect(rowsOf([...TYPICAL, ...UNCLAIMED, { said: FLOATING_NOTE, at: NOTE_AT }], families).some((row) => row.mark === "C5"), "the registry says what a member IS (R-TO-031)").toBe(false);
  });

  test("a plan whose own candidates state no footprint at all mints nothing", () => {
    // Nothing here is mark-anchored, so the plan states no median, and a stranger's footprint has
    // nothing to be judged against: minting would be one sentence and no corroboration (L-QTY-04).
    expect(placedIn([...UNCLAIMED, { said: FLOATING_NOTE, at: NOTE_AT }]).minted, "no median, no mint").toBe(0);
  });
});

describe("I-303's singularity guard: an exception is taken only where the evidence singles one out", () => {
  test("TWO notes naming one mark except nothing, and the mark expands as it always did", () => {
    const twice = [...TYPICAL, ...PORCH, { said: PORCH_NOTE, at: [900, -SPACING * 3] as const }, { said: "C7 %%C500 SEE SECTION", at: [-900, -SPACING * 3] as const }] as const;
    const rows = rowsOf(twice);
    expect(oneRow(rows, "C7").note, "two statements about one mark are two statements, and this stage picks neither (L-QTY-01)").toBeNull();
    expect(placedIn(twice).noted, "so no member of this plan is noted at all").toBe(0);
  });

  test("a mark naming TWO members excepts neither: the note does not say which of them it is about", () => {
    const pair = [
      ...TYPICAL,
      { ring: [0, -SPACING * 3] as const, side: 450 },
      { said: "C7", at: [0, -SPACING * 3] as const },
      { ring: [SPACING, -SPACING * 3] as const, side: 450 },
      { said: "C7", at: [SPACING, -SPACING * 3] as const },
      { said: PORCH_NOTE, at: [900, -SPACING * 3] as const },
    ] as const;
    const rows = rowsOf(pair);
    expect(rows.filter((row) => row.mark === "C7").length, "the mark placed two members").toBe(2);
    expect(rows.filter((row) => row.note !== null), "and a note naming that mark narrows neither of them").toEqual([]);
  });

  test("a text that states neither a shape nor a bounded range is not read as a note at all", () => {
    const aside = [...TYPICAL, ...PORCH, { said: "C7 SEE DETAIL 3/S-12", at: [900, -SPACING * 3] as const }] as const;
    expect(oneRow(rowsOf(aside), "C7").note, "a cross-reference says nothing about where a member stands (L-QTY-01)").toBeNull();
    expect(placedIn(aside).minted, "and it places nothing either").toBe(0);
  });
});

/* ------------------------------------------------------------------ what the expansion does with it */

/** A live stack of seven storeys, handed in REVERSED so no case can read one off an index (AC-8). */
const STACK: readonly StackedLevel[] = [
  { levelId: "L6", label: "6F", ordinal: 6 },
  { levelId: "L5", label: "5F", ordinal: 5 },
  { levelId: "L4", label: "4F", ordinal: 4 },
  { levelId: "L3", label: "3F", ordinal: 3 },
  { levelId: "L2", label: "2F", ordinal: 2 },
  { levelId: "L1", label: "1F", ordinal: 1 },
  { levelId: "L0", label: "GF", ordinal: 0 },
];

/** The range a person authored for this plan: the whole stack, GF to 6F (L-ACT-01). */
const AUTHORED = [{ viewKey: VIEW_KEY, fromLevelId: "L0", toLevelId: "L6" }];

/** What one plan's members expand to over that stack, keyed by mark: the level labels and standings. */
function expandedBy(pieces: readonly Piece[], families: readonly FamilyNamed[] = []): Map<string, string[]> {
  const placements = placedIn(pieces, families).placements;
  const resolved = resolveExpansion({
    placements,
    views: [{ caption: VIEW.caption, view: { viewClass: VIEW.type, captionAnchorSourceKey: CAPTION_KEY } }],
    levels: STACK,
    ranges: AUTHORED,
    families: families.map((family) => ({ family: family.family, bands: [{ from: null, to: null }] })),
  });
  const byMark = new Map<string, string[]>();
  for (const row of resolved.rows) {
    const level = STACK.find((one) => one.levelId === (row.level as { levelId?: string }).levelId);
    byMark.set(row.placement.mark, [...(byMark.get(row.placement.mark) ?? []), `${level?.label ?? "?"}:${row.standing}`]);
  }
  return byMark;
}

describe("I-303 in the expansion: a noted member stands where its note says and nowhere else", () => {
  test("a note stating NO range leaves its member on the level the plan DRAWS, alone", () => {
    const noted = expandedBy([...TYPICAL, ...PORCH, { said: PORCH_NOTE, at: [900, -SPACING * 3] }]);
    expect(noted.get("C7"), "seven storeys of authored range, and the note says this member is not one of the typical").toEqual(["GF:MEASURED"]);
    expect(noted.get("C1")?.length, "and the plan's own typical still expand over the whole of it").toBe(6 * STACK.length);
  });

  test("a note stating `STARTS AT 1F` stands its member from there to the top of the view's span", () => {
    const noted = expandedBy([...TYPICAL, ...UNCLAIMED, { said: FLOATING_NOTE, at: NOTE_AT }]);
    // MEASURED on the lowest level it stands on, DERIVED above: a noted member was drawn once, and
    // its own note says which storey that drawing is of (risk note 2 — `standing` IS the basis).
    expect(noted.get("C5"), "1F upwards, read through `bandCovers`: an open end is no bound").toEqual([
      "1F:MEASURED",
      "2F:DERIVED",
      "3F:DERIVED",
      "4F:DERIVED",
      "5F:DERIVED",
      "6F:DERIVED",
    ]);
  });

  test("the MEASURED row is the lowest by ORDINAL, whatever order the stack arrived in", () => {
    // The stack above is handed in top-down on purpose: a resolver reading `levels[0]` would call
    // the sixth floor the storey this member was drawn at (AC-8).
    const noted = expandedBy([...TYPICAL, ...UNCLAIMED, { said: FLOATING_NOTE, at: NOTE_AT }]);
    expect(noted.get("C5")?.filter((row) => row.endsWith("MEASURED")), "one measured row, on the lowest storey it stands on").toEqual(["1F:MEASURED"]);
  });

  test("a note can only ever NARROW: it never restores a level the schedule's own band excluded", () => {
    const families: readonly FamilyNamed[] = [{ family: "C5", variants: [{ sectionWidth: 300, sectionDepth: 450 }] }];
    const placements = placedIn([...TYPICAL, ...UNCLAIMED, { said: FLOATING_NOTE, at: NOTE_AT }], families).placements;
    const resolved = resolveExpansion({
      placements,
      views: [{ caption: VIEW.caption, view: { viewClass: VIEW.type, captionAnchorSourceKey: CAPTION_KEY } }],
      levels: STACK,
      ranges: AUTHORED,
      // The schedule says this mark is carried to the fourth floor and no further; the note says it
      // starts at the first. Both are cuts of the view's span, so the answer is their intersection.
      families: [{ family: "C5", bands: [{ from: "GF", to: "4F" }] }],
    });
    const levels = resolved.rows
      .filter((row) => row.placement.mark === "C5")
      .map((row) => STACK.find((one) => one.levelId === (row.level as { levelId?: string }).levelId)?.label);
    expect(levels, "neither cut can restore what the other took away").toEqual(["1F", "2F", "3F", "4F"]);
  });

  test("a member no note names is untouched by the whole rule", () => {
    const withNote = expandedBy([...TYPICAL, ...UNCLAIMED, { said: FLOATING_NOTE, at: NOTE_AT }]);
    const without = expandedBy(TYPICAL);
    expect(withNote.get("C1"), "the six the marks placed expand exactly as they did").toEqual(without.get("C1"));
  });
});
