/**
 * AC-2 and AC-3 — the work-item catalogue as code, and the three copies of it that must agree.
 *
 * AC-2 is the consts: the catalogue is total over `KINDS`, every entry's canonical unit is the one
 * its dimension fixes, `BEARS` names classes and kinds that exist, and `UNBORNE` is exactly the rest
 * of the element roster — derived by set arithmetic over `ELEMENT_TYPES` and `BEARS`, never
 * transcribed (B-19).
 *
 * AC-3 is the agreement between the copies: the texts the emitter renders, the files committed under
 * `db/catalogue/`, and the digest recorded beside them. The gate's own drift stage is then run for
 * real — `node scripts/catalogue-drift.mjs` — and asked for the line an ARMED lane prints, because a
 * lane with no catalogue in the tree exits 0 by skipping and a test that only read the exit code
 * would pass against nothing at all.
 *
 * The store's half of AC-3 — the migrated rows and the runtime role's privileges — is
 * `db/__tests__/catalogue.migration.test.ts`, which the database lane collects.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { digestOf, filesUnder } from "../../scripts/lib/digest.mjs";
import { REPO_ROOT, byCodePoint, canon, named, productModule, setOf } from "../units/support/canon";

const KINDS_FILE = "src/core/catalogue/kinds.ts";
const CLASSES_FILE = "src/core/catalogue/classes.ts";
const CATALOGUE_FILE = "src/core/catalogue/catalogue.ts";
const BEARS_FILE = "src/core/catalogue/bears.ts";
const EMIT_FILE = "src/core/catalogue/emit.ts";
const UNITS_HOME = "src/core/units";

/** Where the emitted tables are committed, and the one file among them that records their digest. */
const CATALOGUE_DIR = "db/catalogue";
const DIGEST_FILE = `${CATALOGUE_DIR}/digest.txt`;

/** The gate stage this increment arms, and the shape its armed line has (the test contract). */
const DRIFT_SCRIPT = "scripts/catalogue-drift.mjs";
const ARMED_LINE = /^ {2}(\d+) catalogue file\(s\) match ([0-9a-f]{64})$/m;

/** The rows AC-3 names, and the fields each table is identified by, for the sort the emitter owes. */
const WORK_ITEMS_JSON = "work-items.json";
const BEARS_JSON = "bears.json";
const IDENTITY: Readonly<Record<string, readonly string[]>> = { [WORK_ITEMS_JSON]: ["kind"], [BEARS_JSON]: ["class", "kind"] };

/** The pair AC-2 fixes by name. */
const COLUMN = "column";
const RCC_CONCRETE = "rcc.concrete";

type WorkItem = { readonly description: unknown; readonly dimension: unknown; readonly canonicalUnit: unknown; readonly documentPrecision: unknown };
type BearsRow = { readonly class: unknown; readonly kind: unknown };

type Catalogue = {
  readonly KINDS: readonly string[];
  readonly ELEMENT_TYPES: readonly string[];
  readonly DIMENSIONS: readonly string[];
  readonly CANONICAL_UNIT: Readonly<Record<string, unknown>>;
  readonly WORK_ITEM_CATALOGUE: Readonly<Record<string, WorkItem>>;
  readonly BEARS: readonly BearsRow[];
  readonly UNBORNE: Iterable<string>;
  readonly CATALOGUE_FILES: unknown;
  readonly emittedTables: () => unknown;
};

let loading: Promise<Catalogue> | undefined;

const catalogue = (): Promise<Catalogue> =>
  (loading ??= (async () => {
    const kinds = await productModule(KINDS_FILE);
    const classes = await productModule(CLASSES_FILE);
    const items = await productModule(CATALOGUE_FILE);
    const bears = await productModule(BEARS_FILE);
    const emit = await productModule(EMIT_FILE);
    const units = await canon();
    return {
      KINDS: named<readonly string[]>(kinds, "KINDS", KINDS_FILE),
      ELEMENT_TYPES: named<readonly string[]>(classes, "ELEMENT_TYPES", CLASSES_FILE),
      DIMENSIONS: named<readonly string[]>(units, "DIMENSIONS", UNITS_HOME),
      CANONICAL_UNIT: named<Readonly<Record<string, unknown>>>(units, "CANONICAL_UNIT", UNITS_HOME),
      WORK_ITEM_CATALOGUE: named<Readonly<Record<string, WorkItem>>>(items, "WORK_ITEM_CATALOGUE", CATALOGUE_FILE),
      BEARS: named<readonly BearsRow[]>(bears, "BEARS", BEARS_FILE),
      UNBORNE: named<Iterable<string>>(bears, "UNBORNE", BEARS_FILE),
      CATALOGUE_FILES: named<unknown>(emit, "CATALOGUE_FILES", EMIT_FILE),
      emittedTables: named<() => unknown>(emit, "emittedTables", EMIT_FILE),
    };
  })());

