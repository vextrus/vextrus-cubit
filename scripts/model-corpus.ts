#!/usr/bin/env -S node --import tsx
// The fixture corpus's recorder (Q-08, L-AI-01, AS-05 amendment proposal). A person with the TypeSafe
// key runs it ON PURPOSE; no lane does, and no lane could — the seam's transport is chosen by the
// environment, and every lane hands the seam a fixture root. What it records is the closed
// questions the product itself composes (`sheetUnderstandingRequest`, `viewCaptionRequest`) over
// the state the product itself finds (a committed silent sheet; the untyped captions the partition
// leaves on a drawing), put to the live provider once through the seam's one recording door
// (`recordFixture`), and written down as the file format the fixture transport replays.
//
//   node --import tsx scripts/model-corpus.ts record --question sheet-reading --out <dir>
//   node --import tsx scripts/model-corpus.ts record --question view-caption --drawing <path.dxf> --out <dir> [--limit N]
//   node --import tsx scripts/model-corpus.ts file --from <dir>
//   node --import tsx scripts/model-corpus.ts roster
//
// `record` mints under the directory given — never under fixtures/model — and prints, per fixture,
// what came back and two cost lines: the ledger's (the pinned Claude id's rate, which is what the
// product records today) and the provider's documented one (docs.typesafe.ai/models, read
// 2026-09-21: "$0.042 per Mtok, charged per input token, output tokens are free"). A person reads
// the answers, then `file` moves the ones worth keeping into the corpus root and re-derives
// `corpus.json`; a fixture already filed is never overwritten (minted once). The key is read from
// the environment by the live transport and appears nowhere in this file's output.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { entityGraphSchema, type EntityGraph } from "../src/core/entitygraph/schema";
import { MODEL_QUESTIONS, isModelQuestion, recordFixture, requestHash, type ModelCallContext, type ModelFixture, type ModelRequest } from "../src/core/model";
import { modelCallCost } from "../src/core/model-ledger.types";
import { viewCaptionRequest } from "../src/core/view-captions";
import { sheetUnderstandingRequest } from "../src/modules/ai/sheet-understanding";
import { ingestDrawing } from "../src/modules/takeoff/ingest/job";
import { partitionArtifact } from "../src/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "../src/modules/takeoff/partition/views/law";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS_ROOT = join(ROOT, "fixtures", "model");
const ROSTER = join(CORPUS_ROOT, "corpus.json");

/** The committed silent sheet the sheet-reading question is recorded over (F-MODEL). */
const SILENT_SHEET = join(CORPUS_ROOT, "sheet-understanding", "artifacts", "silent-title-block.graph.json");

/** The provider's documented input rate, USD per million tokens, and where and when it was read. */
const PROVIDER_RATE = { inputPerMillionTokens: "0.042", outputPerMillionTokens: "0", source: "https://docs.typesafe.ai/models", readOn: "2026-09-21" } as const;

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

/** The provider's documented cost of one call, USD, to nine places — input only, output free. */
function providerCost(inputTokens: number): string {
  const perMillion = Number(PROVIDER_RATE.inputPerMillionTokens);
  return ((inputTokens * perMillion) / 1_000_000).toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
}

/** The environment the recording runs under: the shell's, with every replay root taken away. */
function liveEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env["CUBIT_MODEL_FIXTURE_ROOT"];
  if (env["NODE_ENV"] === "test") delete env["NODE_ENV"];
  return env;
}

function graphAt(path: string): EntityGraph {
  const parsed = entityGraphSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) fail(`${path} is no EntityGraph this product can read`);
  return parsed.data;
}

/** One question to record, and the words a reader files it under. */
type Asked = { request: ModelRequest; subject: string };

/** The silent sheet's reading: the committed artifact's paper layout, as the product composes it. */
function sheetReadingQuestions(): Asked[] {
  const graph = graphAt(SILENT_SHEET);
  const layout = graph.layouts.find((held) => held.kind === "paper");
  if (layout === undefined) fail(`${SILENT_SHEET} carries no paper layout`);
  return [{ request: sheetUnderstandingRequest(graph, layout.name), subject: `silent-title-block.graph.json · ${layout.name}` }];
}

/** Every caption the partition left untyped on a drawing, once each, as the product would ask it. */
async function viewCaptionQuestions(drawing: string, limit: number): Promise<Asked[]> {
  const bytes = new Uint8Array(readFileSync(drawing));
  const tempDir = mkdtempSync(join(tmpdir(), "cubit-model-corpus-ingest-"));
  const format = drawing.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
  const outcome = await ingestDrawing(bytes, format as Parameters<typeof ingestDrawing>[1], { tempDir });
  if (!outcome.ok) fail(`the extractor refused ${drawing}: ${outcome.refusal} — ${outcome.detail}`);
  const partition = partitionArtifact(outcome.graph);
  const seen = new Set<string>();
  const asked: Asked[] = [];
  for (const view of partition.views) {
    if (view.type !== VIEW_TYPE.UNTYPED || view.anchorKey === null) continue;
    const key = `${view.caption}\u0000${view.anchorKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    asked.push({ request: viewCaptionRequest(view.caption, view.anchorKey), subject: `${basename(drawing)} · ${view.anchorKey} · ${view.caption}` });
  }
  say(`${basename(drawing)}: ${partition.views.length} views, ${asked.length} captions the grammar could not read`);
  return asked.slice(0, limit);
}

async function record(): Promise<void> {
  const question = option("--question");
  const out = option("--out");
  if (!isModelQuestion(question)) fail(`--question names one of ${Object.values(MODEL_QUESTIONS).join(", ")}`);
  if (out === undefined) fail("--out <dir> is where the recording is minted (never fixtures/model)");
  const outDir = resolve(out);
  if (resolve(outDir) === CORPUS_ROOT) fail("record mints under a scratch directory; `file` moves what a person has read into fixtures/model");
  mkdirSync(outDir, { recursive: true });

  const asked =
    question === MODEL_QUESTIONS.sheetReading
      ? sheetReadingQuestions()
      : await viewCaptionQuestions(option("--drawing") ?? fail("--drawing <path> names the drawing whose untyped captions are asked"), Number(option("--limit") ?? "200"));

  const env = liveEnv();
  const recordedOn = new Date().toISOString().slice(0, 10);
  let totalIn = 0;
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
      providerCost: providerCost(fixture.inputTokens),
    };
    writeFileSync(join(outDir, `${hash}.meta.json`), `${JSON.stringify(line, null, 2)}\n`);
    totalIn += fixture.inputTokens;
    filed += 1;
    const wire = fixture.payload as { payload?: unknown };
    say(`${hash}  ${subject}`);
    say(`  answered by ${line.provider ?? "(unreported)"}; payload ${JSON.stringify(wire.payload ?? fixture.payload)}; confidence ${fixture.judgment?.confidence ?? "(none)"}`);
    say(`  tokens ${fixture.inputTokens} in / ${fixture.outputTokens} out; ledger cost under ${request.modelId}: ${line.attributedCost} USD; provider's documented cost: ${line.providerCost} USD (${PROVIDER_RATE.source}, ${PROVIDER_RATE.readOn})`);
  }
  say(`recorded ${filed} fixture(s) under ${outDir}; ${totalIn} input tokens; provider's documented total ${providerCost(totalIn)} USD`);
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
