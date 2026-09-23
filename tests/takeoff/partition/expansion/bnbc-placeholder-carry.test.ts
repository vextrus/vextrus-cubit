// @vitest-environment node
/**
 * I-366 on the drawing it was found on: F-RCC6-BNBC read by the SHIPPED `cad/` CLI (L-CAD-01), put
 * through the partition's pure stages, and walked through J-000's own order of acts — the set pinned
 * over an empty stack, the FDN neck inserted, the section's stack confirmed, the typical ranges
 * authored on the rail's rows — with the register modelled the way the store holds it: a key stands
 * until a carry moves it, and nothing is ever taken away (0029). No database.
 *
 * What was wrong: S-13's `1ST FLOOR BEAM LAYOUT` names its storey in ordinal words, so at the pin, with
 * no stack, its 23 beams registered under `@unregistered:1ST`. The stack a person confirms spells that
 * storey `1F`; `INSERT_LEVEL`'s carry compares labels letter by letter (`dotlessUpper`) and carried
 * nothing, while the resolver reads `1ST` as `1F` (`sameStorey`) and the rebuild after the act
 * registered the same 23 beams on 1F beside their placeholders — 195 beam objects where the stack
 * gives 172. The rebuild now retires each placeholder onto the row the one resolver derives for it.
 *
 * AND WHAT MAY NOT MOVE: the piles, the caps and the columns stand on exactly the keys they stood on,
 * and beam rows are PARTIAL (no slab thickness), so nothing billed moves.
 *
 * TEST_AMENDED (FRM-3, I-460): EntityGraph v3 states which way each text is written, and a mark
 * turned along the one pair it stands on names it — so each beam layout now places the beams it
 * letters up the sheet too: S-14 52 (was 25), S-13 50 (was 23), S-15 46 (was 24). The walk is the
 * same walk; the figures are the drawing's. One of S-13's 50 is `LB1`, which the first-floor long
 * sections (S-16) do not detail and the typical ones (S-17) band `2ND TO 6TH`: the resolver stands it
 * on no level of the stack (L-FRM-02), so its placeholder from the pin is not carried (I-367) and
 * stands beside the 49 the rebuild does carry — stale, and reported so by the rebuild.
 *
 * And J-000's Measure must not size it (I-461): the frame rail took the FOUNDATION slot's
 * level-less arm for it and bound S-17's one row, banded `2ND TO 6TH`, on a member whose word is 1ST —
 * two PARTIAL lines on a key no level carries, which I-368's read-back holds at none.
 */
import { describe, expect, test } from "vitest";
import type { Rail, RailSetup, RegisterObjectRow } from "@/core/offers/contract";
import { carryLevel, dotlessUpper } from "@/core/identity";
import { memberFamiliesSetupOf, readingSetupOf } from "@/modules/takeoff/measure/setup";
import { placeholderCarries, resolveExpansion, type AuthoredRange, type ExpansionRow, type StackedLevel } from "@/modules/takeoff/partition/expansion/resolve";
import { partitionArtifact } from "@/modules/takeoff/partition/views/assign";
import { beamConcreteRail, beamFormworkRail } from "@/modules/takeoff/rails/frame/index";
import { BNBC_DXF, stagesOver, type StagesRead } from "../support/bnbc-stages";

/** J-000's stack: the neck a person enters beneath GF first, then the eight storeys S-25's section proposes. */
const NECK: StackedLevel = { levelId: "level-FDN", label: "FDN", ordinal: -1 };
const SECTION: readonly StackedLevel[] = ["GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF"].map((label, ordinal) => ({ levelId: `level-${label}`, label, ordinal }));

/** The typical ranges J-000 authors (BNBC_TYPICAL_RANGES), by the caption the partition read. */
const RANGES: readonly { readonly caption: string; readonly from: string; readonly to: string }[] = [
  { caption: "COLUMN LAYOUT PLAN", from: "GF", to: "6F" },
  { caption: "TYPICAL FLOOR BEAM LAYOUT", from: "2F", to: "6F" },
  { caption: "TYPICAL SLAB REINFORCEMENT PLAN", from: "2F", to: "6F" },
];

