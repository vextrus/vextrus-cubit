// Which suites need a live Postgres, derived and never listed (ARCH-02, B-19).
//
// `pnpm test` is the unit lane: it must pass on a machine with no cluster at all, so every suite
// that reaches db/__tests__/harness.ts — directly or through any support module — belongs to the
// database lane instead. A hand-kept list of those files would be wrong the first time a suite grew
// an import, and wrong silently: the suite would either fail for want of a cluster in the unit lane,
// or vanish from both lanes. So the partition is computed from the tree's own import graph, by the
// one function both vitest configs call — there is no second opinion about where a suite runs.
//
// This is a lane partition, not an architecture law: it decides which runner collects a file, and
// its answer is checked against the collections themselves in tests/toolchain/test-lane-split.test.ts.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** The roots a suite can live under, and the module whose reach defines the database lane. */
const SUITE_ROOTS = ["src", "tests", "db"];
const HARNESS = join("db", "__tests__", "harness.ts");

/** A suite, in either of the two spellings this tree writes one in. */
const SUITE = /\.test\.tsx?$/;

/**
 * Every relative import and dynamic import a file names; nothing from node_modules is followed.
 * @param {string} root the checkout root
 * @param {string} file an absolute path
 * @returns {string[]}
 */
function localImports(root, file) {
  const text = readFileSync(file, "utf8");
  const found = [];
  for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g)) {
    const specifier = match[1] ?? "";
    // `@/` is the tree's own alias for src (ARCH-01); everything else that is not relative is a package.
    const base = specifier.startsWith(".") ? resolve(dirname(file), specifier) : specifier.startsWith("@/") ? join(root, "src", specifier.slice(2)) : null;
    if (base === null) continue;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.mjs`, join(base, "index.ts")]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        found.push(candidate);
        break;
      }
    }
  }
  return found;
}

/**
 * The suites that reach the live-database harness, as paths relative to `root` with `/` separators
 * — sorted, so two readings of one tree are the same list.
 * @param {string} root the checkout root
 * @returns {string[]}
 */
export function pgBoundSuites(root) {
  /** @type {string[]} */
  const files = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:ts|tsx|mts)$/.test(entry.name)) files.push(full);
    }
  };
  for (const suiteRoot of SUITE_ROOTS) if (existsSync(join(root, suiteRoot))) walk(join(root, suiteRoot));

  // Reachability is answered backwards, from the harness outwards along reversed edges: whoever
  // imports something that reaches the harness reaches it too. Backwards is linear and needs no
  // cycle rule — a walk forwards from every suite re-answers the same questions once per suite.
  /** @type {Map<string, string[]>} */
  const importers = new Map();
  for (const file of files) {
    for (const target of localImports(root, file)) {
      const known = importers.get(target);
      if (known === undefined) importers.set(target, [file]);
      else known.push(file);
    }
  }

  const bound = new Set([join(root, HARNESS)]);
  for (let frontier = [...bound]; frontier.length > 0; ) {
    /** @type {string[]} */
    const next = [];
    for (const file of frontier) {
      for (const importer of importers.get(file) ?? []) {
        if (bound.has(importer)) continue;
        bound.add(importer);
        next.push(importer);
      }
    }
    frontier = next;
  }

  return [...bound]
    .filter((file) => SUITE.test(file))
    .map((file) => relative(root, file).replace(/\\/g, "/"))
    .sort();
}

/**
 * The same partition, split the way the two vitest configs need it.
 * @param {string} root the checkout root
 * @returns {{database: string[], databaseOutsideDb: string[]}}
 */
export function laneSplit(root) {
  const database = pgBoundSuites(root);
  return { database, databaseOutsideDb: database.filter((file) => !file.startsWith("db/")) };
}
