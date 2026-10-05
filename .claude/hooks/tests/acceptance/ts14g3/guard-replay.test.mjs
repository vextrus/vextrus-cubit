// Ticket S14-G3 (issue #451; #303 and #307 in part): the guard's replay table from session 13's and 14's
// refusals. factory-next.md 8, row 12: "8 harmless shapes pass; forgery, env shortcut, branch delete,
// run-time-built push still refuse". The table is data (replay.json beside this file): each row's shape,
// the session it runs in, the folder it runs from, the verdict and the line that justifies it. Each row is
// fed to the guard as one PreToolUse event on stdin, as Claude Code does (../_guard.mjs). Every repository
// below is a temporary one; the commands are test inputs only and nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { judge, tempDir, tempRepo } from "../_guard.mjs";

const table = JSON.parse(readFileSync(new URL("./replay.json", import.meta.url), "utf8"));

const ACCEPTANCE_FILE = "web/src/acceptance/t1/a.test.tsx";
const { repo: MAIN } = tempRepo();
const { repo: WT } = tempRepo({ branch: "s14-g3" });
// A worktree whose acceptance folder matches its HEAD: `git status --porcelain` for it is empty.
const { repo: CLEAN } = tempRepo({ branch: "s14-g3-clean", files: { [ACCEPTANCE_FILE]: "it('a');\n" } });
// The same, with a changed file in that folder: a checkout over it would discard the change.
const { repo: DIRTY } = tempRepo({ branch: "s14-g3-dirty", files: { [ACCEPTANCE_FILE]: "it('a');\n" } });
writeFileSync(join(DIRTY, ACCEPTANCE_FILE), "it('a changed, uncommitted');\n");
const S = tempDir("s14g3-scratch-");
mkdirSync(join(S, "iss"), { recursive: true });
const SHA = "5e3a1c0d9b8f7e6a5d4c3b2a1f0e9d8c7b6a5f40";

const PLACES = { "{MAIN}": MAIN, "{WT}": WT, "{CLEAN}": CLEAN, "{DIRTY}": DIRTY, "{S}": S, "{SHA}": SHA };
const fill = (text) => text.replace(/\{(?:MAIN|WT|CLEAN|DIRTY|S|SHA)\}/g, (key) => PLACES[key]);

/** The guard's verdict on one row: "pass", or the refusing rule's name. */
function verdictOf(row) {
  const project = { orchestrator: MAIN, builder: WT }[row.session];
  assert.ok(project, `row ${row.id}: unknown session ${row.session}`);
  const run = judge({ input: { command: fill(row.shape) }, project, cwd: fill(row.cwd), main: MAIN });
  return run === null ? "pass" : run.rule;
}

const harmless = table.rows.filter((row) => row.expect === "pass");
const walls = table.rows.filter((row) => row.expect !== "pass");

test("the replay table holds at least 8 harmless shapes, each with its source", () => {
  assert.ok(harmless.length >= 8, `only ${harmless.length} harmless shapes`);
  for (const row of table.rows) {
    assert.match(row.id, /^[HR][0-9]+$/);
    assert.ok(typeof row.source === "string" && row.source.length > 20, `row ${row.id} names no source`);
    assert.ok(["orchestrator", "builder"].includes(row.session), `row ${row.id}: session ${row.session}`);
  }
  assert.equal(new Set(table.rows.map((row) => row.id)).size, table.rows.length, "row ids repeat");
});

test("the replay table keeps every wall the ticket names", () => {
  const codes = (pattern) => walls.filter((row) => pattern.test(row.shape)).map((row) => row.expect);
  // A forged ledger or stamp write, by redirection, by an interpreter and by an env shortcut.
  assert.ok(codes(/>\s*\.private\/work\/(?:factory\/ledger|leakscan)\//).includes("RECORD_FORGED"), "no forgery by redirection");
  assert.ok(codes(/python3 -c "open\(/).includes("RECORD_FORGED"), "no forgery by an interpreter");
  assert.ok(codes(/VEXTRUS_LEAKSCAN_[A-Z]+=/).includes("RECORD_FORGED"), "no env shortcut");
  assert.ok(codes(/git push origin (?:--delete |:)/).includes("HISTORY_REWRITTEN"), "no remote branch delete");
  assert.ok(codes(/git push origin (?:\$B|\$\()/).includes("LEAK_STAMP"), "no run-time-built push");
  assert.ok(codes(/git push (?:--force|origin \+)/).includes("HISTORY_REWRITTEN"), "no force push");
});

for (const row of harmless) {
  test(`${row.id}: a harmless shape from the refusals passes (${row.session}): ${row.shape.split("\n")[0].slice(0, 90)}`, () => {
    assert.equal(verdictOf(row), "pass", `${row.id} is refused; source: ${row.source}`);
  });
}

for (const row of walls) {
  test(`${row.id}: still refused as ${row.expect} (${row.session}): ${row.shape.split("\n")[0].slice(0, 90)}`, () => {
    assert.equal(verdictOf(row), row.expect, `source: ${row.source}`);
  });
}
