#!/usr/bin/env node
// The catalogue/bears table drift stage (V-VERIFY). Armed, it re-digests the committed catalogue
// source and compares it with the digest recorded beside it, so a catalogue edited without
// re-recording its tables fails the gate; with no catalogue in the tree it records its skip
// (C-06, B-23).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveLanes } from "./lib/lanes.mjs";
import { digestOf, filesUnder } from "./lib/digest.mjs";
import { announce, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const inChain = process.argv.slice(2).includes("--in-chain");
const DIGEST_FILE = "db/catalogue/digest.txt";

const startedAt = performance.now();
const lane = /** @type {{id: string, status: "armed" | "stub", probe: string}} */ (
  deriveLanes(ROOT).find((entry) => entry.id === "catalogue-drift")
);

let failed = 0;
// Verify owns the roster line when this stage runs inside its chain (C-06's stdout contract).
if (inChain || announce({ ...lane, id: "catalogue-drift" })) {
  const sources = filesUnder(ROOT, resolve(ROOT, lane.probe), (rel) => rel !== DIGEST_FILE);
  const actual = digestOf(ROOT, sources);
  const recordedPath = resolve(ROOT, DIGEST_FILE);
  const recorded = existsSync(recordedPath) ? readFileSync(recordedPath, "utf8").trim() : null;
  if (recorded === null) {
    process.stdout.write(`catalogue drift: ${DIGEST_FILE} does not exist — ${sources.length} catalogue file(s) hash to ${actual}\n`);
    failed = 1;
  } else if (recorded !== actual) {
    process.stdout.write(`catalogue drift: ${DIGEST_FILE} records ${recorded} but the catalogue hashes to ${actual}\n`);
    failed = 1;
  } else {
    process.stdout.write(`  ${sources.length} catalogue file(s) match ${recorded}\n`);
  }
}

if (!inChain) process.stdout.write(`catalogue-drift wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);
