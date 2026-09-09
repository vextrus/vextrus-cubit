/**
 * AC-6 — the notation a Bangladeshi structural drawing writes its schedules in, read by pure
 * parsers over real strings (R-TO-031, L-CAD-08).
 *
 * The corpus is the contract. Every case is a committed file under `golden/`, one file per parser,
 * and this suite drives the parsers over what the corpus says rather than over a list written here:
 * a string added to the corpus is a case the moment it lands, and nothing is transcribed twice
 * (B-19). The parsers are reached through the barrel the placement leaf, the levels proposal and
 * the rails import them from — an export that moved is a break in the contract, not a detail.
 *
 * Nothing here touches a database, a model or the sheet: these are total functions over strings.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT } from "../support/partition-stage";
import {
  NOTATION_CALLS,
  NOTATION_MODULE,
  ZONE_MAIN,
  ZONE_TIES,
  ZONE_TIES_END,
  ZONE_TIES_MID,
  notationDoor,
  type NotationSeam,
} from "../support/schedules-stage";

/** The declared golden corpus (test contract: fixtures). */
const CORPUS = join("tests", "takeoff", "partition", "notation", "golden");

/** One case of the corpus: what was drawn, and what the parser named by the file answers for it. */
type GoldenCase = { input: string; expect: unknown };

/** One file of the corpus: which parser it pins, why, and its cases. */
type GoldenFile = { file: string; parser: string; cases: GoldenCase[] };

/** Every file of the committed corpus, in file order. */
function corpus(): GoldenFile[] {
  const root = join(REPO_ROOT, CORPUS);
  const files = readdirSync(root)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return files.map((name) => {
    const parsed = JSON.parse(readFileSync(join(root, name), "utf8")) as { parser?: unknown; cases?: unknown };
    expect(typeof parsed.parser, `${CORPUS}/${name} names the parser it pins`).toBe("string");
    expect(Array.isArray(parsed.cases), `${CORPUS}/${name} carries an array of { input, expect } cases`).toBe(true);
    return { file: `${CORPUS}/${name}`, parser: String(parsed.parser), cases: (parsed.cases ?? []) as GoldenCase[] };
  });
}

/** The corpus, read once — a file the acceptance names but the tree does not hold is a red here. */
const FILES: GoldenFile[] = corpus();

/** Every string the whole corpus draws, whichever parser it was written for. */
const EVERY_INPUT: string[] = [...new Set(FILES.flatMap((file) => file.cases.map((one) => one.input)))].sort((left, right) => (left < right ? -1 : 1));

/** One parser of the barrel, by the name the corpus calls it. */
function parserOf(notation: NotationSeam, name: string): (text: string) => unknown {
  const held = (notation as unknown as Record<string, unknown>)[name];
  expect(typeof held, `${NOTATION_MODULE} publishes \`${name}\` — the corpus names it, and the rails import it`).toBe("function");
  return held as (text: string) => unknown;
}

describe("AC-6: the notation barrel publishes every parser the corpus pins", () => {
  test("AC-6: every parser the test contract names is exported, and every corpus file names one of them", async () => {
    const notation = await notationDoor();
    expect(FILES.length, `the committed corpus under ${CORPUS} really carries files — an empty corpus would grade nothing`).toBeGreaterThan(0);
    for (const call of NOTATION_CALLS) expect(typeof parserOf(notation, call), `${NOTATION_MODULE} publishes \`${call}\``).toBe("function");
    for (const file of FILES) {
      expect(NOTATION_CALLS, `${file.file} pins \`${file.parser}\`, which is one of the parsers the test contract names`).toContain(file.parser);
      expect(file.cases.length, `${file.file} really carries cases`).toBeGreaterThan(0);
    }
    // Every parser the contract names is really pinned by a case, or its own contract proves nothing.
    expect(
      NOTATION_CALLS.filter((call) => !FILES.some((file) => file.parser === call)),
      `every parser the contract names is pinned by a corpus file; the corpus pins ${[...new Set(FILES.map((file) => file.parser))].join(", ")}`,
    ).toEqual([]);
  });

  test("AC-6: REBAR_ZONES is the closed list of zones a rebar column reads as", async () => {
    const notation = await notationDoor();
    expect(notation.REBAR_ZONES, `${NOTATION_MODULE} publishes REBAR_ZONES — the registry, the store's CHECK and the rails read one list (test contract)`).toBeTruthy();
    expect(
      new Set(notation.REBAR_ZONES ?? []),
      "and it holds exactly the four zones the rebar_zones CHECK admits (AC-4) — a zone the store would refuse is not a zone a parser may answer",
    ).toEqual(new Set([ZONE_MAIN, ZONE_TIES, ZONE_TIES_END, ZONE_TIES_MID]));

    const answered = new Set(EVERY_INPUT.map((input) => notation.rebarZoneOfHeader(input)).filter((zone): zone is string => zone !== null));
    expect(answered.size, "the corpus really names rebar columns — with none, the list below would be compared against nothing").toBeGreaterThan(0);
    expect(
      [...answered].filter((zone) => !(notation.REBAR_ZONES ?? []).includes(zone)),
      "and every zone the parser answers over the whole corpus is a member of that list",
    ).toEqual([]);
  });
});

describe("AC-6: every golden case reads the way the corpus says", () => {
  for (const file of FILES) {
    for (const one of file.cases) {
      test(`AC-6: ${file.parser} ${JSON.stringify(one.input)}`, async () => {
        const notation = await notationDoor();
        expect(parserOf(notation, file.parser)(one.input), `${file.file}: \`${one.input}\` reads as ${JSON.stringify(one.expect)}`).toEqual(one.expect);
      });
    }
  }
});

describe("AC-6: every parser is pure and total over every string the corpus draws", () => {
  test("AC-6: no parser throws on a string it does not read, and reading it twice reads it the same", async () => {
    const notation = await notationDoor();
    expect(EVERY_INPUT.length, "the corpus really draws strings — with none, totality below would be vacuous").toBeGreaterThan(0);
    const threw: string[] = [];
    const drifted: string[] = [];
    for (const call of NOTATION_CALLS) {
      const parser = parserOf(notation, call);
      for (const input of [...EVERY_INPUT, ""]) {
        let first: unknown;
        let again: unknown;
        try {
          first = parser(input);
          again = parser(input);
        } catch (failure) {
          threw.push(`${call}(${JSON.stringify(input)}) threw ${String(failure)}`);
          continue;
        }
        // Pure: the same string reads the same way forever, which is what lets a stored reading be
        // re-derived rather than kept (L-REG-04).
        try {
          expect(again).toEqual(first);
        } catch {
          drifted.push(`${call}(${JSON.stringify(input)})`);
        }
      }
    }
    expect(threw, "a parser handed a string it does not read answers, never throws — every cell of every drawing is put to all of them (AC-6)").toEqual([]);
    expect(drifted, "and answers the same thing the second time").toEqual([]);
  });
});
