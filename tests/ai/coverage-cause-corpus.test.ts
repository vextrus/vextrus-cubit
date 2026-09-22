// @vitest-environment node
/**
 * The coverage-cause corpus, and the recorder that mints it (Q-08, L-AI-01, R-TO-052).
 *
 * The states are HAND-AUTHORED and COMMITTED beside the recorder — the residue is a query over a
 * measured campaign and the recorder opens no database, so what it is recorded over is corpus in its
 * own right. Two things must hold forever: the recorder asks exactly the question the product asks
 * (it composes through `coverageCauseRequest` and nothing else), and every recording filed under
 * `coverage-cause` is still rebuildable from a committed state. The second is the ratchet: a state
 * edited after it was recorded, or a fixture nobody can rebuild the request for, fails here rather
 * than quietly replaying an answer to a question nobody asks any more.
 *
 * No network and no key: `subjectsOf` composes requests and posts nothing. Recording is a person's
 * own command (`scripts/model-corpus.ts record`), which no lane runs and none could.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { requestHash } from "../../src/core/model";
import { MODEL_QUESTIONS } from "../../src/core/model";
import { coverageCauseRequest, isCoverageCauseState } from "../../src/modules/takeoff/coverage/cause-proposal";
import { subjectsOf } from "../../scripts/model-corpus/coverage-cause";
import type { RecorderContext } from "../../scripts/model-corpus/recorder";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const CORPUS_ROOT = join(REPO_ROOT, "fixtures", "model");
const ROSTER = join(CORPUS_ROOT, "corpus.json");
const STATES = join(REPO_ROOT, "scripts", "model-corpus", "coverage-cause-states");

/** How many states this question was designed over: six BNBC readings, one silent, one plain, one staged. */
const AUTHORED = 9;

type RosterLine = { requestHash: string; question: string; subject: string };

/** A recorder context whose flags a case states, whose lines are collected and whose fail throws. */
function ctx(options: Readonly<Record<string, string>> = {}): RecorderContext & { said: string[] } {
  const said: string[] = [];
  return {
    said,
    option: (name) => options[name],
    fail: (message) => {
      throw new Error(message);
    },
    say: (line) => said.push(line),
    corpusRoot: CORPUS_ROOT,
  };
}

function stateFiles(): string[] {
  return readdirSync(STATES)
    .filter((name) => name.endsWith(".state.json"))
    .sort();
}

describe("the committed coverage-cause states", () => {
  it("are nine, and every one of them is a state the product's own guard reads", () => {
    const files = stateFiles();
    expect(files.length, "the corpus this question was designed over is nine hand-authored cells").toBe(AUTHORED);
    for (const name of files) {
      const parsed: unknown = JSON.parse(readFileSync(join(STATES, name), "utf8"));
      expect(isCoverageCauseState(parsed), `${name} is a coverage-cause state as the module reads one`).toBe(true);
    }
  });

  it("spread across the three channels and name distinct cells, so the corpus is evidence and not one cell nine times", () => {
    const states = stateFiles().map(
      (name) => JSON.parse(readFileSync(join(STATES, name), "utf8")) as { cell: Record<string, unknown>; sightings: { channel: string }[]; observations: unknown[] },
    );
    const channels = new Set(states.flatMap((state) => state.sightings.map((sighting) => sighting.channel)));
    expect([...channels].sort(), "L-QTY-05's three channels are all represented").toEqual(["LAYOUT", "PARTITION", "REGISTER"]);
    const addresses = states.map((state) => `${String(state.cell["kind"])}|${String(state.cell["class"])}|${String(state.cell["level"])}`);
    expect(new Set(addresses).size, "no cell is recorded twice").toBe(addresses.length);
    expect(
      states.some((state) => state.sightings.length > 0 && state.observations.length === 0),
      "one cell was sighted and nothing was read from it — the hardest reading of all",
    ).toBe(true);
  });
});

describe("the recorder over them", () => {
  it("asks one subject per state, composed by the product's own builder and by nothing it spells", () => {
    const over = ctx();
    const asked = subjectsOf(over);
    expect(asked.length).toBe(AUTHORED);
    for (const { request, subject, artifact } of asked) {
      expect(request.question, "every subject is filed under this question's own name").toBe(MODEL_QUESTIONS.coverageCause);
      expect(subject, "a reader can chase a subject back to the file it was asked over").toMatch(/\.state\.json · .+ on .+, .+$/u);
      expect(artifact !== undefined && existsSync(artifact), `${subject} names the file it was read out of`).toBe(true);
      const rebuilt = coverageCauseRequest(JSON.parse(readFileSync(artifact as string, "utf8")) as never);
      expect(requestHash(request), "the recorder composes exactly what the product composes").toBe(requestHash(rebuilt));
    }
    expect(new Set(asked.map(({ request }) => requestHash(request))).size, "nine states are nine distinct requests").toBe(AUTHORED);
    expect(over.said.join(" "), "the recorder says what it read and from where").toContain(String(AUTHORED));
  });

  it("reads its own flags: --states names the set, and a set with no state in it is refused by name", () => {
    expect(subjectsOf(ctx({ "--limit": "2" })).length, "--limit caps how many subjects are asked").toBe(2);
    expect(() => subjectsOf(ctx({ "--states": join(REPO_ROOT, "scripts", "model-corpus") })), "a directory holding no state file is named, never recorded over").toThrow(/holds no \.state\.json file/u);
  });
});

describe("every coverage-cause recording stays rebuildable from a committed state (the ratchet)", () => {
  it("names a state file under scripts/model-corpus/coverage-cause-states/ whose request hashes to its line", () => {
    expect(existsSync(ROSTER), `${ROSTER} is the corpus's roster and must exist, even empty`).toBe(true);
    const lines = (JSON.parse(readFileSync(ROSTER, "utf8")) as { fixtures: RosterLine[] }).fixtures.filter((line) => line.question === MODEL_QUESTIONS.coverageCause);
    const byHash = new Map(subjectsOf(ctx()).map((asked) => [requestHash(asked.request), asked.subject]));
    for (const line of lines) {
      expect([...byHash.keys()], `${line.requestHash} (${line.subject}) is answerable from a committed state — a state edited after it was recorded fails here`).toContain(line.requestHash);
      expect(byHash.get(line.requestHash), "the roster's subject is the one the recorder prints for that state").toBe(line.subject);
    }
  });
});
