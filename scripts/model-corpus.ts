#!/usr/bin/env -S node --import tsx
// The fixture corpus's recorder (Q-08, L-AI-01, AS-05 amendment proposal). A person with the TypeSafe
// key runs it ON PURPOSE; no lane does, and no lane could — the seam's transport is chosen by the
// environment, and every lane hands the seam a fixture root. What it records is the closed
// questions the product itself composes over the state the product itself finds, put to the live
// provider once through the seam's one recording door (`recordFixture`), and written down as the
// file format the fixture transport replays.
//
// Which state, and which flags name it, is each question's own — one file per question under
// `./model-corpus/`, enumerated by `./model-corpus/registry` (AM-11). This file knows only that a
// question has subjects; a question added to the product is one new file there plus one line in
// that registry, and nothing here moves.
//
//   node --import tsx scripts/model-corpus.ts record --question sheet-reading --out <dir>
//   node --import tsx scripts/model-corpus.ts record --question view-caption --drawing <path.dxf> --out <dir> [--limit N]
//   node --import tsx scripts/model-corpus.ts file --from <dir>
//   node --import tsx scripts/model-corpus.ts roster
//
// `record` mints under the directory given — never under fixtures/model — and prints, per fixture,
// what came back and two cost lines: the ledger's (the rate of the id the request pinned) and the
// provider's documented one — Jev's, derived through the ledger's own `modelCallCost` under
// `JEV_MODEL` (D-002; the rate is the one docs.typesafe.ai/models states, carried in `MODEL_RATES`),
// so the two lines agree wherever the request pins Jev and a request pinned to anything else shows
// the difference. A person reads the answers, then `file` moves the ones worth keeping into the
// corpus root and re-derives `corpus.json`; a fixture already filed is never overwritten (minted
// once). The provider's own answer body is filed beside the reading of it (`recordFixture`), so a
// replay reads it again through the seam as it stands. The key is read from the environment by the
// live transport and appears nowhere in this file's output.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JEV_MODEL, MODEL_QUESTIONS, isModelQuestion, recordFixture, requestHash, type ModelCallContext, type ModelFixture } from "../src/core/model";
import { modelCallCost } from "../src/core/model-ledger.types";
import { CORPUS_RECORDERS } from "./model-corpus/registry";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS_ROOT = join(ROOT, "fixtures", "model");
const ROSTER = join(CORPUS_ROOT, "corpus.json");

/** Where the provider's rate is published — the rate itself is `MODEL_RATES[JEV_MODEL]`, and only there. */
const PROVIDER_RATE_SOURCE = "https://docs.typesafe.ai/models";

/** One roster line: what a fixture answers, and what it cost, as the recorder learnt it. */
type RosterLine = {
  requestHash: string;
  question: string;
  subject: string;
  recordedOn: string;
  provider: string | null;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
  providerCost: string;
};

type Roster = { fixtures: RosterLine[] };

const args = process.argv.slice(2);
const command = args[0] ?? "";
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

function fail(message: string): never {
  process.stderr.write(`model-corpus: ${message}\n`);
  process.exit(1);
}

/** The provider's documented cost of these tokens, USD, exact — the ledger's own derivation under Jev's id. */
function providerCost(inputTokens: number, outputTokens: number): string {
  return modelCallCost(JEV_MODEL, inputTokens, outputTokens);
}

/** The environment the recording runs under: the shell's, with every replay root taken away. */
function liveEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env["CUBIT_MODEL_FIXTURE_ROOT"];
  if (env["NODE_ENV"] === "test") delete env["NODE_ENV"];
  return env;
}

