/**
 * AC-1 — the residue is a QUERY over the borne grid, never a table (L-QTY-05, X-3).
 *
 * `resolveResidue` is pure, so every criterion here is one `ResidueInput` differing from its
 * neighbour in exactly the fact under test. The cells owed are DERIVED from that input — the classes
 * the channels sighted, the levels they were sighted on and the kinds the catalogue bears for each
 * class — so a fixture that grows a class, a level or a kind grows the expectation with it and
 * nothing is transcribed twice (B-19).
 *
 * The union of EXISTS is asked of the resolver the way L-QTY-05 states it: a class is sighted when
 * ANY ONE channel sighted it, so the same class sighted through each channel in turn must answer the
 * same grid. The two claims about the readers' DECLARATIONS — their return type and the absence of an
 * `absent` constructor — are claims about the text, and are marked as such.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
// white-box: AC-1 — two clauses of the criterion are claims about the readers' DECLARATIONS, not about a run: "each reader's declared return type is `Sighting[]`" and "src/core/residue/channels/** exports no `absent` constructor". A type annotation is erased before anything executes and a constructor nobody calls has no behaviour to drive, so both are read through the tree's one source lexer.
import { dialectOf, scanned } from "../../support/source-lex";
import { REPO_ROOT } from "../../server/support/wire";
import {
  BEAM,
  CHANNELS_DIR,
  COLUMN,
  CONCRETE,
  FORMWORK,
  GF,
  L1,
  L2,
  QUANTITY_BEARING,
  REBAR,
  RESIDUE_MODULE,
  SIGHTING_CHANNELS,
  SLAB,
  SLAB_CONCRETE,
  WATERPROOFING,
  levelIdOf,
  productModule,
  residueExport,
  residueFixture,
  resolveResidue,
  sighting,
  type Cell,
  type ResidueInput,
  type Sighting,
} from "./support/coverage-stage";

/** The three readers the interfaces name, one per channel of L-QTY-05's union. */
const READERS: Readonly<Record<string, string>> = {
  REGISTER: "registerSightings",
  PARTITION: "partitionSightings",
  LAYOUT: "layoutSightings",
};

/** Every (class, kind, level) the borne grid owes a cell for, derived from one input. */
function owed(input: ResidueInput): string[] {
  const held: string[] = [];
  for (const klass of [...new Set(input.sightings.map((seen) => seen.class))]) {
    const levels = [...new Set(input.sightings.filter((seen) => seen.class === klass).map((seen) => seen.levelId))].filter((levelId): levelId is string => levelId !== null);
    for (const { kind } of input.bears.filter((pair) => pair.class === klass)) {
      for (const levelId of levels) held.push(`${kind}|${klass}|${levelId}`);
    }
  }
  return held.sort();
}

/** The cells of the borne grid a residue holds — the rows that name a class (I-196's rows do not). */
function grid(cells: readonly Cell[]): string[] {
  return cells.filter((cell) => (cell["class"] ?? null) !== null).map((cell) => `${String(cell["kind"])}|${String(cell["class"])}|${String(levelIdOf(cell))}`).sort();
}

/** Every file under the channels directory, so a reader added later is judged too (B-19). */
function channelFiles(): string[] {
  const root = join(REPO_ROOT, CHANNELS_DIR);
  const held: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at)) {
      const path = join(at, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(?:ts|tsx|mts)$/u.test(entry)) held.push(path);
    }
  };
  expect(statSync(root, { throwIfNoEntry: false })?.isDirectory() ?? false, `${CHANNELS_DIR} is the home of the three channel readers (the increment's interfaces)`).toBe(true);
  walk(root);
  return held;
}

