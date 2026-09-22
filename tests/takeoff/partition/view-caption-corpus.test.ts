/**
 * The corpus answers every caption the product asks — proved on F-RCC6-BNBC, the M3/M4 yardstick
 * (R-TO-030, L-AI-01, Q-08, B-17).
 *
 * Session 7's map read today's J-000 M3 run: the rebuild asked ten view-caption questions of the BNBC
 * project and every one refused FIXTURE_MISSING, while the committed corpus answered nine captions
 * the partition had stopped asking about once I-290 let a viewport's title caption its region. The
 * recorder and the rebuild now choose their subjects through ONE selection (`captionsAskedOf`), and
 * this suite is the proof that the one selection is one fact on the real drawing: the shipped `cad/`
 * CLI reads `fixtures/rcc6-bnbc/rcc6-bnbc.dxf`, the shipped partition job rebuilds it over the
 * committed corpus root, and the request hashes the ledger records for it are EXACTLY the hashes the
 * corpus recorder (`scripts/model-corpus/view-caption.ts`) prints for the same drawing — every one of
 * them answered from `fixtures/model` (none FIXTURE_MISSING), all pinned to Jev's id (D-002).
 *
 * A call the corpus answers may still be refused by the product's own reading — a caption Jev reads
 * as no class the rebuild offers is MALFORMED, and the view stays untyped — which is the product's
 * decision about an answer, not a hole in the corpus, so it is not what this suite grades.
 */
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { requestHash } from "../../../src/core/model";
import type { RecorderContext } from "../../../scripts/model-corpus/recorder";
import { subjectsOf } from "../../../scripts/model-corpus/view-caption";
import { sql, withFixtureRoot } from "./support/partition-stage";
import { BNBC_DXF, bnbcArtifact, closeStage, runPlacementPartition, stageArtifactIngest, stagePlacementProject, type PlacementStage } from "./support/placement-stage";

/** The committed corpus root every lane replays from (L-AI-01). */
const CORPUS_ROOT = join(process.cwd(), "fixtures", "model");

/** The id every closed question is pinned to (D-002), spelled as the ledger column holds it. */
const JEV = "jev-latest";

/** The refusal a question nobody recorded is answered with (L-AI-01). */
const FIXTURE_MISSING = "FIXTURE_MISSING";

/** The recorder's context: the drawing named, no limit, and a `fail` that throws so a refusal is read. */
function recorderContext(): RecorderContext {
  const options: Record<string, string> = { "--drawing": join(process.cwd(), BNBC_DXF), "--limit": "100000" };
  return {
    option: (name) => options[name],
    fail: (message) => {
      throw new Error(message);
    },
    say: () => undefined,
    corpusRoot: CORPUS_ROOT,
  };
}

type Call = { requestHash: string; modelId: string; outcome: string; refusalCode: string; question: string };

/** Every model call one workspace made, with how it ended — the suite's own audit read. */
function callsOf(tenantId: string): Call[] {
  return sql(
    `select request_hash, model_id, outcome, coalesce(refusal_code, ''), coalesce(question, '') from ${ident("model_calls")}
       where ${ident("tenant_id")} = ${lit(tenantId)}::uuid;`,
  ).map((row) => ({ requestHash: row[0] ?? "", modelId: row[1] ?? "", outcome: row[2] ?? "", refusalCode: row[3] ?? "", question: row[4] ?? "" }));
}

let stage: PlacementStage;
let asked: Call[];
let recorded: string[];

beforeAll(async () => {
  stage = await stagePlacementProject("captions");
  const staged = await stageArtifactIngest(stage, await bnbcArtifact(), "bnbc-captions");
  await withFixtureRoot(CORPUS_ROOT, async () => {
    await runPlacementPartition(stage, staged, "bnbc-captions");
  });
  // The stage's workspace is its own, so every call it holds is one this rebuild made.
  asked = callsOf(stage.person.tenantId);
  recorded = (await subjectsOf(recorderContext())).map((subject) => requestHash(subject.request)).sort();
}, 900_000);

afterAll(async () => {
  await closeStage();
});

describe("the view-caption corpus and the product ask one set of questions on F-RCC6-BNBC", () => {
  test("the rebuild asks exactly the requests the recorder records — hash for hash, and no other", () => {
    expect(recorded.length, "the recorder has captions to ask about on the yardstick — the proof is only a proof if it does").toBeGreaterThan(0);
    expect(new Set(asked.map((call) => call.question)), "the rebuild asks the view-caption question and no other").toEqual(new Set(["view-caption"]));
    expect([...new Set(asked.map((call) => call.requestHash))].sort(), "the ledger's request hashes are the recorder's, exactly").toEqual(recorded);
    expect(asked.length, "one call per caption, none asked twice").toBe(recorded.length);
  });

  test("the committed corpus answers every one of them — none FIXTURE_MISSING — and every call is pinned to Jev", () => {
    expect(
      asked.filter((call) => call.refusalCode === FIXTURE_MISSING).map((call) => call.requestHash),
      "a caption the product asks that the corpus does not answer is the defect this suite exists for",
    ).toEqual([]);
    expect(new Set(asked.map((call) => call.modelId)), "every call is pinned to Jev's id (D-002)").toEqual(new Set([JEV]));
  });
});