/** The view whose caption names its storey in ordinal words. */
const FIRST_FLOOR_PLAN = "v:LAYOUT_PLAN:DXF_HANDLE:2116";

/** The member of that plan its own schedule bands off its storey: S-17 details LB1 for 2ND TO 6TH, S-16 not at all. */
const BANDED_OFF = "LB1";

let bnbcRead: Promise<StagesRead> | undefined;
const bnbc = (): Promise<StagesRead> => (bnbcRead ??= stagesOver(BNBC_DXF));

/** How long the drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

/** The register of one pinned revision, as the store holds it: each standing key, and the row it stands for. */
type Register = Map<string, ExpansionRow>;

/** The walk's outcome: the register it leaves, and what the resolver derives over the final state. */
type Walked = { readonly register: Register; readonly resolved: readonly ExpansionRow[]; readonly carried: number };

/**
 * J-000's order of acts over the stages, each act followed by the rebuild the router runs after it
 * (`reexpandProject`). `rebuildCarries` is the one thing varied: whether the register pass retires a
 * placeholder the resolver now places (I-366), or offers the resolved row beside it as it did.
 */
async function walked(rebuildCarries: boolean): Promise<Walked> {
  const read = await bnbc();
  const views = partitionArtifact(read.graph).views.flatMap((view) =>
    view.anchorKey === null ? [] : [{ caption: view.caption, view: { viewClass: view.type, captionAnchorSourceKey: view.anchorKey } }],
  );
  const families = read.registered.families.map((family) => ({ family: family.family, bands: family.variants.map((variant) => ({ from: variant.bandFrom, to: variant.bandTo })) }));
  const resolve = (levels: readonly StackedLevel[], ranges: readonly AuthoredRange[]): readonly ExpansionRow[] =>
    resolveExpansion({ placements: read.placed.placements, views, levels, ranges, families }).rows;

  const register: Register = new Map();
  let carried = 0;

  /** One register pass, as `registerExpansion` makes it: carry what the rows retire, offer what does not stand. */
  const pass = (rows: readonly ExpansionRow[], stack: readonly StackedLevel[]): void => {
    if (rebuildCarries) {
      const placeholders = [...register.values()].flatMap((row) => ("unregistered" in row.level ? [{ objectKey: row.objectKey, label: row.level.unregistered, standing: row.standing }] : []));
      for (const carry of placeholderCarries(rows, placeholders, stack, new Set(register.keys()))) {
        register.delete(carry.placeholder.objectKey);
        register.set(carry.row.objectKey, carry.row);
        carried += 1;
      }
    }
    for (const row of rows) if (!register.has(row.objectKey)) register.set(row.objectKey, row);
  };

  /** INSERT_LEVEL's own carry, as the act makes it: a placeholder whose label IS a proposal's, in the comparison form. */
  const insertLevels = (proposed: readonly StackedLevel[]): void => {
    for (const [key, row] of [...register]) {
      if (!("unregistered" in row.level)) continue;
      const label = row.level.unregistered;
      const level = proposed.find((one) => dotlessUpper(one.label) === dotlessUpper(label));
      if (level === undefined) continue;
      const moved = carryLevel(key, { label, levelId: level.levelId });
      register.delete(key);
      register.set(moved.key, { ...row, objectKey: moved.key, level: { levelId: level.levelId } });
    }
  };

  /** AUTHOR_TYPICAL_RANGE, as L-REG-04 states it: the view's UNRESOLVED placeholders retire and all N first-register. */
  const authorRange = (viewKey: string, rows: readonly ExpansionRow[]): void => {
    for (const [key, row] of [...register]) {
      if (row.placement.viewKey !== viewKey || !("slot" in row.level) || row.level.slot !== "UNRESOLVED") continue;
      const becomes = rows.filter((one) => one.placement.placementKey === row.placement.placementKey && "levelId" in one.level);
      if (becomes.length === 0) continue;
      register.delete(key);
      for (const one of becomes) if (!register.has(one.objectKey)) register.set(one.objectKey, one);
    }
  };

  // The pin: the stack is empty, so the 1F plan's beams wait under the caption's own word.
  pass(resolve([], []), []);

  // The neck, inserted by hand beneath where GF will stand — and the rebuild after it.
  let stack: StackedLevel[] = [NECK];
  insertLevels([NECK]);
  pass(resolve(stack, []), stack);

  // The section's stack, confirmed whole — and the rebuild after it.
  stack = [NECK, ...SECTION];
  insertLevels(SECTION);
  pass(resolve(stack, []), stack);

  // The typical ranges, authored on the rail's rows: only a view standing under UNRESOLVED is listed.
  const ranges: AuthoredRange[] = [];
  for (const range of RANGES) {
    const view = views.find((one) => one.caption.startsWith(range.caption));
    const key = view === undefined ? undefined : [...register.values()].find((row) => row.placement.view.captionAnchorSourceKey === view.view.captionAnchorSourceKey)?.placement.viewKey;
    if (key === undefined) continue;
    ranges.push({ viewKey: key, fromLevelId: `level-${range.from}`, toLevelId: `level-${range.to}` });
    const rows = resolve(stack, ranges);
    authorRange(key, rows);
    pass(rows, stack);
  }

  return { register, resolved: resolve(stack, ranges), carried };
}

