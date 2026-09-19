/**
 * The acceptance's own reach into the band lane (AC-1, AC-2) — mechanics only, nothing judged here.
 *
 * Every module this increment lands is loaded BY PATH at the moment a case asks for it, so a file the
 * Builder has not written yet fails that case as an assertion naming the file rather than killing the
 * collection: `tests/golden/support/band-stage.ts`, `src/modules/takeoff/validation/**` and the
 * fixture readers alike. Nothing here reads product source; nothing here judges the product.
 *
 * The specifiers are repeated as LITERALS at the `productModule(...)` calls on purpose:
 * scripts/lib/pg-suites.mjs derives which lane collects a suite by reading the ARGUMENT of that call,
 * and a constant it cannot read would leave a suite that reaches the live-database harness in the
 * unit lane, which opens no database (ARCH-02, the lane split).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/** tests/takeoff/validation/support/ → the checkout. */
export const REPO_ROOT: string = join(import.meta.dirname, "..", "..", "..", "..");

/** The band lane's support this increment lands, and the fixture reader it spells cells through. */
export const BAND_STAGE = "tests/golden/support/band-stage.ts";
export const BOQ_STAGE = "tests/takeoff/boq/support/boq-stage.ts";

/** The validation module and its pure law (interfaces). */
export const VALIDATION_MODULE = "src/modules/takeoff/validation/index.ts";
export const VALIDATION_LAW = "src/modules/takeoff/validation/law.ts";

/** The homes already in the tree this acceptance drives. */
export const CANON_MODULE = "src/core/units/canon.ts";
export const OFFERS_LAW_MODULE = "src/core/offers/law.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const SCHEMA_VALIDATION_MODULE = "src/core/db/schema-validation.ts";
export const DB_ROSTER_MODULE = "src/core/db.ts";
export const DB_SCHEMA_VALIDATION_MODULE = "db/schema/validation.ts";

/** The two fixtures AM-01 put in the tree, by the id `goldenRows` takes. */
export const BNBC = "rcc6-bnbc";
export const RCC6 = "rcc6";

/** The fixture evidence a case reads: the site facts entered, and the converter that read a drawing. */
export const BNBC_SITE = "fixtures/rcc6-bnbc/site.json";
export const CAD_PYPROJECT = "cad/pyproject.toml";

/** The ledger's own table, and the refusal an unadmitted provenance earns (interfaces). */
export const VALIDATION_OBSERVATIONS_TABLE = "validation_observations";
export const VALIDATION_PROVENANCE_UNKNOWN = "VALIDATION_PROVENANCE_UNKNOWN";

/** The engine this increment validates (L-QTY-03's roster, `ENGINES`). */
export const VECTOR = "VECTOR";

/**
 * Import a module of this checkout by repo-relative path, asserting it stands first — so a module
 * this increment has yet to land fails the case that wanted it, by name.
 */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — this increment does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** One level of one cell, as the band lane reads the golden's own figure for it (interfaces). */
export type CellLevel = { level: string; golden: string };

/** One level graded, as `gradeCell` answers it (interfaces). */
export type LevelReading = { level: string; golden: string; measured: string };
export type GradedLevel = LevelReading & { verdict: string };

/** The band lane's support, seen through the surface this acceptance drives (interfaces). */
export type BandStage = {
  BAND_ENGINE: string;
  stageBnbcBand: () => Promise<unknown>;
  stageRcc6Band: () => Promise<unknown>;
  measureBand: (staged: unknown) => Promise<unknown>;
  goldenCellsOf: (fixtureId: string) => Map<string, readonly CellLevel[]>;
  converterVersionOf: (staged: unknown) => string;
};

