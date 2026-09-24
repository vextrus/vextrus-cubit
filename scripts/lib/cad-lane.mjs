// What the cad lane runs, and the one question that decides its price (V-VERIFY, v22 speed).
//
// THE COST THIS FILE EXISTS FOR. `pytest cad` collects the fixture-regeneration tests, and each
// RECOMPUTES a whole corpus from its generator. F-RCC6-BNBC's — 27 sheets of DXF, DWG, vector PDF and
// rasters — is ~80 seconds of the lane's ~100; F-RCC6's and F-ARCH's are a few seconds each. They ran
// on EVERY gate, including the overwhelming majority that touch nothing a generator reads.
//
// WHAT IS AND IS NOT GIVEN UP. Regeneration is the claim "the committed corpus is what the
// committed generator writes". It can only break when the generator, the model it reads, the
// corpus itself, or the extractor package underneath moves — so the lane asks git whether any of
// them did, and runs the regeneration when the answer is yes or when git cannot answer. The CHEAP
// half of the corpus's evidence is untouched and still runs every time: the golden lane reads the
// committed bytes against the manifest (tests/golden + cad/tests/<corpus>), and every sanity suite
// that reads the committed drawings runs exactly as before. What is skipped is the recomputation,
// and only when nothing it reads has moved.
//
// PER CORPUS (session 8). Each corpus names its own inputs, so the question is asked once per
// corpus: an F-ARCH edit re-runs F-ARCH's few seconds and never BNBC's eighty, and a BNBC model edit
// re-runs both, because F-ARCH reads its structure from BNBC's model. One global list made every
// edit under fixtures/gen/ pay BNBC's regeneration once.
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
 * @typedef {{id: string, test: string, inputs: ReadonlyArray<string>}} Corpus
 */

/**
 * Every corpus the cad lane can recompute: its id, the test (as the lane is invoked, from the
 * checkout) that recomputes it, and the paths whose bytes that recomputation reads — its generator,
 * the corpus it writes, the extractor package it imports, its own suite. A path is a prefix: a
 * directory ends in `/`, so `fixtures/rcc6/` is F-RCC6's corpus and not F-RCC6-BNBC's.
 * @type {ReadonlyArray<Corpus>}
 */
export const FIXTURE_CORPORA = Object.freeze([
  Object.freeze({
    id: "rcc6",
    test: "cad/tests/sanity/test_rcc6_regenerate.py",
    inputs: Object.freeze(["fixtures/gen/rcc6.py", "fixtures/rcc6/", "cad/src/"]),
  }),
  Object.freeze({
    id: "rcc6-bnbc",
    test: "cad/tests/sanity/test_rcc6_bnbc_regenerate.py",
    inputs: Object.freeze(["fixtures/gen/rcc6_bnbc/", "fixtures/rcc6-bnbc/", "cad/src/", "cad/tests/rcc6_bnbc/"]),
  }),
  // F-ARCH reads its structure from F-RCC6-BNBC's model (fixtures/gen/arch/DECISIONS.md A-01) and
  // imports no extractor module: only ezdxf, which the environment pins below.
  Object.freeze({
    id: "arch",
    test: "cad/tests/sanity/test_arch_regenerate.py",
    inputs: Object.freeze(["fixtures/gen/arch/", "fixtures/arch/", "fixtures/gen/rcc6_bnbc/model.py", "cad/tests/arch/"]),
  }),
]);

/** The tests that RECOMPUTE a fixture corpus from its generator. Everything else under cad/tests reads committed bytes. */
export const FIXTURE_REGENERATION_TESTS = Object.freeze(FIXTURE_CORPORA.map((corpus) => corpus.test));

/** Beyond a corpus's own inputs, what pins the environment every recomputation runs in. */
export const REGENERATION_ENVIRONMENT = Object.freeze(["cad/pyproject.toml", "cad/uv.lock"]);

/**
 * What could move one corpus's recomputation: its inputs, the environment, and its regeneration
 * test itself — a change to the test that makes the claim must run the claim.
 * @param {Corpus} corpus
 * @returns {string[]}
 */
export function corpusInputs(corpus) {
  return [...corpus.inputs, corpus.test, ...REGENERATION_ENVIRONMENT];
}

