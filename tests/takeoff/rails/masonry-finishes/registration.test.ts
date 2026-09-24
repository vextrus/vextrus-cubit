/**
 * AC-1 (the code's half) — the MASONRY area, registered: three kinds and two classes in the closed
 * rosters, the three `bears` rows they stand in, and the three total maps still total over them
 * (R-TO-032, L-MEA-04, AM-11).
 *
 * The store's half — the migration that re-states every closed CHECK over the grown rosters and
 * seeds the three work items and three bears rows — is graded beside this file in
 * `./registration-store.test.ts`, which needs a migrated database. The j-022 coverage baselines the
 * grid's new columns move are the gate's own picture lane to re-take: a design capture is not a
 * thing a vitest suite can assert, and the criterion names it as a `baseline:` commit.
 *
 * Nothing is transcribed: the kinds, the classes, the maps and the emitted tables are read from the
 * product's own consts and its own emitter, and every append is judged as an APPEND — this leaf's
 * own grid, never a roster-wide equality that would un-land another leaf's lawful row (B-19, B-20).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  ARCH_FINISH_KINDS,
  ARCH_FINISH_PAIRS,
  AREA,
  BEARS_MODULE,
  BRICK_WALL,
  CATALOGUE_DIR,
  CATALOGUE_DRIFT_SCRIPT,
  CATALOGUE_EMIT_MODULE,
  CATALOGUE_MAPS_MODULE,
  CATALOGUE_MODULE,
  CLASSES_MODULE,
  FINISH_FLOORING,
  FINISH_PAINT,
  FINISH_PLASTER,
  FINISH_SKIRTING,
  FINISH_TILING,
  KINDS_MODULE,
  KIND_LAW_MODULE,
  LENGTH,
  MASONRY_BRICKWORK,
  OPENING,
  REPO_ROOT,
  SHEETS_LAW_MODULE,
  SURFACE,
  VOLUME,
  canon,
  masonryMethod,
  productModule,
} from "./support/masonry-contract";

/** The three kinds the closed catalogue GAINS, with what the catalogue says each is (interfaces). */
const CATALOGUE_ENTRIES: readonly { kind: string; dimension: string; precision: number; algebra: string }[] = [
  { kind: MASONRY_BRICKWORK, dimension: VOLUME, precision: 3, algebra: "member" },
  { kind: FINISH_PLASTER, dimension: AREA, precision: 2, algebra: "face" },
  { kind: FINISH_PAINT, dimension: AREA, precision: 2, algebra: "face" },
];

/** The two classes the closed roster gains (interfaces). */
const OWED_CLASSES: readonly string[] = [BRICK_WALL, SURFACE];

/** The three rows the `bears` relation gains — what each class this leaf measures lawfully bears. */
const OWED_BEARS: readonly { class: string; kind: string }[] = [
  { class: BRICK_WALL, kind: MASONRY_BRICKWORK },
  { class: SURFACE, kind: FINISH_PLASTER },
  { class: SURFACE, kind: FINISH_PAINT },
];

const OWED_KINDS: readonly string[] = CATALOGUE_ENTRIES.map((entry) => entry.kind);

