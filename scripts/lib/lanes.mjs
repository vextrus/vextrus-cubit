// The gate's roster and its one exported home (ARCH-02). Every lane, stage and machine check the
// toolchain knows about is described here as an id plus the repo-relative input root it depends
// on; the status is computed by asking the tree whether that input is present. Nothing else may
// move a status — no environment variable, no flag, no frozen list — so a lane that has been built
// stops printing its skip the moment its inputs exist (C-06, B-23).
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

/**
 * The sharded method-hash manifests. Named and exported so a later increment arms the
 * `method-hash` lane by creating an input that matches it, never by editing the toolchain (C-06).
 */
export const METHOD_MANIFEST_GLOB = "src/**/*.methods.json";

/**
 * Every input root the toolchain probes, named once. A probe is a repo-relative path, or a glob
 * when the input is a family of files rather than one root.
 * @type {Readonly<Record<string, string>>}
 */
export const INPUT_ROOTS = Object.freeze({
  app: "src/app",
  tsconfig: "tsconfig.json",
  eslintConfig: "eslint.config.mjs",
  unitTests: "tests/**/*.test.ts",
  dbSchema: "db/schema.ts",
  dbMigrations: "db/migrations",
  dbTests: "db/__tests__",
  dbSeed: "db/seed.ts",
  methodManifests: METHOD_MANIFEST_GLOB,
  catalogue: "db/catalogue",
  cad: "cad",
  e2eTests: "tests/e2e",
  nodePin: ".nvmrc",
  packageManifest: "package.json",
});

/**
 * The closed lane set, in V-VERIFY order. `input` names the entry in {@link INPUT_ROOTS} whose
 * presence arms the lane.
 * @type {ReadonlyArray<{id: string, input: keyof typeof INPUT_ROOTS, title: string}>}
 */
const LANE_SPECS = Object.freeze([
  { id: "typegen", input: "app", title: "next typegen" },
  { id: "types", input: "tsconfig", title: "tsc --noEmit" },
  { id: "lint", input: "eslintConfig", title: "eslint ." },
  { id: "unit", input: "unitTests", title: "vitest run" },
  { id: "schema-drift", input: "dbSchema", title: "drizzle-kit generate into scratch" },
  { id: "method-hash", input: "methodManifests", title: "method-hash manifest" },
  { id: "catalogue-drift", input: "catalogue", title: "catalogue/bears table drift" },
  { id: "cad", input: "cad", title: "ruff check + pytest" },
  { id: "build", input: "app", title: "next build (cold, own distDir)" },
]);

/**
 * The stages that run outside the verify chain but answer to the same roster: the journey runner,
 * the database suite and the database commands (C-06).
 * @type {ReadonlyArray<{id: string, input: keyof typeof INPUT_ROOTS, title: string}>}
 */
const STAGE_SPECS = Object.freeze([
  { id: "e2e", input: "e2eTests", title: "playwright journeys" },
  { id: "test:db", input: "dbTests", title: "database suite" },
  { id: "db:migrate", input: "dbMigrations", title: "drizzle migrations" },
  { id: "db:drift", input: "dbSchema", title: "schema drift against the database" },
  { id: "seed", input: "dbSeed", title: "seed data" },
]);

/**
 * The machine's tools (V-CHECKUP). Each one is owed only when the input root that would use it is
 * present, so checkup probes what the tree actually needs and nothing else (B-23).
 * @type {ReadonlyArray<{id: string, input: keyof typeof INPUT_ROOTS, title: string}>}
 */
const MACHINE_CHECK_SPECS = Object.freeze([
  { id: "node", input: "nodePin", title: "Node pin" },
  { id: "pnpm", input: "packageManifest", title: "pnpm pin" },
  { id: "postgres", input: "dbSchema", title: "Postgres reachable" },
  { id: "db-roles", input: "dbSchema", title: "database roles" },
  { id: "uv", input: "cad", title: "uv" },
  { id: "typst", input: "cad", title: "typst" },
  { id: "libredwg", input: "cad", title: "libredwg" },
  { id: "ports", input: "app", title: "ports bindable" },
  { id: "storage-root", input: "app", title: "storage root" },
]);

/**
 * Does the input root exist under `rootDir`? A probe naming a glob is satisfied by any file that
 * matches it.
 * @param {string} rootDir
 * @param {string} probe repo-relative path or glob
 * @returns {boolean}
 */
export function inputExists(rootDir, probe) {
  const normalised = probe.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!normalised.includes("*")) return existsSync(join(rootDir, ...normalised.split("/")));
  const prefix = normalised.slice(0, normalised.indexOf("*"));
  const base = prefix.includes("/") ? prefix.slice(0, prefix.lastIndexOf("/")) : "";
  const start = base ? join(rootDir, ...base.split("/")) : rootDir;
  if (!existsSync(start)) return false;
  const pattern = globToRegExp(normalised);
  const stack = [start];
  while (stack.length > 0) {
    const dir = /** @type {string} */ (stack.pop());
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const rel = abs.slice(rootDir.length + 1).split(sep).join("/");
      if (pattern.test(rel)) return true;
      if (statSync(abs).isDirectory()) stack.push(abs);
    }
  }
  return false;
}

/**
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegExp(glob) {
  const body = glob
    .split("/")
    .map((segment) => (segment === "**" ? "@@" : segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")))
    .join("/")
    .replace(/@@\//g, "(?:.*/)?")
    .replace(/@@/g, ".*");
  return new RegExp(`^${body}$`);
}

/**
 * @typedef {{id: string, status: "armed" | "stub", probe: string}} Lane
 */

/**
 * @param {string} rootDir
 * @param {ReadonlyArray<{id: string, input: string, title: string}>} specs
 * @returns {Lane[]}
 */
function derive(rootDir, specs) {
  return specs.map((spec) => {
    const probe = INPUT_ROOTS[/** @type {keyof typeof INPUT_ROOTS} */ (spec.input)];
    if (probe === undefined) throw new Error(`${spec.id} names the input root ${spec.input}, which INPUT_ROOTS does not have`);
    return { id: spec.id, status: inputExists(rootDir, probe) ? "armed" : "stub", probe };
  });
}

/**
 * The verify chain's roster, in V-VERIFY order.
 * @param {string} rootDir
 * @returns {Lane[]}
 */
export function deriveLanes(rootDir) {
  return derive(rootDir, LANE_SPECS);
}

/**
 * The stages that answer to the roster without belonging to the verify chain.
 * @param {string} rootDir
 * @returns {Lane[]}
 */
export function deriveStages(rootDir) {
  return derive(rootDir, STAGE_SPECS);
}

/**
 * One stage by id.
 * @param {string} rootDir
 * @param {string} id
 * @returns {Lane}
 */
export function deriveStage(rootDir, id) {
  const stage = deriveStages(rootDir).find((entry) => entry.id === id);
  if (!stage) throw new Error(`no stage named ${id} — the roster's stage set is ${STAGE_SPECS.map((s) => s.id).join(", ")}`);
  return stage;
}

/**
 * The machine checks V-CHECKUP owes on this tree.
 * @param {string} rootDir
 * @returns {Lane[]}
 */
export function deriveMachineChecks(rootDir) {
  return derive(rootDir, MACHINE_CHECK_SPECS);
}

/**
 * A lane's human title, for the report only — never for a status.
 * @param {string} id
 * @returns {string}
 */
export function titleOf(id) {
  const spec = [...LANE_SPECS, ...STAGE_SPECS, ...MACHINE_CHECK_SPECS].find((entry) => entry.id === id);
  return spec ? spec.title : id;
}