describe("AC-1 — one cell per (class sighted × kind borne × level sighted), and no other", () => {
  test("AC-1: the residue is exactly the borne grid the input describes", async () => {
    const input = residueFixture();
    const cells = await resolveResidue(input);

    expect(grid(cells), "one cell per sighted class, per kind the catalogue bears for that class, per level it was sighted on — and nothing else").toEqual(owed(input));
  });

  test("AC-1: nothing is invented for a class no channel sighted, nor for a kind the class does not bear", async () => {
    const input = residueFixture();
    const cells = await resolveResidue(input);

    expect(input.bears.some((pair) => pair.class === SLAB), `the fixture's catalogue bears ${SLAB_CONCRETE} for ${SLAB}`).toBe(true);
    expect(input.sightings.some((seen) => seen.class === SLAB), `and no channel sighted ${SLAB}`).toBe(false);
    expect(cells.filter((cell) => cell["class"] === SLAB), `so the residue holds no cell of the grid for ${SLAB}: a class nothing sighted bears no cell`).toEqual([]);

    expect(input.bears.some((pair) => pair.class === BEAM && pair.kind === FORMWORK), `the catalogue does not bear ${FORMWORK} for ${BEAM}`).toBe(false);
    expect(cells.filter((cell) => cell["class"] === BEAM && cell["kind"] === FORMWORK), "so no cell stands for it — the grid is BORNE, not a cross product").toEqual([]);

    expect(input.workItems.includes(WATERPROOFING) && !input.bears.some((pair) => pair.kind === WATERPROOFING), `${WATERPROOFING} stands in the catalogue and no class bears it`).toBe(true);
    expect(cells.filter((cell) => cell["kind"] === WATERPROOFING && (cell["class"] ?? null) !== null), "so it bears no cell of the grid either").toEqual([]);
  });

  test("AC-1: a level nothing was sighted on bears no cell", async () => {
    const oneLevel = residueFixture({ sightings: [sighting(COLUMN, GF), sighting(BEAM, GF)] });
    const cells = await resolveResidue(oneLevel);

    expect(oneLevel.levels.map((level) => level.levelId), "the stack holds three levels").toEqual([GF.levelId, L1.levelId, L2.levelId]);
    expect([...new Set(cells.filter((cell) => (cell["class"] ?? null) !== null).map((cell) => levelIdOf(cell)))], "and the grid stands only on the one they were sighted on — a level is a level SIGHTED, not a level authored").toEqual([GF.levelId]);
    expect(grid(cells), "which is the whole grid that level bears").toEqual(owed(oneLevel));
  });
});

describe("AC-1 — a class is sighted when ANY ONE channel sighted it (the union of EXISTS)", () => {
  test.each(SIGHTING_CHANNELS)("AC-1: %s alone sights a class, and the grid it bears is the same grid", async (channel) => {
    const only = residueFixture({ sightings: [sighting(COLUMN, GF, channel as Sighting["channel"]), sighting(COLUMN, L1, channel as Sighting["channel"])] });
    const cells = await resolveResidue(only);

    expect(grid(cells), `a class sighted only through ${channel} is sighted: L-QTY-05's sighting is a UNION over the three channels, never an intersection`).toEqual(owed(only));
    expect(grid(cells).length, "so the column's kinds stand on both levels it was sighted on").toBeGreaterThan(0);
  });

  test("AC-1: the same class sighted through each channel in turn answers the same grid", async () => {
    const answers = await Promise.all(
      SIGHTING_CHANNELS.map(async (channel) => grid(await resolveResidue(residueFixture({ sightings: [sighting(COLUMN, GF, channel as Sighting["channel"])] })))),
    );

    for (const [at, answer] of answers.entries()) {
      expect(answer, `${SIGHTING_CHANNELS[at]} sights exactly what ${SIGHTING_CHANNELS[0]} sights — no channel counts for more or less than another`).toEqual(answers[0]);
    }
    expect(answers[0]?.length, "and each of them sights something").toBeGreaterThan(0);
  });

  test("AC-1: two channels sighting the same class on the same level still bear ONE cell", async () => {
    const doubled = residueFixture({ sightings: [sighting(COLUMN, GF, "REGISTER"), sighting(COLUMN, GF, "PARTITION"), sighting(COLUMN, GF, "LAYOUT")] });
    const cells = await resolveResidue(doubled);

    expect(grid(cells), "a union answers whether, not how many times — three sightings of one class on one level are one cell per kind").toEqual(owed(doubled));
  });
});