/** A file name, however the roster spells the path it stands at. */
const baseNameOf = (path: string): string => path.split("/").pop() ?? path;

/**
 * One row, reduced to what two spellings of it have in common: keys compared without their case or
 * their separators, values as the text they render to. A JSON table written `canonicalUnit` and a
 * column named `canonical_unit` are the same row, and this is what lets the acceptance say so
 * without deciding for the Builder which spelling the file carries.
 */
function normalisedRow(row: Record<string, unknown>): string {
  const pairs = Object.entries(row)
    .map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), String(value)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify(pairs);
}

/** A table of rows as a comparable, order-free set. */
const rowSet = (rows: readonly Record<string, unknown>[]): string[] => byCodePoint(rows.map(normalisedRow));

/** The emitted texts, keyed by the file name each is committed under. */
async function emittedByName(): Promise<Map<string, string>> {
  const { emittedTables } = await catalogue();
  const answer: unknown = await emittedTables();
  const entries: [string, unknown][] =
    answer instanceof Map ? [...answer.entries()].map(([key, value]) => [String(key), value]) : typeof answer === "object" && answer !== null ? Object.entries(answer) : [];
  expect(entries.length, "emittedTables() answers the rendered tables, keyed by the file each is committed under (AC-3)").toBeGreaterThan(0);
  const byName = new Map<string, string>();
  for (const [key, text] of entries) {
    expect(typeof text, `emittedTables() renders ${key} as the text of a file`).toBe("string");
    byName.set(baseNameOf(key), text as string);
  }
  return byName;
}

/** The files really committed under db/catalogue, the digest apart — the roster the drift stage digests. */
function committedFiles(): string[] {
  const directory = join(REPO_ROOT, CATALOGUE_DIR);
  expect(existsSync(directory), `${CATALOGUE_DIR} is missing from the tree — the emitted catalogue tables are not committed yet`).toBe(true);
  // white-box: AC-3 — WHICH files stand under db/catalogue is itself one of the criterion's claims
  // ("CATALOGUE_FILES names exactly the files emitted and committed"), and the drift stage digests
  // that same directory listing. Only the names are taken here, never the text of any source.
  return byCodePoint(readdirSync(directory).filter((name) => name !== "digest.txt"));
}

/** The text of a committed catalogue file. */
function committedText(name: string): string {
  const path = join(REPO_ROOT, CATALOGUE_DIR, name);
  expect(existsSync(path), `${CATALOGUE_DIR}/${name} is missing from the tree — the emitter has not written it`).toBe(true);
  // white-box: AC-3 — the criterion's subject IS the bytes of the committed table ("the committed
  // files under db/catalogue/ equal those texts byte for byte"), so the text is the observable and
  // there is no run-time behaviour to drive instead. These are emitted data tables, not source.
  return readFileSync(path, "utf8");
}