/** The register's objects of one class, by key. */
function keysOf(register: Register, ...classes: readonly string[]): string[] {
  return [...register.values()].filter((row) => classes.includes(row.placement.elementType)).map((row) => row.objectKey).sort();
}

/** The ingest record, campaign and revision the walked register is measured under — surrogates, no store. */
const INGEST = "frm3b-ingest";
const REVISION = "frm3b-revision";

/**
 * The walked register's beams, handed to the two beam rails the way the measure job hands them: each
 * row stating its level in the one form its key is spelled from, and the record's own member types and
 * runs through the loader's own mappings (`memberFamiliesSetupOf`, `readingSetupOf`), every view
 * affirmed. No slab thickness is read yet, so every line is PARTIAL (FRM-4).
 */
function measuredBeams(
  read: StagesRead,
  register: Register,
): { readonly rail: string; readonly offered: readonly string[]; readonly coverage: readonly string[]; readonly observed: readonly { readonly key: string; readonly code: string }[] }[] {
  const beams = [...register.values()].filter((row) => row.placement.elementType === "beam");
  const setup = {
    placements: Object.fromEntries(
      beams.map((row) => [
        row.placement.placementKey,
        { drawingId: "frm3b-drawing", ingestId: INGEST, viewKey: row.placement.viewKey, memberFamily: row.placement.memberFamily, engine: "VECTOR", sourceEntity: row.placement.placementKey, outline: null, noteShape: null, noteKey: null },
      ]),
    ),
    memberTypes: { [INGEST]: memberFamiliesSetupOf(read.registered.families) },
    levels: [NECK, ...SECTION].map((level) => ({ ...level, height: { standing: "NONE", value: null, unit: null, basis: null, sourceKey: null } })),
    calibrations: { [INGEST]: Object.fromEntries(beams.map((row) => [row.placement.viewKey, "frm3b-calibration"])) },
    grades: {},
    plans: {},
    runs: Object.fromEntries((read.placed.runs ?? []).map((run) => [run.placementKey, { clear: readingSetupOf(run.clear), sides: [readingSetupOf(run.sides[0]), readingSetupOf(run.sides[1])] }])),
    lintels: {},
  } as unknown as RailSetup;
  const objects = beams.map(
    (row) =>
      ({
        objectKey: row.objectKey,
        placementKey: row.placement.placementKey,
        elementType: "beam",
        mark: row.placement.mark,
        levelId: "levelId" in row.level ? row.level.levelId : null,
        levelSlot: "slot" in row.level ? row.level.slot : null,
        levelLabel: "unregistered" in row.level ? row.level.unregistered : null,
        standing: row.standing,
        setRevisionId: REVISION,
      }) as unknown as RegisterObjectRow,
  );
  const rails: readonly (readonly [string, string, Rail])[] = [
    ["beamConcreteRail", "rcc.concrete", beamConcreteRail],
    ["beamFormworkRail", "rcc.formwork", beamFormworkRail],
  ];
  return rails.map(([rail, kind, measure]) => {
    const batch = measure({ campaignId: "frm3b-campaign", setRevisionId: REVISION, kind: kind as Parameters<Rail>[0]["kind"], objects, setup });
    return {
      rail,
      offered: batch.offers.map((offer) => offer.register.objectKey),
      coverage: [...new Set(batch.offers.map((offer) => offer.coverage))],
      observed: batch.observations.map((observation) => ({ key: observation.objectKey ?? "", code: observation.code })),
    };
  });
}

