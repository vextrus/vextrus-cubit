// The guard is self-contained (selftest copies guard.mjs alone), so it carries the trailer reader inline: this pins
// that copy to trailers.mjs byte for byte, and checks the stop gate imports the module rather than a copy of its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BEGIN = "// --- trailer reader: begin";
const END = "// --- trailer reader: end";

/** The reader's text between the markers (the begin line itself excluded: it names its own file). */
function block(file) {
  const text = readFileSync(join(here, file), "utf8");
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  assert.ok(start >= 0 && end > start, `${file} carries the trailer reader's markers`);
  assert.equal(text.indexOf(BEGIN, start + 1), -1, `${file} carries one trailer reader`);
  return text.slice(text.indexOf("\n", start) + 1, end);
}

test("the guard's trailer reader is trailers.mjs's, byte for byte", () => {
  assert.equal(block("guard.mjs"), block("trailers.mjs"));
});

test("the stop gate reads trailers only through trailers.mjs", () => {
  const gate = readFileSync(join(here, "stop-gate.mjs"), "utf8");
  assert.match(gate, /import \{ readTrailers \} from "\.\/trailers\.mjs";/);
  assert.doesNotMatch(gate, /interpret-trailers|startsWith\("factory-"\)/);
});
