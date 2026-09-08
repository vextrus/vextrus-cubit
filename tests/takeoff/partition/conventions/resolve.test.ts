/**
 * AC-1, AC-2 — L-CAD-08's conventions resolve per drawing from an entity census by geometry
 * statistics, and a seed corroborates but never adds, drops or re-assigns a role.
 *
 * The unit lane is where the clause asks for this ("CI-enforced"): `resolve` is a pure function of
 * a census, so nothing here stages a database, a drawing or a job. The census is data the criteria
 * spell out — `GRID`, `Tie`, `Blank` and the grammar ids are names in that data, and the resolver
 * is told nothing about what they mean.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { describe, expect, test } from "vitest";
import { scanned } from "../../../support/source-lex";
import { REPO_ROOT } from "../support/partition-stage";
import { RESOLVE_MODULE, ROLES, resolveDoor, type ConventionProfile, type EntityCensus } from "../support/conventions-stage";

/**
 * AC-1's census: five layers, each drawn so that exactly one kind of entity is the plurality, and
 * three grammars of which one read no caption at all.
 */
const CENSUS: EntityCensus = {
  layers: [
    { layer: "GRID", paths: 40, rings: 0, texts: 0, dimensions: 0 },
    { layer: "WALLS", paths: 3, rings: 12, texts: 0, dimensions: 0 },
    { layer: "NOTES", paths: 0, rings: 0, texts: 30, dimensions: 1 },
    { layer: "DIMS", paths: 2, rings: 0, texts: 0, dimensions: 8 },
    { layer: "AXES", paths: 5, rings: 0, texts: 0, dimensions: 0 },
  ],
  grammars: [
    { grammar: "plan", captions: 3 },
    { grammar: "section", captions: 1 },
    { grammar: "legend", captions: 0 },
  ],
};

/** The profile that census resolves to: every list in code-point order, and nothing deferred. */
const PROFILE: ConventionProfile = {
  roles: { linework: ["AXES", "GRID"], outlines: ["WALLS"], text: ["NOTES"], dimensions: ["DIMS"] },
  captionGrammars: ["plan", "section"],
  deferrals: [],
};

/** A layer whose two kinds tie, and one that was drawn on at all — neither carries a role. */
const TIE = { layer: "Tie", paths: 4, rings: 4, texts: 0, dimensions: 0 };
const BLANK = { layer: "Blank", paths: 0, rings: 0, texts: 0, dimensions: 0 };

/**
 * The seeds L-CAD-08 says may corroborate and may not act: one that would ADD a layer to a role,
 * one that would DROP the layers of a role, and one that would RE-ASSIGN a layer to another role.
 */
const SEEDS: readonly { what: string; seed: unknown }[] = [
  { what: "adds a layer to a role", seed: { roles: { linework: ["AXES", "GRID", "NOTES"] } } },
  { what: "drops the layers of a role", seed: { roles: { linework: [] } } },
  { what: "re-assigns a layer to another role", seed: { roles: { outlines: ["GRID"] } } },
];

/** The imports a pure method over core types may make (AC-2): core through the alias, or a neighbour. */
const CORE_ALIAS = "@/core/";
const CORE_DIR = join("src", "core");

/**
 * Every module specifier a file imports from, comments removed so a specifier written in prose is
 * not read as one.
 *
 * white-box: AC-2 — "imports only from `@/core/**` or relative paths inside `src/core/**`" is a
 * property of the file's own text: an import graph is not something a call can be made to observe
 * from outside, and a boundary crossed is a defect whether or not any test happens to run the line.
 */
function specifiersOf(source: string): string[] {
  let code = "";
  for (const { char, mode } of scanned(source, "ts")) {
    code += mode === "line" || mode === "block" ? (char === "\n" ? "\n" : " ") : char;
  }
  const found: string[] = [];
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])([^"']+)\1/g)) {
    found.push(match[2] ?? "");
  }
  return found;
}

describe("AC-1: a profile resolves from the census by geometry statistics", () => {
  test("AC-1: each layer takes the role of the kind that strictly outnumbers the other three, and a grammar that read a caption names views", async () => {
    const door = await resolveDoor();
    expect(
      door.resolve(CENSUS),
      "the census resolves to the layers that carry linework, outlines, text and dimensions, and to the grammars that named a view (L-CAD-08)",
    ).toEqual(PROFILE);
    expect(door.CONVENTION_ROLES, "and the roles it names are the four L-CAD-08 asks a drawing's conventions for, in the order it asks them").toEqual(ROLES);
  });

  test("AC-1: a layer whose tallies tie, and one nothing was drawn on, hold no role at all", async () => {
    const { resolve } = await resolveDoor();
    const withNeither = resolve(CENSUS);
    const withBoth = resolve({ layers: [...CENSUS.layers, TIE, BLANK], grammars: CENSUS.grammars });
    expect(
      withBoth,
      `\`${TIE.layer}\` has as many paths as rings and \`${BLANK.layer}\` was drawn on at all, so neither is the layer that carries any role — a plurality is strict (L-CAD-08)`,
    ).toEqual(withNeither);
  });
});

describe("AC-2: a seed corroborates and never acts", () => {
  test("AC-2: an empty seed changes nothing in the profile", async () => {
    const { resolve } = await resolveDoor();
    expect(resolve(CENSUS, {}), "resolve(census, {}) deep-equals resolve(census) — the clause's own CI-enforced equality (L-CAD-08)").toEqual(resolve(CENSUS));
  });

  for (const { what, seed } of SEEDS) {
    test(`AC-2: a seed that ${what} changes nothing in the profile`, async () => {
      const { resolve } = await resolveDoor();
      expect(
        resolve(CENSUS, seed),
        `a seed may corroborate a reading and may never add, drop or re-assign a role: ${JSON.stringify(seed)} left the profile the census alone resolves to (L-CAD-08)`,
      ).toEqual(resolve(CENSUS));
    });
  }

  test("AC-2: the method is pure over core types — it imports nothing but core", async () => {
    await resolveDoor();
    const home = join(REPO_ROOT, RESOLVE_MODULE);
    const core = join(REPO_ROOT, CORE_DIR);
    const source = readFileSync(home, "utf8");
    const foreign = specifiersOf(source).filter((specifier) => {
      if (specifier.startsWith(CORE_ALIAS)) return false;
      // A relative specifier is admitted only where it lands inside core: a neighbour of the method
      // is core, and a path that climbs out of it is a module the method may not know (ARCH-01).
      return !specifier.startsWith(".") || !resolve(dirname(home), specifier).startsWith(`${core}${sep}`);
    });
    expect(
      foreign,
      `${RESOLVE_MODULE} is a pure method over core types: it may reach \`${CORE_ALIAS}**\` and its own neighbours in src/core, and nothing else (ARCH-01)`,
    ).toEqual([]);
  });
});
