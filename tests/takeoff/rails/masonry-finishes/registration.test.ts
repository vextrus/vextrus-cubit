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
  AREA,
  BEARS_MODULE,
  BRICK_WALL,
  CATALOGUE_DIR,
  CATALOGUE_DRIFT_SCRIPT,
  CATALOGUE_EMIT_MODULE,
  CATALOGUE_MAPS_MODULE,
  CATALOGUE_MODULE,
  CLASSES_MODULE,
  FINISH_PAINT,
  FINISH_PLASTER,
  KINDS_MODULE,
  KIND_LAW_MODULE,
  MASONRY_BRICKWORK,
  REPO_ROOT,
  SHEETS_LAW_MODULE,
  SURFACE,
  VOLUME,
  canon,
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