describe("AC-1: the masonry area is registered — kinds, classes, bears and the emitted tables", () => {
  test("AC-1: the closed kind roster admits the three, and each names a trade and material only", async () => {
    const kinds = await productModule<{ KINDS: readonly string[]; isKind: (value: unknown) => boolean }>(KINDS_MODULE);
    const law = await productModule<{ offendingTokens: (name: string) => readonly { token: string; vocabulary: string }[] }>(KIND_LAW_MODULE);

    for (const kind of OWED_KINDS) {
      expect([...kinds.KINDS], `the closed catalogue holds \`${kind}\` — a kind exists because this roster names it (L-MEA-04)`).toContain(kind);
      expect(kinds.isKind(kind), "and its guard admits it — the closed list and its guard are one statement").toBe(true);
      expect(
        law.offendingTokens(kind),
        `\`${kind}\` names a trade and material only — never a dimension, a unit, an element class, a pricing role or a book code (L-MEA-04, riskNotes (3): \`brick\` and \`wall\` become element words once \`brick_wall\` exists)`,
      ).toEqual([]);
    }
    expect(new Set(kinds.KINDS).size, "the roster names each kind once").toBe(kinds.KINDS.length);
  });

  test("AC-1: the closed class roster admits brick_wall and surface", async () => {
    const classes = await productModule<{ ELEMENT_TYPES: readonly string[]; isElementType: (value: unknown) => boolean }>(CLASSES_MODULE);
    for (const elementType of OWED_CLASSES) {
      expect([...classes.ELEMENT_TYPES], `the closed roster holds \`${elementType}\` — the class this leaf measures (L-MEA-04)`).toContain(elementType);
      expect(classes.isElementType(elementType), "and its guard admits it").toBe(true);
    }
    expect(new Set(classes.ELEMENT_TYPES).size, "the roster names each class once").toBe(classes.ELEMENT_TYPES.length);
  });

  test("AC-1: BEARS gains exactly the three rows of this leaf's grid, and neither class is unborne any more", async () => {
    const bears = await productModule<{ BEARS: readonly { class: string; kind: string }[]; UNBORNE: readonly string[] }>(BEARS_MODULE);
    const owed = OWED_BEARS.map((row) => `${row.class}|${row.kind}`).sort();
    const carried = bears.BEARS.map((row) => `${row.class}|${row.kind}`);

    // `BEARS` is an APPEND: R-TO-032 schedules more for these very classes (a brick wall is
    // plastered on both faces once F-ARCH brings rooms), so the equality is scoped to the GRID this
    // leaf owns — its two classes crossed with its three kinds — never to a class-wide or kind-wide
    // sweep that would read a later leaf's lawful row as a defect (B-19, B-20).
    const grid = bears.BEARS.filter((row) => OWED_CLASSES.includes(row.class) && OWED_KINDS.includes(row.kind))
      .map((row) => `${row.class}|${row.kind}`)
      .sort();
    expect(
      grid,
      "over its own two classes and three kinds the relation names exactly these three — so the three cells that stay empty stay empty by RULE: a brick wall bears no finish here, because a finish is borne by the SURFACE that is applied to it (riskNotes (3), L-MEA-03)",
    ).toEqual(owed);

    for (const row of owed) {
      expect(carried, `\`${row}\` stands in the relation — the rows this leaf lands are never quietly dropped by a later append (AM-11)`).toContain(row);
    }
    expect(
      carried.length,
      `the relation holds no (class, kind) twice — it is assembled by enumeration, and a repeated pair would bill one cell twice (AM-11); it carried ${JSON.stringify(carried.filter((pair, at) => carried.indexOf(pair) !== at))}`,
    ).toBe(new Set(carried).size);

    for (const elementType of OWED_CLASSES) {
      expect(
        [...bears.UNBORNE],
        `\`${elementType}\` is no longer declared unborne — the unborne set is derived from the relation, so a class that gains a kind leaves it on the same edit (L-MEA-04, B-19)`,
      ).not.toContain(elementType);
    }
  });

  test("AC-1: the three total maps stay total, and say what each new kind is measured in", async () => {
    const kinds = await productModule<{ KINDS: readonly string[] }>(KINDS_MODULE);
    const catalogue = await productModule<{ WORK_ITEM_CATALOGUE: Record<string, { description: string; dimension: string; canonicalUnit: string; documentPrecision: number }> }>(
      CATALOGUE_MODULE,
    );
    const maps = await productModule<{ KIND_DISCIPLINE: Record<string, string>; KIND_ALGEBRA: Record<string, string>; ALGEBRAS: readonly string[] }>(CATALOGUE_MAPS_MODULE);
    const sheets = await productModule<{ DISCIPLINES: readonly string[] }>(SHEETS_LAW_MODULE);
    const { CANONICAL_UNIT } = await canon();

    // TOTAL means total: every kind the roster closes over, not just the three this leaf lands — a
    // kind neither map answers for is a kind nothing can take off (L-MEA-04).
    for (const kind of kinds.KINDS) {
      expect(catalogue.WORK_ITEM_CATALOGUE[kind], `the catalogue states what a ${kind} quantity is`).toBeTruthy();
      expect(maps.KIND_DISCIPLINE[kind], `a discipline is authoritative for ${kind}`).toBeTruthy();
      expect([...sheets.DISCIPLINES], `and it is one of the sheet law's own disciplines — never a second spelling beside them (B-17)`).toContain(maps.KIND_DISCIPLINE[kind]);
      expect([...maps.ALGEBRAS], `${kind} is computed by one of the declared algebras (L-MEA-08)`).toContain(maps.KIND_ALGEBRA[kind]);
    }

    for (const entry of CATALOGUE_ENTRIES) {
      const item = catalogue.WORK_ITEM_CATALOGUE[entry.kind];
      expect(item?.dimension, `${entry.kind} is a ${entry.dimension} (interfaces)`).toBe(entry.dimension);
      expect(item?.canonicalUnit, `measured in the canonical unit of its dimension, and in nothing else (B-17)`).toBe(CANONICAL_UNIT[entry.dimension]);
      expect(item?.documentPrecision, `documented to ${String(entry.precision)} places (interfaces)`).toBe(entry.precision);
      expect(typeof item?.description === "string" && (item?.description ?? "").length > 0, `and says in words what is measured of it (L-MEA-04)`).toBe(true);
      expect(
        maps.KIND_ALGEBRA[entry.kind],
        `${entry.kind} is a \`${entry.algebra}\` quantity — a brick wall is a member measured section × run, a finish is a FACE of a space measured gross less scheduled openings (L-MEA-08, L-MEA-03)`,
      ).toBe(entry.algebra);
    }
  });

  test("AC-1: the committed catalogue tables are what the emitter renders from those consts, and the drift stage is green", async () => {
    const emitter = await productModule<{ emittedTables: () => Record<string, string>; CATALOGUE_FILES: readonly string[] }>(CATALOGUE_EMIT_MODULE);
    const rendered = emitter.emittedTables();
    for (const file of emitter.CATALOGUE_FILES) {
      // white-box: AC-1 — the committed table is one of the copies the criterion says must agree, so
      // it is read as DATA and compared with what the product's own emitter renders. No source text
      // is judged: every behavioural claim about the catalogue is asked of the consts above.
      const committed = readFileSync(join(REPO_ROOT, CATALOGUE_DIR, file), "utf8");
      expect(
        committed,
        `${CATALOGUE_DIR}/${file} is what \`emittedTables()\` renders — re-emit it in a \`baseline:\` commit (\`pnpm tsx tests/catalogue/emit-catalogue.ts\`, L-MEA-04)`,
      ).toBe(rendered[file]);
    }

    // And what it renders carries this leaf's kinds: a tree whose rosters grew and whose tables were
    // not re-emitted is exactly the drift the two stages below exist to catch (AC-1).
    for (const kind of OWED_KINDS) {
      expect(
        Object.values(rendered).join("\n"),
        `the emitted catalogue names \`${kind}\` — the tables are emitted FROM the consts, so a kind the code closes over and the tables do not is drift (L-MEA-04)`,
      ).toContain(kind);
    }

    const stage = spawnSync(process.execPath, [join(REPO_ROOT, CATALOGUE_DRIFT_SCRIPT)], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    expect(
      stage.status,
      `\`node ${CATALOGUE_DRIFT_SCRIPT}\` passes over the committed catalogue — a table re-emitted without re-recording its digest is drift (C-06):\n${`${stage.stdout ?? ""}${stage.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
  });
});

/* ======================================================================= F-ARCH's vocabulary */

/**
 * ARCH-2 — F-ARCH's vocabulary, registered: one class and three kinds APPENDED to the closed rosters,
 * the three `bears` rows the surface gains, the two total maps answering for them, and the four
 * method pairs the registry resolves for them (R-TO-036, AM-16(4), L-MEA-03, L-MEA-04; I-540 …
 * I-543). The store's half — the CHECKs re-stated and the rows seeded — is
 * tests/catalogue/arch-vocabulary-store.test.ts, in the database lane.
 */

/** The last member of each roster before this vocabulary landed: everything it adds stands after it. */
const LAST_KIND_BEFORE = "rcc.rebar";
const LAST_CLASS_BEFORE = SURFACE;

/** What each new kind is, as the catalogue must state it (I-541). */
const ARCH_CATALOGUE: readonly { kind: string; dimension: string; precision: number }[] = [
  { kind: FINISH_FLOORING, dimension: AREA, precision: 2 },
  { kind: FINISH_TILING, dimension: AREA, precision: 2 },
  { kind: FINISH_SKIRTING, dimension: LENGTH, precision: 2 },
];

/** The two classes the vocabulary's grid crosses: the one that bears the finishes, and the new one. */
const ARCH_CLASSES: readonly string[] = [SURFACE, OPENING];

describe("ARCH-2: F-ARCH's vocabulary — the opening class and three finish kinds a surface bears", () => {
  test("the three kinds are appended in one run after every kind that stood before them, each lawfully named", async () => {
    const kinds = await productModule<{ KINDS: readonly string[]; isKind: (value: unknown) => boolean }>(KINDS_MODULE);
    const law = await productModule<{ offendingTokens: (name: string) => readonly { token: string; vocabulary: string }[] }>(KIND_LAW_MODULE);
    const before = kinds.KINDS.indexOf(LAST_KIND_BEFORE);
    expect(before, `\`${LAST_KIND_BEFORE}\` still stands in the roster`).toBeGreaterThanOrEqual(0);
    expect(
      kinds.KINDS.slice(before + 1, before + 1 + ARCH_FINISH_KINDS.length),
      "the three stand right after the rebar, in one run — APPENDED, so no bill's group ordinal moves (AM-14 §2 numbers groups in this roster's order)",
    ).toEqual([...ARCH_FINISH_KINDS]);
    for (const kind of ARCH_FINISH_KINDS) {
      expect(kinds.isKind(kind), `the guard admits \`${kind}\``).toBe(true);
      expect(law.offendingTokens(kind), `\`${kind}\` names a trade and material only (L-MEA-04)`).toEqual([]);
    }
  });

  test("the opening class is appended after the surface and bears nothing yet: it stands in the unborne set", async () => {
    const classes = await productModule<{ ELEMENT_TYPES: readonly string[]; isElementType: (value: unknown) => boolean }>(CLASSES_MODULE);
    const bears = await productModule<{ BEARS: readonly { class: string; kind: string }[]; UNBORNE: readonly string[] }>(BEARS_MODULE);
    expect(
      classes.ELEMENT_TYPES[classes.ELEMENT_TYPES.indexOf(LAST_CLASS_BEFORE) + 1],
      "`opening` stands right after `surface` — appended, so no bill's group ordinal moves (AM-14 §2)",
    ).toBe(OPENING);
    expect(classes.isElementType(OPENING), "and its guard admits it").toBe(true);
    expect(
      bears.BEARS.filter((row) => row.class === OPENING),
      "no row names the opening yet — what a door or a window is billed as lands with the rail that counts it (I-540)",
    ).toEqual([]);
    expect([...bears.UNBORNE], "so it is DECLARED unborne, never silently absent (L-MEA-04)").toContain(OPENING);
  });

  test("a kind may not spell `opening` any more: the class is a word of the element vocabulary", async () => {
    const law = await productModule<{ offendingTokens: (name: string) => readonly { token: string; vocabulary: string }[] }>(KIND_LAW_MODULE);
    expect(
      law.offendingTokens("joinery.opening").map((offence) => ({ token: offence.token, vocabulary: offence.vocabulary })),
      "the kind law reads the class roster as a vocabulary a kind may not borrow from, so the new class is refused in a kind's name with no edit to the law (L-MEA-04, B-19)",
    ).toContainEqual({ token: OPENING, vocabulary: "element" });
  });

  test("over the surface and the opening crossed with the three kinds, the relation holds exactly the surface's three rows", async () => {
    const bears = await productModule<{ BEARS: readonly { class: string; kind: string }[] }>(BEARS_MODULE);
    const grid = bears.BEARS.filter((row) => ARCH_CLASSES.includes(row.class) && ARCH_FINISH_KINDS.includes(row.kind))
      .map((row) => `${row.class}|${row.kind}`)
      .sort();
    expect(grid, "a finish is borne by the face it is applied to — the surface — and never by the opening cut out of it (L-MEA-03)").toEqual(
      ARCH_FINISH_KINDS.map((kind) => `${SURFACE}|${kind}`).sort(),
    );
    const carried = bears.BEARS.map((row) => `${row.class}|${row.kind}`);
    expect(carried.length, "and the relation still holds no pair twice (AM-11)").toBe(new Set(carried).size);
  });

  test("the two total maps answer ARCHITECTURAL and `face` for each kind, and the catalogue states each in its dimension's canonical unit", async () => {
    const catalogue = await productModule<{ WORK_ITEM_CATALOGUE: Record<string, { description: string; dimension: string; canonicalUnit: string; documentPrecision: number }> }>(
      CATALOGUE_MODULE,
    );
    const maps = await productModule<{ KIND_DISCIPLINE: Record<string, string>; KIND_ALGEBRA: Record<string, string> }>(CATALOGUE_MAPS_MODULE);
    const { CANONICAL_UNIT } = await canon();
    for (const entry of ARCH_CATALOGUE) {
      expect(maps.KIND_DISCIPLINE[entry.kind], `${entry.kind} is stated by the architect's set — the room finish schedule and the plan (L-MEA-04)`).toBe("ARCHITECTURAL");
      expect(maps.KIND_ALGEBRA[entry.kind], `${entry.kind} is a face of a space, measured off the room less its openings (L-MEA-08)`).toBe("face");
      const item = catalogue.WORK_ITEM_CATALOGUE[entry.kind];
      expect(item?.dimension, `${entry.kind} is a ${entry.dimension}`).toBe(entry.dimension);
      expect(item?.canonicalUnit, "in the canonical unit of its dimension and nothing else (B-17)").toBe(CANONICAL_UNIT[entry.dimension]);
      expect(item?.documentPrecision, `written to ${String(entry.precision)} places`).toBe(entry.precision);
      expect((item?.description ?? "").length, "and says in words what is measured of it — the description is the method of measurement (L-BD-01)").toBeGreaterThan(0);
    }
  });

  test("the emitted catalogue carries the three work items and the surface's three rows", async () => {
    const emitter = await productModule<{ emittedRows: () => Record<string, readonly Record<string, string | number>[]> }>(CATALOGUE_EMIT_MODULE);
    const rows = emitter.emittedRows();
    const items = (rows["work-items.json"] ?? []).map((row) => String(row["kind"]));
    const pairs = (rows["bears.json"] ?? []).map((row) => `${String(row["class"])}|${String(row["kind"])}`);
    for (const kind of ARCH_FINISH_KINDS) {
      expect(items, `the work-item table names \`${kind}\``).toContain(kind);
      expect(pairs, `the bears table names (surface, ${kind})`).toContain(`${SURFACE}|${kind}`);
    }
    expect(pairs.some((pair) => pair.startsWith(`${OPENING}|`)), "and no bears row names the opening").toBe(false);
  });

  test("every method the vocabulary lands measures a kind the surface bears, through the finish's own channel", async () => {
    const bears = await productModule<{ BEARS: readonly { class: string; kind: string }[] }>(BEARS_MODULE);
    const borne = new Set(bears.BEARS.filter((row) => row.class === SURFACE).map((row) => row.kind));
    const measured = new Set<string>();
    for (const pair of ARCH_FINISH_PAIRS) {
      const method = (await masonryMethod(pair)) as unknown as { kind: string; deductionChannels: readonly string[] };
      expect(
        borne.has(method.kind),
        `${pair.ruleId}@${pair.version} measures \`${method.kind}\`, which the surface bears — a method for a kind no class bears could publish no line (L-MEA-04)`,
      ).toBe(true);
      expect([...method.deductionChannels], `${pair.ruleId} deducts through the finish's channel, whose threshold is the finish's own (L-MEA-01)`).toEqual(["finish_opening"]);
      measured.add(method.kind);
    }
    expect(
      [...measured].sort(),
      "the floor finish and the three finishes of a room's walls: the skirting has no method yet — its cells read NOT_ESTABLISHED until one lands (I-541)",
    ).toEqual([FINISH_FLOORING, FINISH_PAINT, FINISH_PLASTER, FINISH_TILING].sort());
  });
});
