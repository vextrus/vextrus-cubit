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
 */
import { describe, expect, test } from "vitest";
import { carryLevel, dotlessUpper } from "@/core/identity";
import { placeholderCarries, resolveExpansion, type AuthoredRange, type ExpansionRow, type StackedLevel } from "@/modules/takeoff/partition/expansion/resolve";
import { partitionArtifact } from "@/modules/takeoff/partition/views/assign";
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
  test("the cause, pinned: at the pin the 1F plan's 23 beams wait under 1ST, and the comparison form finds no level of the section's stack for it", async () => {
    const read = await bnbc();
    const views = partitionArtifact(read.graph).views.flatMap((view) => (view.anchorKey === null ? [] : [{ caption: view.caption, view: { viewClass: view.type, captionAnchorSourceKey: view.anchorKey } }]));
    const pinned = resolveExpansion({ placements: read.placed.placements, views, levels: [], ranges: [] }).rows.filter((row) => "unregistered" in row.level);
    expect(pinned.length, "23 beams, and nothing else, wait under a level nobody has authored").toBe(23);
    expect(new Set(pinned.map((row) => `${row.placement.viewKey} ${row.placement.elementType} ${JSON.stringify(row.level)}`)), "all of S-13's, all beams, all under the caption's word").toEqual(
      new Set([`${FIRST_FLOOR_PLAN} beam {"unregistered":"1ST"}`]),
    );
    expect(SECTION.some((level) => dotlessUpper(level.label) === "1ST"), "INSERT_LEVEL's letter-by-letter carry has nothing to carry them onto").toBe(false);
  }, BUDGET_MS);

  test("walked through J-000's acts, the rebuild retires the 23 onto 1F: 172 beam objects, the resolver's own rows, none beside a placeholder", async () => {
    const { register, resolved, carried } = await walked(true);
    expect(carried, "the 23 placeholders, carried once each by the rebuild after the stack is confirmed").toBe(23);
    expect(perStorey(register, "beam"), "ROOF's 24, the 1F plan's 23, and the typical plan's 25 on each of 2F..6F").toEqual({ ROOF: 24, "1F": 23, "2F": 25, "3F": 25, "4F": 25, "5F": 25, "6F": 25 });
    expect(keysOf(register, "beam").length, "one object per beam placement per storey — the stack gives 172").toBe(172);
    expect([...register.keys()].filter((key) => key.includes("@unregistered:")), "no member waits under a word the stack now carries").toEqual([]);
    expect([...register.keys()].sort(), "the register IS the resolver's rows over the final state: nothing stands beside them").toEqual(resolved.map((row) => row.objectKey).sort());
  }, BUDGET_MS);

  test("and without the rebuild's carry the same walk leaves 195 — the 23 standing twice — which is the defect J-000 measured", async () => {
    const { register } = await walked(false);
    expect(keysOf(register, "beam").length, "172 + the 23 placeholders beside their own 1F rows").toBe(195);
    expect(perStorey(register, "beam")["@unregistered:1ST"], "all 23 still under the caption's word").toBe(23);
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