/** The band lane's support, with the calls the criteria name proved to be there. */
export async function bandStage(): Promise<BandStage> {
  const door = await productModule<Record<string, unknown>>("tests/golden/support/band-stage.ts");
  for (const call of ["stageBnbcBand", "stageRcc6Band", "measureBand", "goldenCellsOf", "converterVersionOf"]) {
    expect(typeof door[call], `${BAND_STAGE} publishes \`${call}\` (interfaces)`).toBe("function");
  }
  expect(typeof door["BAND_ENGINE"], `${BAND_STAGE} publishes \`BAND_ENGINE\` (interfaces)`).toBe("string");
  return door as unknown as BandStage;
}

/** The ONE map a golden's upper-case words are spelled into the product's rosters through. */
export type GoldenSpellings = { GOLDEN_CLASS: Readonly<Record<string, string>>; GOLDEN_KIND: Readonly<Record<string, string>> };

/**
 * The spelling map the band lane is required to read cells through — asked of the tree's one home for
 * it rather than typed here, so this acceptance and the lane compare the same words (B-19).
 */
export async function goldenSpellings(): Promise<GoldenSpellings> {
  const door = await productModule<Record<string, unknown>>("tests/takeoff/boq/support/boq-stage.ts");
  for (const map of ["GOLDEN_CLASS", "GOLDEN_KIND"]) {
    expect(typeof door[map], `${BOQ_STAGE} publishes \`${map}\` — the one map a golden word is spelled through (interfaces)`).toBe("object");
  }
  return door as unknown as GoldenSpellings;
}

/** One exact decimal, as the canon's arithmetic hands it back (B-07, L-FRM-06). */
export type ExactValue = { plus: (other: string) => ExactValue; eq: (other: string) => boolean; toString: () => string };

/** The exact-decimal arithmetic every figure in this acceptance is compared in (B-07, L-FRM-06). */
export type Canon = { exact: (value: string) => ExactValue };

/** The canon's own arithmetic — never `Number`, on either side of a comparison. */
export async function canon(): Promise<Canon> {
  const door = await productModule<Record<string, unknown>>("src/core/units/canon.ts");
  expect(typeof door["exact"], `${CANON_MODULE} publishes \`exact\``).toBe("function");
  return door as unknown as Canon;
}

/** Are these two decimal strings the same number, whatever either of them prints? */
export function sameFigure(left: string, right: string, exact: Canon["exact"]): boolean {
  return exact(left).eq(right);
}

/** The exact sum of decimal strings, in the canon's arithmetic. */
export function sumExact(values: readonly string[], exact: Canon["exact"]): string {
  let total = exact("0");
  for (const value of values) total = exact(total.toString()).plus(value);
  return total.toString();
}

/** The key a cell stands under: the product's class and kind, joined as the band lane joins them. */
export function cellKey(elementClass: string, kind: string): string {
  return `${elementClass}|${kind}`;
}

/** The six figures `fixtures/rcc6-bnbc/site.json` states, and the note they were read off. */
export type SiteEvidence = { facts: Readonly<Record<string, string>>; source: string };

/** The fixture's own site facts, read from the fixture (never transcribed here). */
export function siteEvidence(): SiteEvidence {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, BNBC_SITE), "utf8")) as { facts?: Record<string, string>; source?: string };
  expect(typeof parsed.facts, `${BNBC_SITE} states the site facts a campaign over F-RCC6-BNBC is staged with (AM-06 §1)`).toBe("object");
  expect(typeof parsed.source, `${BNBC_SITE} states the note every entry cites (AM-06 §1)`).toBe("string");
  return { facts: parsed.facts ?? {}, source: parsed.source ?? "" };
}

/**
 * The cad converter's own version, read from the pin that defines it — the citation a TRANSCRIBED
 * campaign's observations carry, since no ingest read a drawing for it (riskNotes).
 */
export function cadConverterVersion(): string {
  const text = readFileSync(join(REPO_ROOT, CAD_PYPROJECT), "utf8");
  const stated = /^\s*version\s*=\s*"([^"]+)"/m.exec(text)?.[1] ?? "";
  expect(stated.length, `${CAD_PYPROJECT} states the converter's version — the figure a transcribed campaign cites (riskNotes)`).toBeGreaterThan(0);
  return stated;
}