/** The count of a class's objects per storey label, the placeholders under their own slot. */
function perStorey(register: Register, elementType: string): Record<string, number> {
  const held: Record<string, number> = {};
  for (const row of register.values()) {
    if (row.placement.elementType !== elementType) continue;
    const at = "levelId" in row.level ? row.level.levelId.replace("level-", "") : "unregistered" in row.level ? `@unregistered:${row.level.unregistered}` : `@${row.level.slot}`;
    held[at] = (held[at] ?? 0) + 1;
  }
  return held;
}

describe("I-366 on F-RCC6-BNBC: J-000's register holds one object per beam placement per storey", () => {
  test("the cause, pinned: at the pin the 1F plan's 50 beams wait under 1ST, and the comparison form finds no level of the section's stack for it", async () => {
    const read = await bnbc();
    const views = partitionArtifact(read.graph).views.flatMap((view) => (view.anchorKey === null ? [] : [{ caption: view.caption, view: { viewClass: view.type, captionAnchorSourceKey: view.anchorKey } }]));
    const pinned = resolveExpansion({ placements: read.placed.placements, views, levels: [], ranges: [] }).rows.filter((row) => "unregistered" in row.level);
    expect(pinned.length, "50 beams, and nothing else, wait under a level nobody has authored (TEST_AMENDED, FRM-3: 23)").toBe(50);
    expect(new Set(pinned.map((row) => `${row.placement.viewKey} ${row.placement.elementType} ${JSON.stringify(row.level)}`)), "all of S-13's, all beams, all under the caption's word").toEqual(
      new Set([`${FIRST_FLOOR_PLAN} beam {"unregistered":"1ST"}`]),
    );
    expect(SECTION.some((level) => dotlessUpper(level.label) === "1ST"), "INSERT_LEVEL's letter-by-letter carry has nothing to carry them onto").toBe(false);
  }, BUDGET_MS);

  test("walked through J-000's acts, the rebuild retires 49 onto 1F: 355 beam objects on the stack, the resolver's own rows, and LB1's placeholder the one I-367 keeps", async () => {
    const { register, resolved, carried } = await walked(true);
    expect(carried, "the 49 placeholders the resolver stands on 1F, carried once each by the rebuild after the stack is confirmed").toBe(49);
    expect(perStorey(register, "beam"), "ROOF's 46, the 1F plan's 49, the typical plan's 52 on each of 2F..6F — and LB1 under the caption's word").toEqual({
      ROOF: 46,
      "1F": 49,
      "2F": 52,
      "3F": 52,
      "4F": 52,
      "5F": 52,
      "6F": 52,
      "@unregistered:1ST": 1,
    });
    expect(keysOf(register, "beam").length, "one object per beam placement per storey the stack gives it, 355, and the one placeholder never carried").toBe(356);
    const waiting = [...register.values()].filter((row) => "unregistered" in row.level);
    expect(
      waiting.map((row) => `${row.placement.viewKey} ${row.placement.mark}`),
      "no member waits under a word the stack carries but the one its own schedule bands off that storey (I-367)",
    ).toEqual([`${FIRST_FLOOR_PLAN} ${BANDED_OFF}`]);
    expect(resolved.filter((row) => row.placement.viewKey === FIRST_FLOOR_PLAN && row.placement.mark === BANDED_OFF), "the resolver stands S-13's LB1 on no level (L-FRM-02)").toEqual([]);
    expect(
      [...register.keys()].filter((key) => !key.includes("@unregistered:")).sort(),
      "the register IS the resolver's rows over the final state: nothing stands beside them but that placeholder",
    ).toEqual(resolved.map((row) => row.objectKey).sort());
  }, BUDGET_MS);

  test("and J-000's Measure reports LB1's placeholder rather than sizing it off S-17's band: no beam line on a key the stack does not carry (I-461, I-368)", async () => {
    const read = await bnbc();
    const { register } = await walked(true);
    const markOf = new Map([...register.values()].map((row) => [row.objectKey, row.placement.mark]));
    const onPlaceholder = (key: string): boolean => key.includes("@unregistered:");
    const [placeholder] = [...register.keys()].filter(onPlaceholder);
    expect(placeholder, "the walk leaves LB1's placeholder standing (the case above)").toBeDefined();
    for (const measured of measuredBeams(read, register)) {
      expect(measured.offered.length, `${measured.rail}: every one of the 355 beams on the stack is offered — J-000's beam lines, 2 × 355`).toBe(355);
      expect(measured.coverage, `${measured.rail}: each PARTIAL, no slab thickness read yet (FRM-4)`).toEqual(["PARTIAL_DECLARED"]);
      expect(measured.offered.filter(onPlaceholder), `${measured.rail}: nothing offered on a placeholder — the line would bind a band that does not reach 1F (L-FRM-02)`).toEqual([]);
      expect(
        measured.observed.filter((seen) => onPlaceholder(seen.key)),
        `${measured.rail}: LB1 reported once, on its own key, under the code its band's silence is read as (L-QTY-04)`,
      ).toEqual([{ key: placeholder, code: "SECTION_BAND_UNCOVERED" }]);
      // The family is not unreadable: where S-17's band reaches, the typical plan's LB1 is sized by it.
      const typicalLb1 = measured.offered.filter((key) => markOf.get(key) === BANDED_OFF).map((key) => (register.get(key)?.level as { levelId: string }).levelId.replace("level-", ""));
      expect(typicalLb1.sort(), `${measured.rail}: the typical plan's LB1 is sized on each floor its band covers, and on no other`).toEqual(["2F", "3F", "4F", "5F", "6F"]);
    }
  }, BUDGET_MS);

  test("and without the rebuild's carry the same walk leaves 405 — the 49 standing twice — which is the defect J-000 measured", async () => {
    const { register } = await walked(false);
    expect(keysOf(register, "beam").length, "355 + the 50 placeholders beside their own 1F rows (TEST_AMENDED, FRM-3: 172 + 23 = 195)").toBe(405);
    expect(perStorey(register, "beam")["@unregistered:1ST"], "all 50 still under the caption's word").toBe(50);
  }, BUDGET_MS);

  test("what may not move: the piles, the caps and the columns stand on exactly the keys they stood on", async () => {
    const [carrying, before] = [await walked(true), await walked(false)];
    for (const elementType of ["pile", "pile_cap", "column"]) {
      expect(keysOf(carrying.register, elementType), `${elementType}: byte-identical keys`).toEqual(keysOf(before.register, elementType));
    }
    expect(keysOf(carrying.register, "pile").length, "S-04's 89 piles, in the foundation slot").toBe(89);
    expect(keysOf(carrying.register, "pile_cap").length, "S-06's 26 caps, in the foundation slot").toBe(26);
    expect(perStorey(carrying.register, "column")["@UNRESOLVED"], "and no column is left waiting once its plan's range is authored").toBeUndefined();
  }, BUDGET_MS);
});
