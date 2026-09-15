// @vitest-environment node
/**
 * The split proof for the rail roster (AM-11, L-MEA-08, B-19).
 *
 * AM-11 gives each area its own roster file and leaves `./index.ts` as the barrel that ENUMERATES
 * them and merges them, so M3's five rails can each be written in their own file. The claim is that
 * the aggregate did not change: the same kinds answered, by the same functions.
 *
 * KINDS_BEFORE is the roster as it stood before the split, frozen on purpose — a derivation cannot
 * catch a kind the split dropped. An increment that lands a rail re-baselines it and says so (B-19).
 *
 * Re-baselined by the slab, shear-wall and stair leaf, which lands `rcc.formwork` beside
 * `rcc.concrete` — and with it the fact that MORE THAN ONE AREA answers a kind. L-MEA-08 selects a
 * rail per kind and AM-11 forbids two areas DECLARING one key; both hold when the barrel COMPOSES
 * the areas that answer a kind rather than spreading one over another. So the claim below is no
 * longer "no kind twice": it is that a kind one area answers is answered by that area's very
 * function, and a kind several answer is answered by a rail whose batch is their batches
 * concatenated — which a spread could never be, because it would keep the last and lose the rest.
 *
 * Modules are loaded by absolute path, the contract this tree's other split proofs use: a module the
 * product does not provide yet fails as an assertion naming the file, never as a resolution error.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/** The checkout this suite runs against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The barrel: the one path the measure job and the worker name. */
const BARREL = "src/modules/takeoff/rails/index.ts";

/** Where the areas keep their own rosters. */
const AREA_DIR = "src/modules/takeoff/rails";

/** Code-point order — the only order this tree sorts a roster by (L-REG-05). */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** Every kind the product measured before AM-11 moved a line, in code-point order. */
const KINDS_BEFORE: readonly string[] = Object.freeze(["rcc.concrete", "rcc.formwork"]);

/** A rail, as this file drives one: the pure function of L-MEA-08, read out of a roster. */
type RailLike = (input: unknown) => { offers: readonly unknown[]; observations: readonly unknown[] };

/**
 * The one input every rail of the roster is asked over, so two answers can be compared at all.
 *
 * It names a campaign and a revision and hands no rows: what is being graded is COMPOSITION — that
 * the barrel asks each claiming area and keeps every answer — and a rail is pure, so a batch over no
 * rows is as much a function of its input as a batch over a thousand. The setup carries every map a
 * rail reads, empty, because a rail handed a setup missing one would fail as a type error rather
 * than answer.
 */
const NO_ROWS = Object.freeze({
  campaignId: "00000000-0000-4000-8000-000000000001",
  setRevisionId: "00000000-0000-4000-8000-000000000002",
  objects: Object.freeze([]),
  setup: Object.freeze({ placements: {}, memberTypes: {}, levels: Object.freeze([]), calibrations: {}, grades: {}, plans: {} }),
});

async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the split does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as Record<string, unknown>;
}

/** The rosters the areas publish: one `*_RAILS` per file that has one, read off the disk (B-19). */
async function areaRosters(): Promise<{ file: string; roster: Readonly<Record<string, unknown>> }[]> {
  const abs = join(REPO_ROOT, AREA_DIR);
  expect(existsSync(abs), `${AREA_DIR} is missing — AM-11 puts each area's rails in its own file there`).toBe(true);
  const found: { file: string; roster: Readonly<Record<string, unknown>> }[] = [];
  for (const name of readdirSync(abs).filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && entry !== "law.ts" && entry !== "index.ts").sort(byCodePoint)) {
    const file = `${AREA_DIR}/${name}`;
    const mod = await moduleAt(file);
    for (const exported of Object.keys(mod).sort(byCodePoint)) {
      if (exported.endsWith("_RAILS")) found.push({ file, roster: mod[exported] as Readonly<Record<string, unknown>> });
    }
  }
  return found;
}

/** Which areas answer each kind, in enumeration order — the fact composition turns on (AM-11). */
async function claimants(): Promise<Map<string, { file: string; rail: unknown }[]>> {
  const held = new Map<string, { file: string; rail: unknown }[]>();
  for (const { file, roster } of await areaRosters()) {
    for (const [kind, rail] of Object.entries(roster)) held.set(kind, [...(held.get(kind) ?? []), { file, rail }]);
  }
  return held;
}

describe("AM-11: the roster is the areas, enumerated — and the aggregate did not move", () => {
  test("the barrel answers exactly the kinds it answered before the split", async () => {
    const mod = await moduleAt(BARREL);
    const rails = mod["RAILS"] as Readonly<Record<string, unknown>>;
    expect(Object.keys(rails).sort(byCodePoint), "a kind was dropped or minted by the split — a kind with no rail is a kind nothing measures (L-MEA-08)").toEqual([...KINDS_BEFORE]);
  });

  test("the areas together measure exactly the kinds the barrel answers", async () => {
    const rosters = await areaRosters();
    expect(rosters.length, `${AREA_DIR} publishes no area roster — the split owes one \`*_RAILS\` per area`).toBeGreaterThan(0);
    const claimed = new Set(rosters.flatMap(({ roster }) => Object.keys(roster)));
    expect(
      [...claimed].sort(byCodePoint),
      "the areas together measure a different set than the product did — an area file the barrel forgot to enumerate reads exactly like this (B-19)",
    ).toEqual([...KINDS_BEFORE]);
  });

  test("a kind ONE area answers is answered by that area's very function", async () => {
    const mod = await moduleAt(BARREL);
    const rails = mod["RAILS"] as Readonly<Record<string, unknown>>;
    const copies: string[] = [];
    for (const [kind, claiming] of await claimants()) {
      if (claiming.length !== 1) continue;
      const only = claiming[0] as { file: string; rail: unknown };
      if (rails[kind] !== only.rail) copies.push(`${kind} (${only.file})`);
    }
    expect(copies, "the barrel answers a singly-claimed kind with something other than the very function its area holds — a wrapper is a second implementation (ARCH-02, B-17)").toEqual([]);
  });

  test("a kind SEVERAL areas answer is answered by their batches, concatenated", async () => {
    const mod = await moduleAt(BARREL);
    const rails = mod["RAILS"] as Readonly<Record<string, unknown>>;
    for (const [kind, claiming] of await claimants()) {
      if (claiming.length < 2) continue;
      const composed = (rails[kind] as RailLike)({ ...NO_ROWS, kind });
      const parts = claiming.map(({ rail }) => (rail as RailLike)({ ...NO_ROWS, kind }));
      expect(
        composed,
        `${kind} is measured by ${claiming.map(({ file }) => file).join(" and ")}, so the barrel's rail answers every one of them — a spread would keep the last and lose the rest in silence (AM-11, L-MEA-08)`,
      ).toEqual({ offers: parts.flatMap((part) => [...part.offers]), observations: parts.flatMap((part) => [...part.observations]) });
    }
  });
});
