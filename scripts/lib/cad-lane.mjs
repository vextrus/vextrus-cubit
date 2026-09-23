// What the cad lane runs, and the one question that decides its price (V-VERIFY, v22 speed).
//
// THE COST THIS FILE EXISTS FOR. `pytest cad` collects the fixture-regeneration tests, and one of
// them — cad/tests/sanity/test_rcc6_bnbc_regenerate.py — runs the F-RCC6-BNBC generator end to end:
// 27 sheets of DXF, DWG, vector PDF and rasters, ~80 seconds of the lane's ~100. It ran on EVERY
// gate, including the overwhelming majority that touch nothing a generator reads. That is the
// whole cad lane's wall paid to re-prove a corpus that could not have moved.
//
// WHAT IS AND IS NOT GIVEN UP. Regeneration is the claim "the committed corpus is what the
// committed generator writes". It can only break when the generator, the model it reads, the
// corpus itself, or the extractor package underneath moves — so the lane asks git whether any of
// them did, and runs the regeneration when the answer is yes or when git cannot answer. The CHEAP
// half of the corpus's evidence is untouched and still runs every time: the golden lane reads the
// committed bytes against the manifest (tests/golden + cad/tests/rcc6_bnbc), and every sanity suite
// that reads the committed drawings runs exactly as before. What is skipped is the ~80 s
// recomputation, and only when nothing it reads has moved.
//
// The diff is taken the way the gate is actually used: on a lane branch, everything the branch
// changed against main (merge-base..HEAD) plus whatever the working tree carries on top of it; on
// main itself, the commit being gated (HEAD^..HEAD) plus the working tree. Uncommitted work always
// counts — the gate is run on trees mid-edit more often than on clean ones.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The tests that RECOMPUTE a fixture corpus from its generator, as pytest node ids. Everything else
 * under cad/tests reads committed bytes and costs milliseconds.
 */
export const FIXTURE_REGENERATION_TESTS = Object.freeze([
  "cad/tests/sanity/test_rcc6_bnbc_regenerate.py",
  "cad/tests/sanity/test_rcc6_regenerate.py",
]);

/**
 * The paths that could move what those tests recompute: the generators, the corpora they write, the
 * extractor package they import, the BNBC lane's own suite — and the regeneration tests themselves,
 * because a change to the test that makes the claim must run the claim.
 */
export const FIXTURE_REGENERATION_INPUTS = Object.freeze(["fixtures/gen/", "fixtures/rcc6", "cad/src/", "cad/tests/rcc6_bnbc/", ...FIXTURE_REGENERATION_TESTS]);

/** The line the lane prints when it has deselected them, naming what it looked at. */
export const REGENERATION_SKIPPED_LINE = "cad: fixture regeneration skipped — nothing under fixtures/gen, fixtures/rcc6*, cad/src moved (the golden lane still checks the committed corpus)";

/**
 * Could a fixture corpus have moved, given the paths a diff named? A path is a repo-relative,
 * forward-slashed name as `git diff --name-only` prints it.
 * @param {ReadonlyArray<string>} paths
 * @returns {boolean}
 */