describe("AC-1 — the three readers, and what a reader may not publish", () => {
  test("AC-1: the residue barrel publishes the three channel readers and names the three channels", async () => {
    for (const [channel, reader] of Object.entries(READERS)) {
      const found = await residueExport(reader);
      expect(typeof found, `${RESIDUE_MODULE} publishes \`${reader}\` — the ${channel} channel's reader (the increment's interfaces)`).toBe("function");
    }
    const module = (await productModule<Record<string, unknown>>(RESIDUE_MODULE)) as Record<string, unknown>;
    expect([...(module["SIGHTING_CHANNELS"] as readonly string[])].sort(), "and the closed roster of channels a Sighting may name is exactly those three (L-QTY-05)").toEqual([...SIGHTING_CHANNELS].sort());
  });

  test("AC-1: each reader's declared return type is `Sighting[]`", () => {
    // white-box: AC-1 — "a recogniser's output type is `Sighting[]` with no `absent()` constructor"
    // (L-QTY-05) is a claim about the DECLARATION. A reader that answered the right rows under a
    // looser declared type would be indistinguishable at run time from one declared right, so the
    // only thing that can show it is the text of the signature.
    const files = channelFiles();
    expect(files.length, "the three channel readers each have a home under the channels directory").toBeGreaterThanOrEqual(Object.keys(READERS).length);

    for (const reader of Object.values(READERS)) {
      const declaring = files.map((file) => readFileSync(file, "utf8")).filter((source) => source.includes(reader));
      expect(declaring.length, `${reader} is declared under ${CHANNELS_DIR}`).toBeGreaterThan(0);
      const declared = declaring.some((source) => new RegExp(`${reader}[\\s\\S]{0,600}?:\\s*Promise<\\s*Sighting\\[\\]\\s*>|${reader}[\\s\\S]{0,600}?:\\s*Sighting\\[\\]`, "u").test(source));
      expect(declared, `${reader} declares its answer as \`Sighting[]\` — a reader answers what it SAW, and has no way to say what it did not (L-QTY-05)`).toBe(true);
    }
  });

  test("AC-1: no `absent` constructor is published anywhere under the channels directory", () => {
    // white-box: AC-1 — "no `absent()` constructor exists anywhere under src/core/residue/channels/**"
    // is a claim about what the text DECLARES. A constructor nothing calls has no runtime observable,
    // and its mere availability is the defect L-QTY-05 bans, so the declarations are what is read.
    const guilty: string[] = [];
    for (const file of channelFiles()) {
      const source = readFileSync(file, "utf8");
      let code = "";
      for (const { char, mode } of scanned(source, dialectOf(file))) if (mode === "code") code += char;
      if (/\bexport\b[^;\n]*\babsent\b/u.test(code) || /\babsent\s*[:=]\s*(?:\(|function|async)/u.test(code)) guilty.push(file.slice(REPO_ROOT.length + 1));
    }

    expect(guilty, "a channel reader may say what it saw and nothing else — an `absent` constructor is the NOT EXISTS the residue query alone holds, moved into a reader (L-QTY-05)").toEqual([]);
  });
});

describe("AC-1 — the resolved cell answers on both axes", () => {
  test("AC-1: every cell of the grid carries a measurement reading, a bill reading and a contradiction flag", async () => {
    const cells = await resolveResidue(residueFixture());
    const grain = cells.filter((cell) => (cell["class"] ?? null) !== null);

    expect(grain.length, "the fixture bears cells").toBeGreaterThan(0);
    for (const cell of grain) {
      const said = `${String(cell["kind"])} on ${String(cell["class"])}, ${String(levelIdOf(cell))}`;
      expect(typeof cell["measurement"], `${said}: the measurement axis answers`).toBe("string");
      expect(typeof cell["bill"], `${said}: and so does the bill axis — two orthogonal axes over one borne grid (L-QTY-05)`).toBe("string");
      expect(typeof cell["contradicted"], `${said}: and the cell says whether a declaration over it is contradicted (I-192)`).toBe("boolean");
    }

    const measured = grain.filter((cell) => cell["measurement"] === QUANTITY_BEARING);
    expect(measured.map((cell) => `${String(cell["kind"])}|${String(cell["class"])}|${String(levelIdOf(cell))}`), "and the cell the fixture published a line for is the cell that bears quantity").toEqual([`${CONCRETE}|${COLUMN}|${GF.levelId}`]);
    expect(grain.some((cell) => cell["kind"] === REBAR && levelIdOf(cell) === L2.levelId), "while its neighbours stand unmeasured beside it").toBe(true);
  });
});