/**
 * Could this corpus have moved, given the paths a diff named? A path is a repo-relative,
 * forward-slashed name as `git diff --name-only` prints it.
 * @param {Corpus} corpus
 * @param {ReadonlyArray<string>} paths
 * @returns {boolean}
 */
export function touchesCorpus(corpus, paths) {
  const inputs = corpusInputs(corpus);
  return paths.some((path) => {
    const name = path.replace(/\\/g, "/").replace(/^\.\//, "");
    return inputs.some((input) => name.startsWith(input));
  });
}

/**
 * Could ANY corpus have moved?
 * @param {ReadonlyArray<string>} paths
 * @returns {boolean}
 */
export function touchesFixtureInputs(paths) {
  return FIXTURE_CORPORA.some((corpus) => touchesCorpus(corpus, paths));
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
  const run = git ?? gitOf(root);
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
  return [...lines(committed.stdout), ...porcelainPaths(working.stdout)];
}

/**
 * The cad lane's pytest argv. The recomputations of the corpora NOT being regenerated are dropped
 * from the collection — deselected rather than SKIPPED, deliberately: cad/tests/sanity/conftest.py
 * fails any session over a skip it cannot explain (a skip is a claim about this machine, and this
 * is not one), and work that was never selected is not a skip.
 *
 * `--ignore=<path>` and not `--deselect=<nodeid>`: cad/pyproject.toml carries the pytest
 * configuration, so pytest's rootdir is `cad/` and every collected node id is spelled
 * `tests/sanity/…` while the lane is invoked from the checkout with `cad/tests/sanity/…`. A
 * `--deselect` that misses simply deselects NOTHING, silently — the lane would print its skip line
 * and pay the recomputation anyway. `--ignore` takes a filesystem path, so it cannot miss quietly,
 * and it drops the module before it is even imported.
 * The suites that run the cad collection themselves (tests/cad/dwg/dwg-lane, tests/cad/licence)
 * still say `{regenerate: false}` — every recomputation set aside — or `{regenerate: true}`, none.
 * @param {ReadonlyArray<string> | {regenerate: boolean}} regenerate the ids of the corpora whose
 *   recomputation runs, or all / none of them
 * @returns {string[]}
 */
export function cadPytestArgv(regenerate) {
  const running = !("regenerate" in regenerate) ? regenerate : regenerate.regenerate ? FIXTURE_CORPORA.map((corpus) => corpus.id) : [];
  const ignored = FIXTURE_CORPORA.filter((corpus) => !running.includes(corpus.id)).map((corpus) => `--ignore=${corpus.test}`);
  return ["pytest", "cad", ...ignored, ...REFERENCE_TESTS.map((test) => `--ignore=${test}`), ...CAD_WORKERS];
}

/**
 * The cad suite's proofs against a real drawing the owner keeps beside the product (L-CAD-09): the
 * one long proof in the suite (~21 s of one core, a 22,000-entity set through LibreDWG), which the
 * gate's golden lane runs every time (scripts/verify.mjs GOLDEN_PYTEST, `pnpm test:golden`) and
 * verify's cad lane sets aside, so verify's budget does not carry it twice a gate.
 */
export const REFERENCE_TESTS = Object.freeze(["cad/tests/dwg/test_dwg_reference.py"]);

/**
 * The suite runs across six pytest-xdist workers (V-VERIFY). Serially it was the verify chain's wall
 * — 33.8 s alone, ~50 s beside the unit lane — and one test (the reference structural drawing's
 * conversion, 18.2 s) is its floor; six workers took it to ~24 s on a 24-core box without starving
 * the lanes beside it.
 */
export const CAD_WORKERS = Object.freeze(["-n", "6"]);

/**
 * THE PROOF A GREEN REGENERATION LEAVES (V-VERIFY, 2026-09-21; per corpus since session 8).
 *
 * The diff above is taken against main, so a lane branch that touched a corpus's inputs ONCE would
 * pay its recomputation on every gate after. The regeneration is a claim about BYTES — "the
 * committed corpus is what the committed generator writes" — over exactly the inputs it reads. So a
 * green run writes down, per corpus it recomputed, a digest of those inputs: the index's blob ids of
 * every tracked file under the corpus's inputs and the environment pins, plus the bytes of every
 * working-tree change to them (a modified, staged, untracked or deleted file is hashed as it stands,
 * or as absent). A later gate whose corpus inputs digest the same skips that corpus's recomputation
 * and says so, naming the proof; one byte of its generator, a lock or its corpus moved is a new
 * digest, and that gate regenerates it — and only it. The proof is machine-local — under
 * node_modules/.cache, never committed — so a fresh checkout and CI regenerate once and then hold
 * their own.
 */
export const REGENERATION_PROOF_PATH = "node_modules/.cache/cubit/cad-regeneration.json";

/** @param {string} root @returns {(argv: string[]) => {status: number | null, stdout: string}} */
function gitOf(root) {
  return (argv) => {
    const result = spawnSync("git", argv, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return { status: result.error === undefined ? result.status : 1, stdout: result.stdout ?? "" };
  };
}

/**
 * The paths a porcelain listing names, as the working tree spells them (a rename's new name).
 * Porcelain's first two columns are the status and the third is a space, so the path starts at
 * column 3 — the line is NOT trimmed first, or a path would lose its own first characters.
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
 * The digest of everything one corpus's regeneration reads, as this tree holds it. Null — never a
 * digest — when git cannot answer: no proof can then be matched, and the lane regenerates.
 * @param {string} root
 * @param {Corpus} corpus
 * @param {(argv: string[]) => {status: number | null, stdout: string}} [git]
 * @param {(absolutePath: string) => Buffer | null} [readFile] injected; null for a file that is not there
 * @returns {string | null}
 */
export function regenerationInputsDigest(root, corpus, git, readFile) {
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
  const inputs = corpusInputs(corpus);
  const indexed = run(["ls-files", "-s", "--", ...inputs]);
  if (indexed.status !== 0) return null;
  const working = run(["status", "--porcelain", "--untracked-files=all", "--", ...inputs]);
  if (working.status !== 0) return null;
  // Content-addressed: each input is its path and the git blob id of the bytes the regeneration
  // would read. A tracked file the working tree leaves alone is the index's blob; every path the
  // working tree carries beyond the index is the blob id of its bytes NOW, or not there at all. So
  // a mid-edit gate digests the edit, a deleted file digests as the tree without it, and committing
  // exactly the bytes a green regeneration proved digests the same as before the commit.
  /** @type {Map<string, string>} */
  const blobs = new Map();
  for (const line of indexed.stdout.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const blob = line.slice(0, tab).split(" ")[1];
    const name = line.slice(tab + 1);
    // `ls-files -- <prefix>` is asked for every input at once; keep only this corpus's own paths.
    if (blob !== undefined && inputs.some((input) => name.startsWith(input))) blobs.set(name, blob);
  }
  for (const name of porcelainPaths(working.stdout)) {
    if (!inputs.some((input) => name.startsWith(input))) continue;
    const bytes = read(join(root, name));
    if (bytes === null) blobs.delete(name);
    else blobs.set(name, gitBlobId(bytes));
  }
  const hash = createHash("sha256");
  hash.update(`corpus ${corpus.id}: inputs by blob\n`);
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

/** @param {unknown} entry @returns {entry is RegenerationProof} */
function isProof(entry) {
  const candidate = /** @type {{digest?: unknown, provedAt?: unknown} | null} */ (entry);
  return typeof candidate?.digest === "string" && /^[0-9a-f]{64}$/.test(candidate.digest) && typeof candidate.provedAt === "string";
}

/**
 * The proofs the last green regenerations on this machine left, by corpus id. A torn or malformed
 * file — or an entry that is not a proof — is the same lawful answer as an absent one: regenerate.
 * @param {string} root
 * @param {(absolutePath: string) => Buffer | null} [readFile]
 * @returns {Record<string, RegenerationProof>}
 */
export function readRegenerationProofs(root, readFile) {
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
  if (bytes === null) return {};
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    const corpora = parsed?.corpora;
    if (corpora === null || typeof corpora !== "object") return {};
    /** @type {Record<string, RegenerationProof>} */
    const out = {};
    for (const corpus of FIXTURE_CORPORA) {
      const entry = corpora[corpus.id];
      if (isProof(entry)) out[corpus.id] = { digest: entry.digest, provedAt: entry.provedAt };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Write the proofs down — after the lane came back green, never before (scripts/verify.mjs is the
 * one caller, on the cad lane's own verdict), one per corpus the lane recomputed, KEEPING the proofs
 * of the corpora it did not. Atomic: laid down under a name only this process uses and renamed into
 * place, so a gate reading it never sees half a proof.
 * @param {string} root
 * @param {Record<string, string>} digests by corpus id — the corpora this green run recomputed
 * @param {string} [provedAt]
 * @param {(absolutePath: string) => Buffer | null} [readFile]
 * @returns {Record<string, RegenerationProof>} every proof the file now holds
 */
export function recordRegenerationProofs(root, digests, provedAt = new Date().toISOString(), readFile) {
  const proofs = { ...readRegenerationProofs(root, readFile) };
  for (const [id, digest] of Object.entries(digests)) proofs[id] = { digest, provedAt };
  const file = join(root, REGENERATION_PROOF_PATH);
  mkdirSync(dirname(file), { recursive: true });
  const partial = `${file}.${process.pid}.tmp`;
  const inputs = Object.fromEntries(FIXTURE_CORPORA.map((corpus) => [corpus.id, corpusInputs(corpus)]));
  writeFileSync(partial, `${JSON.stringify({ corpora: proofs, inputs }, null, 2)}\n`, "utf8");
  renameSync(partial, file);
  return proofs;
}

/**
 * The line the lane prints when it recomputes less than every corpus: which it set aside, and why —
 * nothing they read moved against the diff's base, or a green regeneration proved exactly these
 * inputs (the digest and when) — so a reader can find the proof to doubt it.
 * @param {ReadonlyArray<{id: string, why: "unmoved" | "proven", proof?: RegenerationProof}>} skipped
 * @returns {string}
 */
export function regenerationSkippedLine(skipped) {
  const said = skipped.map((entry) =>
    entry.why === "unmoved"
      ? `${entry.id} (nothing it reads moved)`
      : `${entry.id} (its inputs digest ${entry.proof?.digest.slice(0, 12)}, the tree a green regeneration proved at ${entry.proof?.provedAt})`,
  );
  return `cad: fixture regeneration skipped for ${said.join("; ")} — ${REGENERATION_PROOF_PATH} holds the proofs; the golden lane still checks every committed corpus`;
}

/**
 * What this tree's cad lane should run, and what it owes the reader for it, corpus by corpus.
 * `digests` names, for each corpus that regenerates over a digested tree, the digest verify.mjs
 * records as its proof when the lane comes back green.
 * @param {string} root
 * @param {(argv: string[]) => {status: number | null, stdout: string}} [git]
 * @param {{readProofs?: (root: string) => Record<string, RegenerationProof>, readFile?: (absolutePath: string) => Buffer | null}} [io]
 * @returns {{argv: string[], regenerate: string[], note: string | null, digests: Record<string, string>}}
 */
export function cadLane(root, git, io = {}) {
  const paths = changedPaths(root, git);
  if (paths === null) {
    const all = FIXTURE_CORPORA.map((corpus) => corpus.id);
    return { argv: cadPytestArgv(all), regenerate: all, note: null, digests: {} };
  }
  /** @type {string[]} */
  const regenerate = [];
  /** @type {Array<{id: string, why: "unmoved" | "proven", proof?: RegenerationProof}>} */
  const skipped = [];
  /** @type {Record<string, string>} */
  const digests = {};
  /** @type {Record<string, RegenerationProof> | null} */
  let proofs = null;
  for (const corpus of FIXTURE_CORPORA) {
    if (!touchesCorpus(corpus, paths)) {
      skipped.push({ id: corpus.id, why: "unmoved" });
      continue;
    }
    const digest = regenerationInputsDigest(root, corpus, git, io.readFile);
    if (digest !== null) {
      proofs ??= (io.readProofs ?? readRegenerationProofs)(root);
      const proof = proofs[corpus.id];
      if (proof !== undefined && proof.digest === digest) {
        skipped.push({ id: corpus.id, why: "proven", proof });
        continue;
      }
      digests[corpus.id] = digest;
    }
    regenerate.push(corpus.id);
  }
  return { argv: cadPytestArgv(regenerate), regenerate, note: skipped.length === 0 ? null : regenerationSkippedLine(skipped), digests };
}
