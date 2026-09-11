/**
 * AC-1 — the residue is a QUERY with ONE absence clause (L-QTY-05).
 *
 * The law has two halves and this suite drives both through the product's own committed scan: the
 * three channels answer with what they SAW — `Sighting[]`, empty when they saw nothing, and no
 * `absent()` constructor anywhere — and the one absence clause stands in the residue query and
 * nowhere else, least of all in a channel.
 *
 * The scan is the product's (`src/core/residue/__tests__/not-exists-scan.ts`); this file drives it
 * over the committed corpus that proves it fires (tests/lint-fixtures/residue-not-exists/bad.ts) and
 * over its lawful counterpart, then over the module the law governs. Nothing here re-implements the
 * scan: what is judged is what the scan reports.
 *
 * The module's own `__tests__` directory is not part of the corpus: a suite that names the spelling
 * in order to judge it is prose about the law, not a second home for it — this file itself says the
 * words, and so will the Builder's.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/** The seam under `residue.ts` opens a pool at import time; the address is stated, never dialled. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

const REPO_ROOT: string = process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd();

/** The module the law governs, the one file its absence clause may stand in, and the banned tree. */
const RESIDUE_ROOT = join("src", "core", "residue");
const THE_ONE_QUERY = join(RESIDUE_ROOT, "residue.ts");
const CHANNELS_ROOT = join(RESIDUE_ROOT, "channels");

/** The committed scan, and the corpus that proves it fires: tests/lint-fixtures/residue-not-exists/bad.ts. */
const SCAN_MODULE = join(RESIDUE_ROOT, "__tests__", "not-exists-scan.ts");
const CORPUS = join("tests", "lint-fixtures", "residue-not-exists");
const BAD = join(CORPUS, "bad.ts");
const GOOD = join(CORPUS, "good.ts");

/** The three recognisers of L-QTY-05, and the name no module of the residue may publish. */
const RECOGNISERS = ["registerSightings", "partitionSightings", "layoutSightings"] as const;
const BANNED_EXPORT = "absent";

type NotExistsHit = { file: string; line: number; spelling: string };
type Scan = { scanNotExists: (files: readonly string[]) => readonly NotExistsHit[] };

/** Import a product module by repo-relative path, asserting it exists first. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

async function scanner(): Promise<(files: readonly string[]) => readonly NotExistsHit[]> {
  const module_ = await productModule<Scan>(SCAN_MODULE);
  expect(typeof module_.scanNotExists, `${SCAN_MODULE} publishes scanNotExists, the committed scan L-QTY-05's ban is proved by`).toBe("function");
  return module_.scanNotExists;
}

/**
 * Every source file of one tree, as absolute paths — the scan is given the files it is to read, and
 * names each hit by the file it was given. `__tests__` is excluded: see the header.
 */
function sourcesUnder(relative: string): string[] {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} stands in the checkout — the residue the law governs`).toBe(true);
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory).sort()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      const here = join(directory, entry);
      if (statSync(here).isDirectory()) walk(here);
      else if (/\.(?:ts|tsx|mts)$/u.test(entry)) found.push(here);
    }
  };
  walk(absolute);
  return found;
}

/** What the scan reported, named by the repo-relative file each hit stands in. */
function reported(hits: readonly NotExistsHit[]): { file: string; line: number; spelling: string }[] {
  return hits.map((hit) => ({ file: hit.file.replace(`${REPO_ROOT}/`, ""), line: hit.line, spelling: hit.spelling }));
}

describe("AC-1: the committed scan fires on its corpus and stays silent on the lawful half", () => {
  test("AC-1: the scan reports the banned spelling in code and in string literals, on the bad fixture only", async () => {
    const scan = await scanner();
    const hits = reported(scan([join(REPO_ROOT, BAD)]));
    expect(hits.length, `the scan fires on ${BAD}, which spells the absence clause in a template literal, in both quote styles and as a helper name`).toBeGreaterThan(0);
    expect(
      hits.filter((hit) => !hit.file.endsWith("bad.ts")),
      "and it names the file it was given for every hit",
    ).toEqual([]);

    const spellings = hits.map((hit) => hit.spelling);
    expect(
      spellings.some((spelling) => /not\s+exists/iu.test(spelling)),
      `the SQL operator itself is reported — the scan reads string literals, where a query is written: ${JSON.stringify(spellings)}`,
    ).toBe(true);
    expect(
      spellings.some((spelling) => /notExists/u.test(spelling)),
      `and the camel-case spelling is reported too — the scan reads code, where a helper is named: ${JSON.stringify(spellings)}`,
    ).toBe(true);
  });

  test("AC-1: the scan stays silent on the lawful counterpart, which says the words only in prose", async () => {
    const scan = await scanner();
    expect(
      reported(scan([join(REPO_ROOT, GOOD)])),
      `${GOOD} names the clause only in a comment and answers with what it saw — a comment is not code (Q-17), so nothing may be reported`,
    ).toEqual([]);
  });
});

describe("AC-1: the absence clause stands once, in the residue query", () => {
  // white-box: AC-1 — the ban IS a property of the module's own text (L-QTY-05: "`NOT EXISTS` is
  // lint-banned inside the channel module and appears once, in the residue query"). No behaviour of
  // a running residue can distinguish a channel that asks for absence from one that does not, which
  // is why the law is committed as a scan; the assertion below is over what that scan reports.
  test("AC-1: exactly one hit under the residue, and it is the residue query's", async () => {
    const scan = await scanner();
    const hits = reported(scan(sourcesUnder(RESIDUE_ROOT)));
    expect(hits.length, `the residue spells its absence clause once: ${JSON.stringify(hits)}`).toBe(1);
    expect(hits[0]?.file, `and the one clause stands in ${THE_ONE_QUERY} — the query is the one place absence may be asked for`).toBe(THE_ONE_QUERY);
  });

  test("AC-1: nothing at all under the channels, which answer with what they saw", async () => {
    const scan = await scanner();
    expect(
      reported(scan(sourcesUnder(CHANNELS_ROOT))),
      "a recogniser that asks what it cannot see is a second home for the law (L-QTY-05)",
    ).toEqual([]);
  });
});

describe("AC-1: the three channels answer with sightings, never with an absence", () => {
  test("AC-1: each recogniser is published, and no module of the residue publishes an absent constructor", async () => {
    const barrel = await productModule<Record<string, unknown>>(join(RESIDUE_ROOT, "index.ts"));
    for (const recogniser of RECOGNISERS) {
      expect(typeof barrel[recogniser], `the residue publishes ${recogniser}, a recogniser whose output type is Sighting[] (L-QTY-05)`).toBe("function");
    }

    const publishing: string[] = [];
    for (const file of sourcesUnder(RESIDUE_ROOT)) {
      const module_ = (await import(file)) as Record<string, unknown>;
      if (Object.hasOwn(module_, BANNED_EXPORT)) publishing.push(file.replace(`${REPO_ROOT}/`, ""));
    }
    expect(
      publishing,
      `no module of the residue publishes \`${BANNED_EXPORT}\` — a recogniser answers with what it saw, and an empty array is the whole of "it saw nothing" (L-QTY-05)`,
    ).toEqual([]);
  });
});
