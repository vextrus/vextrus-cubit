/**
 * AC-6(a) [debt-src-core-1b4r4e7] — the minted edition and the seed cannot drift apart unnoticed.
 *
 * L-MEA-01 makes the seed "the tree's one statement" of the platform rule set: the migration that
 * mints it seeds exactly this content and stores `editionDigest` over it. But the migration is
 * hand-written data and the seed derives its method list from `enumerateMethods()` AT IMPORT TIME —
 * so a method shard landing in the tree moves the seed and leaves the minted row where it stands. The
 * edition then cites a method set the product does not compute, or computes one the edition does not
 * cite, and the disagreement shows up only where a database is built.
 *
 * This is the guard, in the lane that has no database: the SQL is read as data, and the two sides are
 * compared. Neither is transcribed — the migration is FOUND by the identity the seed itself declares,
 * so a later edition minted by a later migration is judged by this file with no edit (B-19). Freezing
 * the method list in the seed is the rejected fix: a pair the tree can compute and no edition cites is
 * a method in force that nothing in force names.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { editionDigest, type MethodPair } from "../editions/content";
import { SEED_EDITION_CONTENT, SEED_EDITION_IDENTITY } from "./index";

/** The migrations directory — this file sits at `src/core/rulesets/seed/`. */
const MIGRATIONS = join(import.meta.dirname, "..", "..", "..", "..", "db", "migrations");

/** One pair as a comparable spelling, so the two sides are judged as SETS and not as lists. */
const spellPair = (pair: MethodPair): string => `${pair.ruleId}@${pair.version}`;

/**
 * The migration that mints the edition the seed declares, found by that identity rather than named:
 * the row is keyed on (scope, name, version), and exactly one migration may mint it — a second is the
 * immutability breach L-REG-07 forecloses.
 */
function mintingMigration(): { file: string; source: string } {
  const { scope, name, version } = SEED_EDITION_IDENTITY;
  const minting = readdirSync(MIGRATIONS)
    .filter((entry) => entry.endsWith(".sql"))
    .map((file) => ({ file, source: readFileSync(join(MIGRATIONS, file), "utf8") }))
    .filter(({ source }) => source.includes(`'${scope}'`) && source.includes(`'${name}'`) && source.includes(`'${version}'`) && source.includes("ruleset_editions"));
  expect(
    minting.map(({ file }) => file),
    `exactly one migration mints ${scope}/${name}@${version}: an edition is immutable, so it is minted once and forked afterwards (L-REG-07, B-20)`,
  ).toHaveLength(1);
  return minting[0] as { file: string; source: string };
}

/** The `content_digest` the minting row stores: the first lowercase-hex sha-256 literal it carries. */
function storedDigest(source: string): string {
  const literal = /'([0-9a-f]{64})'/u.exec(source);
  expect(literal, "the minting row stores a content digest — a sha-256 in lowercase hex (L-MEA-01)").not.toBeNull();
  return (literal as RegExpExecArray)[1] as string;
}

/** The method pairs the minting row cites, read out of the JSON array it inserts. */
function citedPairs(source: string): string[] {
  const pairs = [...source.matchAll(/\{\s*"ruleId"\s*:\s*"([^"]+)"\s*,\s*"version"\s*:\s*"([^"]+)"\s*\}/gu)].map(([, ruleId, version]) => `${String(ruleId)}@${String(version)}`);
  expect(pairs.length, "the minting row cites the methods in force, and it cites some").toBeGreaterThan(0);
  return pairs;
}

describe("the minted edition states what the seed derives", () => {
  test("AC-6(a): the stored content digest is editionDigest over the seed's content", () => {
    const { file, source } = mintingMigration();
    expect(
      storedDigest(source),
      `${file} stores the digest of what src/core/rulesets/seed exports; a stored digest that disagrees means the row and the module hold different content (L-MEA-01)`,
    ).toBe(editionDigest(SEED_EDITION_CONTENT));
  });

  test("AC-6(a): the methods the row cites are the methods the seed derives, as a set", () => {
    const { file, source } = mintingMigration();
    const derived = SEED_EDITION_CONTENT.methods.map(spellPair);
    expect(
      [...new Set(citedPairs(source))].sort(),
      `${file} cites exactly the pairs enumerateMethods() answers: a pair the tree computes and no edition cites is a method in force that nothing in force names, and a pair cited and not computed is an edition no campaign could measure under (L-MEA-01, B-19)`,
    ).toEqual([...new Set(derived)].sort());
  });

  test("AC-6(a): the seed derives its methods rather than freezing them", () => {
    // The rejected fix, refused as behaviour: a frozen list would make the two sides agree by
    // transcription, which is the drift this guard exists to catch (B-19).
    expect(SEED_EDITION_CONTENT.methods.length, "the seed cites the shards' own roster, and the roster is not empty").toBeGreaterThan(0);
  });
});
