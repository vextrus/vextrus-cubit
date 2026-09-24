#!/usr/bin/env node
// V-VERIFY: the gate's chain, fail-fast, in order — typegen, types, lint, unit, schema drift,
// method-hash manifest, catalogue drift, cad, build. The roster comes from deriveLanes and from
// nowhere else (ARCH-02); a stub lane records a skip naming the input root it is waiting for, and
// arms itself the moment that input exists (C-06, B-23). The exit code is the whole contract, so
// the chain is an exported function driven by an injected runner — a guarantee nothing can execute
// is a guarantee nothing can prove (B-22).
//
// CUBIT_VERIFY_SLOTS — how many gates share this machine. The engine sets it to the number of
// product suites it is running at once (concurrency 2 means `CUBIT_VERIFY_SLOTS=2`); one gate is
// assumed when nobody says. Every cap this chain sets is derived from it in scripts/lib/box.mjs: the
// unit lane's `--maxWorkers`, the width of a wave, and — in the database lane's own config — that
// lane's workers. A gate uses at most `cores / SLOTS - 2` workers in total, so two gates on the
// 24-core box no longer ask it for 36.
//
// CUBIT_LANE_TIMEOUT_MS — how long any one lane may run before it is killed and what it had already
// said is flushed (scripts/lib/report.mjs); 15 minutes by default.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UNIT_LANE_KNEE, VERIFY_WAVE_SIBLINGS, laneWorkers, waveParallelism } from "./lib/box.mjs";
import { cadLane, recordRegenerationProofs } from "./lib/cad-lane.mjs";
import { deriveLanes } from "./lib/lanes.mjs";
import { announce, run, runAsync, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/** The cad suites that are the golden's other half: the recompute paths, over both fixtures. */
export const GOLDEN_PYTEST = Object.freeze([
  "cad/tests/sanity/test_rcc6_golden.py",
  "cad/tests/sanity/test_golden_corpora.py",
  "cad/tests/rcc6_bnbc",
  "cad/tests/arch",
  // The DWG lane proven against the owner's real structural set (REFERENCE_TESTS in ./lib/cad-lane.mjs):
  // verify's cad lane sets it aside, and the gate's golden lane runs it.
  "cad/tests/dwg/test_dwg_reference.py",
]);

/**
 * What the unit lane is invoked as. The engine reads the lane's verdict from a STRUCTURED report and
 * not from the terminal: without one it can only know that the lane was green, never WHICH test
 * files it executed, so its acceptance dedup — "this claim is already proved by a test that ran" —
 * claims nothing. `--outputFile` is the report's address, stated by the caller through
 * `CUBIT_VERIFY_REPORT_JSON`; with the variable unset the lane is exactly what it always was, so a
 * human running `pnpm verify` pays nothing for the engine's instrument.
 *
 * The default reporter is kept BESIDE the json one: vitest takes several `--reporter` flags, and a
 * lane that swapped its terminal output for a file would take the failure list away from the person
 * watching it.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function unitLaneCommand(env) {
  const workers = `--maxWorkers=${laneWorkers(UNIT_LANE_KNEE, { siblings: VERIFY_WAVE_SIBLINGS })}`;
  const command = ["node", "node_modules/vitest/vitest.mjs", "run", workers];
  const report = env["CUBIT_VERIFY_REPORT_JSON"];
  if (report === undefined || report === "") return command;
  return [...command, "--reporter=default", "--reporter=json", `--outputFile=${report}`];
}

const CAD_LANE = cadLane(ROOT);

/**
 * What a lane owes the reader beyond RUN and its verdict: one line, printed on the lane's own
 * announcement, for a decision the lane made about ITSELF. Work a gate silently did not do is work
 * nobody can audit, so the cad lane names the regeneration it deselected and why (V-VERIFY).
 * @type {Readonly<Record<string, string>>}
 */
export const LANE_NOTES = Object.freeze(
  /** @type {Record<string, string>} */ ({
    golden: "golden: the cad half (pytest over the golden suites) is collected by the cad lane beside it; `pnpm test:golden` runs both halves",
    ...(CAD_LANE.note === null ? {} : { cad: CAD_LANE.note }),
  }),
);

/**
 * What each lane runs when it is armed. Keyed by the lane ids deriveLanes yields; the roster still
 * decides which of these ever run.
 * @type {Readonly<Record<string, string[][]>>}
 */
export const LANE_COMMANDS = Object.freeze({
  typegen: [["node", "node_modules/next/dist/bin/next", "typegen"]],
  // TypeScript 7, the native compiler (D-004). `typescript` itself is the TypeScript 6 API alias that
  // typescript-eslint and Next's type check read; it ships only `tsc6`.
  types: [["node", "node_modules/@typescript/native/bin/tsc", "--noEmit"]],
  // Three workers: `eslint .` alone reads 25 s serially and 13 s at three (47 CPU-s against 36), and six
  // buys nothing more — the cycle rule builds its module graph once per worker (session 9, measured).
  lint: [["node", "node_modules/eslint/bin/eslint.js", "--concurrency=3", "."]],
  // Capped deliberately: the unit lane would take the whole box by default, and it no longer has
  // the box to itself — six other lanes gate beside it (runChainInWaves), and the engine may be
  // running a second gate on the same machine. The number is derived from the box and from
  // CUBIT_VERIFY_SLOTS rather than written down (scripts/lib/box.mjs).
  unit: [unitLaneCommand(process.env)],
  "schema-drift": [["node", "scripts/db-drift.mjs", "--scratch"]],
  "method-hash": [["node", "scripts/method-hashes.mjs", "--in-chain"]],
  "catalogue-drift": [["node", "scripts/catalogue-drift.mjs", "--in-chain"]],
  // The fixture evidence lane (V-GOLDEN). Inside this chain, its vitest half only: the goldens
  // read as committed bytes (tests/golden/vitest.config.ts). Its cad half — GOLDEN_PYTEST — is a
  // subset of what the cad lane's `pytest cad` collects in the same wave (none of those paths is a
  // regeneration test the cad lane may set aside; tests/toolchain/cad-lane.test.ts proves it), so
  // running it here too was the same ~40 s of pytest twice on one tree, and it was verify's margin
  // against V-VERIFY. `pnpm test:golden`, the gate's own golden lane, still runs both halves.
  golden: [["node", "node_modules/vitest/vitest.mjs", "run", "--config", "tests/golden/vitest.config.ts"]],
  // The fixture-regeneration tests are the lane's whole wall (BNBC's ~80 s of ~100), and each can
  // only break when something its own corpus reads has moved; scripts/lib/cad-lane.mjs asks git,
  // corpus by corpus, and says in LANE_NOTES which it set aside and why.
  cad: [
    ["ruff", "check", "cad"],
    CAD_LANE.argv,
  ],
  build: [["node", "node_modules/next/dist/bin/next", "build"]],
});

/**
 * What a lane is given beyond the environment it inherits. The build lane alone: the chain's `types`
 * lane has already type-checked this tree, and `next build` doing it again is the same minutes
 * twice (next.config.ts holds the flag's one reading).
 * @type {Readonly<Record<string, Record<string, string>>>}
 */
export const LANE_ENV = Object.freeze({
  build: { CUBIT_BUILD_SKIP_TYPECHECK: "1" },
  // The unit lane runs in the same wave as the cad lane (planWaves), and two of its suites —
  // tests/cad/dwg/dwg-lane (AC-6) and tests/cad/licence (AC-7) — assert that verify's cad lane is
  // green by RUNNING it, ruff and the whole pytest collection, ~35 s each. Inside this chain that
  // was the cad lane three times over one tree, and the two extra runs were the unit lane's wall
  // (verify 70.5 s against V-VERIFY's 60 at session 7's gate). Told that the cad lane stands
  // beside them, those suites prove its COMMAND is exactly theirs and leave its verdict to it:
  // the chain still fails red if the cad lane does. Run on their own (`pnpm test`), they run it.
  // The same holds for the lint lane: tests/lint/import-depth's "`eslint src` is clean" linted the
  // whole of src/ a second time beside `eslint .` over the same config.
  unit: { CUBIT_CAD_LANE_BESIDE: "1", CUBIT_LINT_LANE_BESIDE: "1" },
});

/**
 * @typedef {{id: string, status: "armed" | "stub", probe: string}} Lane
 */

/**
 * The chain in waves: what must be sequential, and what only looked it. `typegen` writes the types
 * the `types` lane reads, so it stands alone in front; `build` stands alone at the back because it
 * is the one lane worth not running when something already came back red. Everything between is
 * independent — tsc, eslint, the unit lane, cad, and the three drift lanes read the tree and answer
 * about it, and none of them reads another's output — so they gate together.
 * @param {ReadonlyArray<Lane>} lanes
 * @returns {Lane[][]}
 */
export function planWaves(lanes) {
  const waves = [lanes.filter((lane) => lane.id === "typegen"), lanes.filter((lane) => lane.id !== "typegen" && lane.id !== "build"), lanes.filter((lane) => lane.id === "build")];
  return waves.filter((wave) => wave.length > 0);
}

/**
 * Run a roster fail-fast, in the order it is given. Every lane is announced exactly once — `RUN` or
 * the recorded `SKIP` — before anything of its own is executed, and the first non-zero exit ends
 * the chain: no later lane is announced, and its code is the chain's code.
 * @param {ReadonlyArray<Lane>} lanes
 * @param {{exec?: (argv: string[]) => number, report?: (lane: Lane) => boolean, write?: (line: string) => void}} [io]
 * @returns {number} the exit code, which is the whole contract
 */
export function runChain(lanes, io = {}) {
  const exec = io.exec ?? ((argv) => run(argv, { cwd: ROOT }));
  const report = io.report ?? announce;
  const write = io.write ?? ((line) => process.stdout.write(line));

  // A lane the roster yields but nothing can run would be a silent pass — refuse it loudly.
  const unrunnable = lanes.filter((lane) => LANE_COMMANDS[lane.id] === undefined).map((lane) => lane.id);
  if (unrunnable.length > 0) {
    write(`verify has no command for ${unrunnable.join(", ")}\n`);
    return 1;
  }

  for (const lane of lanes) {
    if (!report(lane)) continue;
    for (const argv of /** @type {string[][]} */ (LANE_COMMANDS[lane.id])) {
      const code = exec(argv);
      if (code !== 0) {
        write(`FAIL ${lane.id} exit=${code}\n`);
        return code;
      }
    }
  }
  return 0;
}

/**
 * Run a roster in waves, concurrently within each wave. Every lane is announced exactly once, in
 * roster order, before anything of its wave is executed (ARCH-02, B-22).
 *
 * A wave is run WHOLE: the engine wants every lane's verdict, not just the first red one, so a lane
 * that fails does not silence its siblings — each failure prints its own `FAIL <id> exit=<code>`.
 * Fail-fast survives where it means something: a wave that came back red ends the chain, so no
 * later wave is announced or run, and the code is the first failure's in roster order.
 * `onGreen` is told each lane that came back green, once, after its `LANE` line — the cad lane's
 * regeneration proof is written there and nowhere earlier (scripts/lib/cad-lane.mjs). Absent by
 * default, so a suite driving this chain with a fake exec records nothing on the real machine.
 * @param {ReadonlyArray<Lane>} lanes
 * @param {{exec?: (argv: string[], env?: Record<string, string>, label?: string) => number | Promise<number>, report?: (lane: Lane) => boolean, write?: (line: string) => void, onGreen?: (laneId: string) => void}} [io]
 * @returns {Promise<number>} the exit code, which is the whole contract
 */
export async function runChainInWaves(lanes, io = {}) {
  const exec = io.exec ?? ((argv, env, label) => runAsync(argv, { cwd: ROOT, env: { ...process.env, ...env }, label }));
  const report = io.report ?? announce;
  const write = io.write ?? ((line) => process.stdout.write(line));
  const onGreen = io.onGreen ?? (() => undefined);

  const unrunnable = lanes.filter((lane) => LANE_COMMANDS[lane.id] === undefined).map((lane) => lane.id);
  if (unrunnable.length > 0) {
    write(`verify has no command for ${unrunnable.join(", ")}\n`);
    return 1;
  }

  let code = 0;
  for (const wave of planWaves(lanes)) {
    const armed = wave.filter((lane) => report(lane));
    for (const lane of armed) {
      const note = LANE_NOTES[lane.id];
      if (note !== undefined) write(`${note}\n`);
    }
    const verdicts = await atMostAtOnce(armed, waveParallelism(armed.length), async (lane) => {
      // Every lane says what it COST, green or red. A gate whose wall-time is the only number it
      // prints can be measured but not aimed: "verify is 178 s" names no lane to make faster, and
      // the lane that grew is invisible until someone runs the chain by hand. One line per lane,
      // in the same stdout contract the verdicts use (ARCH-02), and the wave's concurrency means
      // these seconds overlap — they are each lane's own wall, never a sum of the chain's.
      const startedAt = performance.now();
      let answer = 0;
      for (const argv of /** @type {string[][]} */ (LANE_COMMANDS[lane.id])) {
        answer = await exec(argv, LANE_ENV[lane.id], lane.id);
        if (answer !== 0) break;
      }
      write(`LANE ${lane.id} ${wallTime(startedAt)}\n`);
      if (answer === 0) onGreen(lane.id);
      return { lane, code: answer };
    });
    for (const verdict of verdicts) {
      if (verdict.code === 0) continue;
      write(`FAIL ${verdict.lane.id} exit=${verdict.code}\n`);
      if (code === 0) code = verdict.code;
    }
    if (code !== 0) break;
  }
  return code;
}

/**
 * Run `work` over `items` with at most `width` of them in flight, answering in the items' own order.
 * A wave is still a wave — it is just not allowed to be wider than the box it is running on
 * (scripts/lib/box.mjs); on a machine with cores to spare this is `Promise.all` by another name.
 * @template T, R
 * @param {ReadonlyArray<T>} items
 * @param {number} width
 * @param {(item: T) => Promise<R>} work
 * @returns {Promise<R[]>}
 */
async function atMostAtOnce(items, width, work) {
  /** @type {R[]} */
  const answers = new Array(items.length);
  let next = 0;
  const hand = async () => {
    for (let index = next; index < items.length; index = next) {
      next += 1;
      answers[index] = await work(/** @type {T} */ (items[index]));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(width, items.length)) }, hand));
  return answers;
}

/** Is this file the process's entry point, rather than a module a suite is reading? */
function isEntryPoint() {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  const startedAt = performance.now();
  const code = await runChainInWaves(deriveLanes(ROOT), {
    // The cad lane's regeneration proofs: written on the lane's own green, one per corpus whose
    // regeneration actually RAN over a digested tree (scripts/lib/cad-lane.mjs).
    onGreen: (laneId) => {
      if (laneId === "cad" && Object.keys(CAD_LANE.digests).length > 0) recordRegenerationProofs(ROOT, CAD_LANE.digests);
    },
  });
  process.stdout.write(`verify wall-time ${wallTime(startedAt)}\n`);
  process.exit(code);
}