async function record(): Promise<void> {
  const question = option("--question");
  const out = option("--out");
  if (!isModelQuestion(question)) fail(`--question names one of ${Object.values(MODEL_QUESTIONS).join(", ")}`);
  if (out === undefined) fail("--out <dir> is where the recording is minted (never fixtures/model)");
  const outDir = resolve(out);
  if (resolve(outDir) === CORPUS_ROOT) fail("record mints under a scratch directory; `file` moves what a person has read into fixtures/model");
  mkdirSync(outDir, { recursive: true });

  // Which state this question is recorded over, and which flags name it, is the question's own
  // (`./model-corpus/registry`): what this file knows is that a question has subjects.
  const asked = await CORPUS_RECORDERS[question]({ option, fail, say, corpusRoot: CORPUS_ROOT });

  const env = liveEnv();
  const recordedOn = new Date().toISOString().slice(0, 10);
  let totalIn = 0;
  let totalOut = 0;
  let filed = 0;
  for (const { request, subject } of asked) {
    const hash = requestHash(request);
    const file = join(outDir, `${hash}.json`);
    if (existsSync(file) || existsSync(join(CORPUS_ROOT, `${hash}.json`))) {
      say(`${hash}  already recorded — ${subject}`);
      continue;
    }
    const ctx: ModelCallContext = { tenantId: "corpus", projectId: "corpus", actor: "script:model-corpus", requestId: randomUUID() };
    const recording = await recordFixture(env, globalThis.fetch, ctx, request);
    if (recording.fixture === null) {
      say(`${hash}  REFUSED ${recording.refused.code} — ${subject}: ${recording.refused.message}`);
      continue;
    }
    const fixture: ModelFixture = recording.fixture;
    writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
    const line: RosterLine = {
      requestHash: hash,
      question,
      subject,
      recordedOn,
      provider: fixture.judgment?.provider ?? null,
      inputTokens: fixture.inputTokens,
      outputTokens: fixture.outputTokens,
      attributedCost: modelCallCost(request.modelId, fixture.inputTokens, fixture.outputTokens),
      providerCost: providerCost(fixture.inputTokens, fixture.outputTokens),
    };
    writeFileSync(join(outDir, `${hash}.meta.json`), `${JSON.stringify(line, null, 2)}\n`);
    totalIn += fixture.inputTokens;
    totalOut += fixture.outputTokens;
    filed += 1;
    const wire = fixture.payload as { payload?: unknown };
    say(`${hash}  ${subject}`);
    say(`  answered by ${line.provider ?? "(unreported)"}; payload ${JSON.stringify(wire.payload ?? fixture.payload)}; confidence ${fixture.judgment?.confidence ?? "(none)"}`);
    say(`  tokens ${fixture.inputTokens} in / ${fixture.outputTokens} out; ledger cost under ${request.modelId}: ${line.attributedCost} USD; provider's documented cost: ${line.providerCost} USD (${PROVIDER_RATE_SOURCE})`);
  }
  say(`recorded ${filed} fixture(s) under ${outDir}; ${totalIn} input / ${totalOut} output tokens; provider's documented total ${providerCost(totalIn, totalOut)} USD`);
}

function readRoster(): Roster {
  return existsSync(ROSTER) ? (JSON.parse(readFileSync(ROSTER, "utf8")) as Roster) : { fixtures: [] };
}

/** The roster as the directory stands: one line per fixture file, metadata kept where it was known. */
function deriveRoster(known: readonly RosterLine[]): Roster {
  const byHash = new Map(known.map((line) => [line.requestHash, line]));
  const files = readdirSync(CORPUS_ROOT)
    .filter((name) => name.endsWith(".json") && name !== "corpus.json")
    .sort();
  const fixtures = files.map((name) => {
    const hash = name.replace(/\.json$/, "");
    const held = byHash.get(hash);
    if (held !== undefined) return held;
    fail(`${name} stands in the corpus root with no roster line — file it through \`file\`, which carries the recorder's metadata`);
  });
  return { fixtures };
}

function writeRoster(roster: Roster): void {
  writeFileSync(ROSTER, `${JSON.stringify(roster, null, 2)}\n`);
}

function file(): void {
  const from = option("--from");
  if (from === undefined) fail("--from <dir> names the scratch directory a recording was minted under");
  const fromDir = resolve(from);
  const known = readRoster().fixtures;
  const added: RosterLine[] = [];
  for (const name of readdirSync(fromDir).filter((held) => held.endsWith(".meta.json"))) {
    const line = JSON.parse(readFileSync(join(fromDir, name), "utf8")) as RosterLine;
    const target = join(CORPUS_ROOT, `${line.requestHash}.json`);
    if (existsSync(target)) fail(`${line.requestHash} is already filed — a fixture is minted once and never overwritten (Q-08)`);
    renameSync(join(fromDir, `${line.requestHash}.json`), target);
    added.push(line);
    say(`filed ${line.requestHash}  ${line.question}  ${line.subject}`);
  }
  writeRoster(deriveRoster([...known, ...added]));
  say(`corpus.json lists ${deriveRoster([...known, ...added]).fixtures.length} fixture(s)`);
}

function roster(): void {
  const derived = deriveRoster(readRoster().fixtures);
  writeRoster(derived);
  say(`corpus.json lists ${derived.fixtures.length} fixture(s)`);
}

switch (command) {
  case "record":
    await record();
    break;
  case "file":
    file();
    break;
  case "roster":
    roster();
    break;
  default:
    fail("usage: record --question <name> --out <dir> [--drawing <path>] [--limit N] | file --from <dir> | roster");
}