export function touchesFixtureInputs(paths) {
  return paths.some((path) => {
    const name = path.replace(/\\/g, "/").replace(/^\.\//, "");
    return FIXTURE_REGENERATION_INPUTS.some((input) => name.startsWith(input));
  });
}

/**
 * The paths this tree has changed, as the gate means it. Null — never an empty list — when git
 * cannot answer: "I do not know what moved" and "nothing moved" are opposite verdicts, and only one
 * of them is allowed to skip work.
 * @param {string} root the checkout
 * @param {(argv: string[]) => {status: number | null, stdout: string}} [git] injected, so the
 *   decision is provable without a repository shaped like the one it is about
 * @returns {string[] | null}
 */
export function changedPaths(root, git) {
  const run =
    git ??
    ((argv) => {
      const result = spawnSync("git", argv, { cwd: root, encoding: "utf8" });
      return { status: result.error === undefined ? result.status : 1, stdout: result.stdout ?? "" };
    });
  /** @param {string} text @returns {string[]} */
  const lines = (text) => text.split("\n").map((line) => line.trim()).filter((line) => line !== "");

  const head = run(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (head.status !== 0) return null;
  // On a lane branch the gate judges the whole branch; on main it judges the commit being merged.
  const base = head.stdout.trim() === "main" ? run(["rev-parse", "HEAD^"]) : run(["merge-base", "HEAD", "main"]);
  if (base.status !== 0) return null;
  const committed = run(["diff", "--name-only", `${base.stdout.trim()}..HEAD`]);
  if (committed.status !== 0) return null;
  // Everything not yet committed, tracked or not: a gate run mid-edit must see the edit.
  const working = run(["status", "--porcelain", "--untracked-files=all"]);
  if (working.status !== 0) return null;
  // Porcelain's first two columns are the status and the third is a space, so the path starts at
  // column 3 — the line is NOT trimmed first, or a path would lose its own first characters.
  const changed = working.stdout
    .split("\n")
    .filter((line) => line.length > 3)
    .map((line) => (line.slice(3).split(" -> ").pop() ?? "").replace(/^"|"$/g, "").trim());
  return [...lines(committed.stdout), ...changed.filter((name) => name !== "")];
}

/**
 * The cad lane's pytest argv. `regenerate: false` drops the recomputation tests from the collection
 * — deselected rather than SKIPPED, deliberately: cad/tests/sanity/conftest.py fails any session
 * over a skip it cannot explain (a skip is a claim about this machine, and this is not one), and
 * work that was never selected is not a skip.
 *
 * `--ignore=<path>` and not `--deselect=<nodeid>`: cad/pyproject.toml carries the pytest
 * configuration, so pytest's rootdir is `cad/` and every collected node id is spelled
 * `tests/sanity/…` while the lane is invoked from the checkout with `cad/tests/sanity/…`. A
 * `--deselect` that misses simply deselects NOTHING, silently — the lane would print its skip line
 * and pay the 80 seconds anyway. `--ignore` takes a filesystem path, so it cannot miss quietly, and
 * it drops the module before it is even imported.
 * @param {{regenerate: boolean}} decision
 * @returns {string[]}
 */
export function cadPytestArgv(decision) {
  if (decision.regenerate) return ["pytest", "cad", ...CAD_WORKERS];
  return ["pytest", "cad", ...FIXTURE_REGENERATION_TESTS.map((test) => `--ignore=${test}`), ...CAD_WORKERS];
}

/**
 * The suite runs across six pytest-xdist workers (V-VERIFY). Serially it was the verify chain's wall
 * — 33.8 s alone, ~50 s beside the unit lane — and one test (the reference structural drawing's
 * conversion, 18.2 s) is its floor; six workers took it to ~24 s on a 24-core box without starving
 * the lanes beside it.
 */
export const CAD_WORKERS = Object.freeze(["-n", "6"]);

/**
 * THE PROOF A GREEN REGENERATION LEAVES (V-VERIFY, 2026-09-21).
 *
 * The diff above is taken against main, so a lane branch that touched the extractor ONCE pays the
 * ~80 s recomputation on every gate after — `LANE cad 137.52s` over a 60 s ceiling, on trees where
 * nothing the generator reads had moved since the last green. The regeneration is a claim about
 * BYTES — "the committed corpus is what the committed generator writes" — over exactly the inputs
 * it reads. So a green run writes down a digest of those inputs: the index's blob ids of every
 * tracked file under FIXTURE_REGENERATION_INPUTS and the extractor's environment pins, plus the bytes
 * of every working-tree change to them (a modified, staged, untracked or deleted file is hashed as
 * it stands, or as absent). A later gate whose inputs digest the same skips the recomputation and
 * says so, naming the proof; one byte of a generator, a lock or a corpus moved is a new digest, and
 * that gate regenerates. Nothing is weakened: what is skipped is a recomputation over bytes a green
 * recomputation already ran over, and the cheap half of the evidence (the golden lane over the
 * committed corpus) still runs every time. The proof is machine-local — under node_modules/.cache,
 * never committed — so a fresh checkout and CI regenerate once and then hold their own.
 */
export const REGENERATION_PROOF_PATH = "node_modules/.cache/cubit/cad-regeneration.json";

/** Beyond the inputs, what pins the environment the recomputation runs in. */
export const REGENERATION_ENVIRONMENT = Object.freeze(["cad/pyproject.toml", "cad/uv.lock"]);

/** @param {string} root @returns {(argv: string[]) => {status: number | null, stdout: string}} */
function gitOf(root) {
  return (argv) => {
    const result = spawnSync("git", argv, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return { status: result.error === undefined ? result.status : 1, stdout: result.stdout ?? "" };
  };
}

/**
 * The paths a porcelain listing names, as the working tree spells them (a rename's new name).
 * @param {string} porcelain
 * @returns {string[]}
 */
function porcelainPaths(porcelain) {
  return porcelain
    .split("\n")
    .filter((line) => line.length > 3)
    .map((line) => (line.slice(3).split(" -> ").pop() ?? "").replace(/^"|"$/g, "").trim())
    .filter((name) => name !== "");
}

/**
 * The digest of everything the regeneration reads, as this tree holds it. Null — never a digest —
 * when git cannot answer: no proof can then be matched, and the lane regenerates.
 * @param {string} root
 * @param {(argv: string[]) => {status: number | null, stdout: string}} [git]
 * @param {(absolutePath: string) => Buffer | null} [readFile] injected; null for a file that is not there
 * @returns {string | null}
 */
export function regenerationInputsDigest(root, git, readFile) {
  const run = git ?? gitOf(root);
  const read =
    readFile ??
    ((absolutePath) => {
      try {
        return readFileSync(absolutePath);
      } catch {
        return null;
      }
    });
  const inputs = [...FIXTURE_REGENERATION_INPUTS, ...REGENERATION_ENVIRONMENT];
  const indexed = run(["ls-files", "-s", "--", ...inputs]);
  if (indexed.status !== 0) return null;
  const working = run(["status", "--porcelain", "--untracked-files=all", "--", ...inputs]);
  if (working.status !== 0) return null;
  // Content-addressed (session 8): each input is its path and the git blob id of the bytes the
  // regeneration would read. A tracked file the working tree leaves alone is the index's blob; every
  // path the working tree carries beyond the index is the blob id of its bytes NOW, or not there at all.
  // So a mid-edit gate digests the edit, a deleted file digests as the tree without it, and committing exactly the bytes
  // a green regeneration proved digests the same as before the commit — the commit alone never buys
  // a second ~80 s recomputation.
  /** @type {Map<string, string>} */
  const blobs = new Map();
  for (const line of indexed.stdout.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const blob = line.slice(0, tab).split(" ")[1];
    if (blob !== undefined) blobs.set(line.slice(tab + 1), blob);
  }
  for (const name of porcelainPaths(working.stdout)) {
    const bytes = read(join(root, name));
    if (bytes === null) blobs.delete(name);
    else blobs.set(name, gitBlobId(bytes));
  }
  const hash = createHash("sha256");
  hash.update("inputs by blob\n");
  for (const name of [...blobs.keys()].sort()) hash.update(`${name} ${blobs.get(name)}\n`);
  return hash.digest("hex");
}

/**
 * The id git gives these bytes as a blob (`git hash-object`): sha1 over `blob <length>\0` and the bytes.
 * @param {Buffer} bytes
 * @returns {string}
 */
export function gitBlobId(bytes) {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/** @typedef {{digest: string, provedAt: string}} RegenerationProof */

/**
 * The proof the last green regeneration on this machine left, or null where there is none, or it is
 * not a proof. A torn or malformed file is the same lawful answer as an absent one — regenerate.
 * @param {string} root
 * @param {(absolutePath: string) => Buffer | null} [readFile]
 * @returns {RegenerationProof | null}
 */
export function readRegenerationProof(root, readFile) {
  const read =
    readFile ??
    ((absolutePath) => {
      try {
        return readFileSync(absolutePath);
      } catch {
        return null;
      }
    });
  const bytes = read(join(root, REGENERATION_PROOF_PATH));
  if (bytes === null) return null;
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (typeof parsed?.digest !== "string" || !/^[0-9a-f]{64}$/.test(parsed.digest) || typeof parsed.provedAt !== "string") return null;
    return { digest: parsed.digest, provedAt: parsed.provedAt };
  } catch {
    return null;
  }
}

/**
 * Write the proof down — after the lane came back green, never before (scripts/verify.mjs is the
 * one caller, on the cad lane's own verdict). Atomic: laid down under a name only this process uses
 * and renamed into place, so a gate reading it never sees half a proof.
 * @param {string} root
 * @param {string} digest
 * @param {string} [provedAt]
 * @returns {RegenerationProof}
 */
export function recordRegenerationProof(root, digest, provedAt = new Date().toISOString()) {
  const file = join(root, REGENERATION_PROOF_PATH);
  mkdirSync(dirname(file), { recursive: true });
  const partial = `${file}.${process.pid}.tmp`;
  const proof = { digest, provedAt, inputs: [...FIXTURE_REGENERATION_INPUTS, ...REGENERATION_ENVIRONMENT] };
  writeFileSync(partial, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  renameSync(partial, file);
  return { digest, provedAt };
}

/**
 * The line the lane prints when a proof bought the skip: it names the digest and when it was proved,
 * so a reader can tell this skip from the diff's and can find the proof to doubt it.
 * @param {RegenerationProof} proof
 * @returns {string}
 */
export function regenerationProvenLine(proof) {
  return `cad: fixture regeneration skipped — its inputs digest ${proof.digest.slice(0, 12)}, the tree a green regeneration proved at ${proof.provedAt} (${REGENERATION_PROOF_PATH}; the golden lane still checks the committed corpus)`;
}

/**
 * What this tree's cad lane should run, and what it owes the reader for it. `digest` is the inputs'
 * digest where one was taken (the inputs moved against main) — the proof verify.mjs records when the
 * lane comes back green with the regeneration in it.
 * @param {string} root
 * @param {(argv: string[]) => {status: number | null, stdout: string}} [git]
 * @param {{readProof?: (root: string) => RegenerationProof | null, readFile?: (absolutePath: string) => Buffer | null}} [io]
 * @returns {{argv: string[], regenerate: boolean, note: string | null, digest: string | null}}
 */
export function cadLane(root, git, io = {}) {
  const paths = changedPaths(root, git);
  if (paths === null) return { argv: cadPytestArgv({ regenerate: true }), regenerate: true, note: null, digest: null };
  if (!touchesFixtureInputs(paths)) return { argv: cadPytestArgv({ regenerate: false }), regenerate: false, note: REGENERATION_SKIPPED_LINE, digest: null };
  const digest = regenerationInputsDigest(root, git, io.readFile);
  const proof = digest === null ? null : (io.readProof ?? readRegenerationProof)(root);
  if (digest !== null && proof !== null && proof.digest === digest) {
    return { argv: cadPytestArgv({ regenerate: false }), regenerate: false, note: regenerationProvenLine(proof), digest };
  }
  return { argv: cadPytestArgv({ regenerate: true }), regenerate: true, note: null, digest };
}