describe("AC-2: the catalogue consts are total and consistent", () => {
  test("AC-2: WORK_ITEM_CATALOGUE has exactly the members of KINDS as keys", async () => {
    const { KINDS, WORK_ITEM_CATALOGUE } = await catalogue();
    expect(
      byCodePoint(Object.keys(WORK_ITEM_CATALOGUE)),
      "the catalogue answers for every kind and for nothing else — a kind with no work item is a kind nothing can be measured for (L-MEA-04)",
    ).toEqual(byCodePoint(KINDS));
  });

  test("AC-2: every catalogue entry carries a description, a dimension, that dimension's canonical unit and a document precision", async () => {
    const { KINDS, DIMENSIONS, CANONICAL_UNIT, WORK_ITEM_CATALOGUE } = await catalogue();

    for (const kind of KINDS) {
      const entry = WORK_ITEM_CATALOGUE[kind];
      expect(entry, `the catalogue has an entry for ${JSON.stringify(kind)}`).toBeDefined();
      if (entry === undefined) continue;

      expect(typeof entry.description, `${kind}: description is text`).toBe("string");
      expect(String(entry.description).trim().length, `${kind}: description says something`).toBeGreaterThan(0);
      expect(DIMENSIONS, `${kind}: dimension is one of the physical dimensions (L-FRM-06)`).toContain(entry.dimension);
      expect(
        entry.canonicalUnit,
        `${kind}: the canonical unit is the one its dimension fixes — CANONICAL_UNIT[${String(entry.dimension)}] (L-FRM-06)`,
      ).toBe(CANONICAL_UNIT[String(entry.dimension)]);
      expect(Number.isInteger(entry.documentPrecision), `${kind}: documentPrecision is an integer number of places`).toBe(true);
      expect(Number(entry.documentPrecision), `${kind}: documentPrecision is not negative`).toBeGreaterThanOrEqual(0);
    }
  });

  test("AC-2: BEARS names element classes and kinds that exist, and says a column bears rcc.concrete", async () => {
    const { KINDS, ELEMENT_TYPES, BEARS } = await catalogue();

    expect(Array.isArray(BEARS), "BEARS is a list of class-to-kind rows").toBe(true);
    for (const row of BEARS) {
      expect(ELEMENT_TYPES, `BEARS names the class ${JSON.stringify(row.class)}, which must be a member of ELEMENT_TYPES`).toContain(row.class);
      expect(KINDS, `BEARS names the kind ${JSON.stringify(row.kind)}, which must be a member of KINDS`).toContain(row.kind);
    }
    // The per-kind bearer rule, not a count of the table. F-RCC6 fixes the column as the ONE class
    // that bears cast concrete, so the classes BEARS pairs with this kind are exactly that one and
    // every other element class is unborne FOR IT: a second bearer would have the same concrete
    // measured twice, and no bearer would leave it unmeasured. Asking BEARS only whether it holds
    // the column row would let a table that made every class bear rcc.concrete pass, and comparing
    // UNBORNE against BEARS alone is true of any such table by construction.
    //
    // Scoped to rcc.concrete's own bearers, never to the whole table, so a later increment that
    // gives another kind its bearing classes is not reddened here (B-19).
    expect(
      byCodePoint(setOf(BEARS.filter((row) => row.kind === RCC_CONCRETE).map((row) => String(row.class)))),
      `the column is the only class that bears ${RCC_CONCRETE} — every other element class is unborne for it (F-RCC6, L-MEA-04)`,
    ).toEqual([COLUMN]);
  });

  test("AC-2: UNBORNE is exactly the element classes BEARS does not name", async () => {
    const { ELEMENT_TYPES, BEARS, UNBORNE } = await catalogue();

    const borne = setOf(BEARS.map((row) => String(row.class)));
    const unborne = setOf([...UNBORNE].map(String));

    expect(
      byCodePoint(unborne),
      "UNBORNE is the element roster less the classes that bear a kind — derived, never listed (B-19)",
    ).toEqual(byCodePoint(ELEMENT_TYPES.filter((elementType) => !borne.has(elementType))));
    expect(
      byCodePoint([...unborne].filter((elementType) => borne.has(elementType))),
      "no class is both borne and unborne",
    ).toEqual([]);
    expect(
      byCodePoint(setOf([...borne, ...unborne])),
      "the borne classes and the unborne ones together exhaust ELEMENT_TYPES — every class is accounted for",
    ).toEqual(byCodePoint(setOf(ELEMENT_TYPES)));
  });
});

