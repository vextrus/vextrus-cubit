// @vitest-environment node
/**
 * The recorded corpus and its roster agree (Q-08, L-AI-01): every fixture in `fixtures/model/` is
 * named by `corpus.json` and every roster line has its file; each fixture is the file format the
 * transport reads, filed under its own request hash, answering a closed question the product
 * asks; and the roster's own request hashes are lowercase sha256 hex. A fixture nobody rostered
 * is a recording nobody can account for; a roster line with no file is a replay that will refuse.
 *
 * The subdirectory `sheet-understanding/` is that increment's own corpus root (its acceptance
 * addresses it by path) and is not read here: the product's lanes read the root flat.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_IDS } from "../../src/core/model-ledger.types";
import { MODEL_QUESTION_NAMES } from "../../src/core/model/questions";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const CORPUS_ROOT = join(REPO_ROOT, "fixtures", "model");
const ROSTER = join(CORPUS_ROOT, "corpus.json");

const SHA256_HEX = /^[0-9a-f]{64}$/;

type RosterLine = { requestHash: string; question: string; subject: string; recordedOn: string; provider: string | null; inputTokens: number; outputTokens: number; attributedCost: string };
type Roster = { fixtures: RosterLine[] };

function roster(): Roster {
  expect(existsSync(ROSTER), `${ROSTER} is the corpus's roster and must exist, even empty`).toBe(true);
  return JSON.parse(readFileSync(ROSTER, "utf8")) as Roster;
}

function fixtureFiles(): string[] {
  return readdirSync(CORPUS_ROOT)
    .filter((name) => name.endsWith(".json") && name !== "corpus.json")
    .sort();
}

describe("fixtures/model — the corpus and its roster", () => {
  it("names every fixture file exactly once, and every line has its file", () => {
    const lines = roster().fixtures;
    const named = lines.map((line) => `${line.requestHash}.json`).sort();
    expect(new Set(named).size, "a request hash is rostered once").toBe(named.length);
    expect(named, "the roster and the directory list the same fixtures").toEqual(fixtureFiles());
  });

  it("every line is a lowercase sha256 hash answering a closed question the product asks, with the day it was recorded", () => {
    for (const line of roster().fixtures) {
      expect(line.requestHash, `${line.requestHash} is a request hash`).toMatch(SHA256_HEX);
      expect(MODEL_QUESTION_NAMES as readonly string[], `${line.requestHash} answers a question the product asks`).toContain(line.question);
      expect(line.subject.length, `${line.requestHash} says what it was asked about`).toBeGreaterThan(0);
      expect(line.recordedOn, `${line.requestHash} says when it was recorded`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every fixture file is the file format the transport reads, filed under its own hash and a pinned id", () => {
    for (const name of fixtureFiles()) {
      const parsed = JSON.parse(readFileSync(join(CORPUS_ROOT, name), "utf8")) as Record<string, unknown>;
      expect(`${String(parsed["requestHash"])}.json`, `${name} is filed under the hash it names`).toBe(name);
      expect(MODEL_IDS as readonly string[], `${name} names a pinned model id (AS-05)`).toContain(parsed["modelId"]);
      expect(Object.hasOwn(parsed, "payload"), `${name} carries a payload`).toBe(true);
      expect(Number.isSafeInteger(parsed["inputTokens"]) && Number.isSafeInteger(parsed["outputTokens"]), `${name} counts its tokens`).toBe(true);
    }
  });
});