describe("AC-3: the emitted tables, the committed files and the digest agree", () => {
  test("AC-3: CATALOGUE_FILES names exactly the files emitted and committed under db/catalogue", async () => {
    const { CATALOGUE_FILES } = await catalogue();
    expect(Array.isArray(CATALOGUE_FILES), "CATALOGUE_FILES is the roster of the tables the emitter writes").toBe(true);
    const declared = byCodePoint((CATALOGUE_FILES as readonly unknown[]).map((entry) => baseNameOf(String(entry))));

    expect(declared, "the emitter's roster names the two tables AC-3 fixes").toEqual(byCodePoint([WORK_ITEMS_JSON, BEARS_JSON]));
    expect(byCodePoint((await emittedByName()).keys()), "the emitter renders a text for each file its roster names").toEqual(declared);
    expect(committedFiles(), "db/catalogue holds exactly the files the roster names, and the digest beside them").toEqual(declared);
  });

  test("AC-3: each committed table is the text the emitter renders, byte for byte", async () => {
    const emitted = await emittedByName();

    for (const [name, text] of emitted) {
      const committed = committedText(name);
      expect(committed, `db/catalogue/${name} is what the emitter renders — a hand edit here is drift (V-VERIFY)`).toBe(text);
      expect(Buffer.byteLength(committed, "utf8"), `db/catalogue/${name} matches the rendered text byte for byte`).toBe(Buffer.byteLength(text, "utf8"));
    }
  });

  test("AC-3: each table is 2-space JSON with a trailing newline, its rows in code-point order", async () => {
    const emitted = await emittedByName();

    for (const [name, text] of emitted) {
      expect(text.endsWith("\n"), `db/catalogue/${name} ends in a newline`).toBe(true);
      const rows: unknown = JSON.parse(text);
      expect(Array.isArray(rows), `db/catalogue/${name} is a list of rows`).toBe(true);
      expect(text, `db/catalogue/${name} is rendered as 2-space JSON with a trailing newline`).toBe(`${JSON.stringify(rows, null, 2)}\n`);

      const fields = IDENTITY[name] ?? [];
      const keyOf = (row: unknown): string => JSON.stringify(fields.map((field) => String((row as Record<string, unknown>)[field])));
      const keys = (rows as unknown[]).map(keyOf);
      expect(keys, `db/catalogue/${name} holds its rows in code-point order of ${fields.join(", ")} — a stable order is what makes the digest stable`).toEqual(
        byCodePoint(keys),
      );
    }
  });

  test("AC-3: the emitted rows are the consts, and nothing else", async () => {
    const { KINDS, WORK_ITEM_CATALOGUE, BEARS } = await catalogue();
    const emitted = await emittedByName();

    const workItems = JSON.parse(emitted.get(WORK_ITEMS_JSON) ?? "null") as Record<string, unknown>[] | null;
    expect(workItems, `${WORK_ITEMS_JSON} was rendered`).not.toBeNull();
    expect(rowSet(workItems ?? []), `${WORK_ITEMS_JSON} carries one row per kind, exactly as WORK_ITEM_CATALOGUE holds it`).toEqual(
      rowSet(
        KINDS.map((kind) => {
          const entry = WORK_ITEM_CATALOGUE[kind];
          return {
            kind,
            description: entry?.description,
            dimension: entry?.dimension,
            canonicalUnit: entry?.canonicalUnit,
            documentPrecision: entry?.documentPrecision,
          };
        }),
      ),
    );

    const bearsRows = JSON.parse(emitted.get(BEARS_JSON) ?? "null") as Record<string, unknown>[] | null;
    expect(bearsRows, `${BEARS_JSON} was rendered`).not.toBeNull();
    expect(rowSet(bearsRows ?? []), `${BEARS_JSON} carries exactly the rows BEARS holds`).toEqual(
      rowSet(BEARS.map((row) => ({ class: row.class, kind: row.kind }))),
    );
  });

  test("AC-3: digest.txt is the digest of every catalogue file but itself", async () => {
    await catalogue();
    const recordedPath = join(REPO_ROOT, DIGEST_FILE);
    expect(existsSync(recordedPath), `${DIGEST_FILE} is missing — the drift stage has nothing to compare against`).toBe(true);

    // white-box: AC-3 — the recorded digest is a content address OVER the committed bytes, so the
    // toolchain's own digest function is run over the same files the drift stage digests and the
    // recorded text is compared with what it answers. The subject is the recording, not source code.
    const sources = filesUnder(REPO_ROOT, join(REPO_ROOT, CATALOGUE_DIR), (relative: string) => relative !== DIGEST_FILE);
    expect(byCodePoint(sources.map(baseNameOf)), "the digest covers every committed table").toEqual(committedFiles());
    expect(
      readFileSync(recordedPath, "utf8").trim(),
      `${DIGEST_FILE} records the digest the toolchain's one digest function takes over the catalogue (scripts/lib/digest.mjs)`,
    ).toBe(digestOf(REPO_ROOT, sources));
  });

  test("AC-3: the gate's catalogue-drift stage runs armed and green", async () => {
    await catalogue();
    const run = spawnSync(process.execPath, [join(REPO_ROOT, DRIFT_SCRIPT)], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;

    const armed = ARMED_LINE.exec(output);
    expect(
      armed,
      `node ${DRIFT_SCRIPT} reports the lane ARMED — with no catalogue in the tree the stage exits 0 by skipping, which proves nothing (C-06, V-VERIFY). It said:\n${output}`,
    ).not.toBeNull();
    expect(run.status, `node ${DRIFT_SCRIPT} exits 0 on a tree whose catalogue matches its digest:\n${output}`).toBe(0);

    // white-box: AC-3 — the stage's stdout is the behaviour under test, and the count it prints is a
    // claim ABOUT the committed catalogue, so the same roster the stage digests is enumerated here to
    // say what that number had to be. File names only; no source text is judged.
    const sources = filesUnder(REPO_ROOT, join(REPO_ROOT, CATALOGUE_DIR), (relative: string) => relative !== DIGEST_FILE);
    expect(Number(armed?.[1]), "the stage counts every catalogue file but the digest").toBe(sources.length);
    // white-box: AC-3 — the stage's own stdout is the behaviour under test; the recorded digest is
    // read only to say which content address that line had to name.
    expect(armed?.[2], "the stage reports the digest recorded beside the catalogue").toBe(readFileSync(join(REPO_ROOT, DIGEST_FILE), "utf8").trim());
  });
});
