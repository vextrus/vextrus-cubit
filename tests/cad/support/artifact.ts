// Shared plumbing for the node-side cad acceptance (tests/cad/**): finding the committed fixture
// corpus, spawning the CLI the test contract names, and reading an EntityGraph artifact without
// pretending to know more of its shape than the contract states.
//
// Nothing here reads product source. The CLI is driven exactly as the contract spells it
// (`uv run --project cad vextrus-cad …`) and the committed DXF inputs are read as inputs — they
// are the declared fixture corpus, not implementation.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout root — this file sits at tests/cad/support/. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Where the declared corpus lives (spec: `fixtures: cad/tests/fixtures/**`). */
export const FIXTURE_DIR = join(REPO_ROOT, "cad", "tests", "fixtures");

/** The fixtures the increment spec names by hand; the corpus may hold more and the rules cover them. */
export const NAMED_FIXTURES = ["basic", "blocks", "layouts"] as const;

/** The pinned parameter set, from the test contract. */
export const FLATTEN_POINT_CAP = 5000;

/** A parsed JSON document, described no more tightly than JSON itself is. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A generous spawn budget: the first `uv run` in a checkout materialises the project environment. */
const SPAWN_TIMEOUT_MS = 240_000;

export interface SpawnOutcome {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Assert the CLI package the spec names is present before spawning anything — a missing product
 * then fails as an assertion naming the directory, rather than as an opaque `uv` exit code.
 */
export function requireCadPackage(): void {
  const pkg = join(REPO_ROOT, "cad", "src", "vextrus_cad");
  expect(existsSync(pkg), `${pkg} is missing — the cad CLI package does not exist yet`).toBe(true);
}

/** Run a command inside the cad project, exactly as the test contract spells the invocation. */
export function runInCadProject(argv: readonly string[]): SpawnOutcome {
  const run = spawnSync("uv", ["run", "--project", "cad", ...argv], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
  });
  expect(run.error, `spawning \`uv run --project cad ${argv.join(" ")}\` failed: ${String(run.error)}`).toBeUndefined();
  return { status: run.status, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
}

/** `vextrus-cad ingest <input> --out <out>`, the only subcommand this increment ships. */
export function runIngest(input: string, out: string): SpawnOutcome {
  return runInCadProject(["vextrus-cad", "ingest", input, "--out", out]);
}

/**
 * The committed artifact roster, read from the corpus rather than frozen here: every
 * `<name>.entitygraph.json` in the fixture directory is a committed artifact owed a `<name>.dxf`
 * beside it. A later increment that adds a pair is covered without touching this file.
 */
export function committedArtifactNames(): string[] {
  expect(existsSync(FIXTURE_DIR), `${FIXTURE_DIR} is missing — the committed fixture corpus does not exist yet`).toBe(true);
  return readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith(".entitygraph.json"))
    .map((f) => f.slice(0, -".entitygraph.json".length))
    .sort();
}

export function fixtureDxfPath(name: string): string {
  return join(FIXTURE_DIR, `${name}.dxf`);
}

export function fixtureArtifactPath(name: string): string {
  return join(FIXTURE_DIR, `${name}.entitygraph.json`);
}

/** The committed artifact for `name`, as both raw text and parsed value. */
export function readCommittedArtifact(name: string): { text: string; graph: Record<string, JsonValue> } {
  const path = fixtureArtifactPath(name);
  expect(existsSync(path), `${path} is missing — the committed artifact does not exist yet`).toBe(true);
  const text = readFileSync(path, "utf8");
  return { text, graph: asObject(JSON.parse(text) as JsonValue, `${name}.entitygraph.json`) };
}

// ---- shape readers: narrow the contract's vocabulary without assuming beyond it ----

export function asObject(value: JsonValue | undefined, what: string): Record<string, JsonValue> {
  expect(typeof value === "object" && value !== null && !Array.isArray(value), `${what} must be an object`).toBe(true);
  return value as Record<string, JsonValue>;
}

export function asArray(value: JsonValue | undefined, what: string): JsonValue[] {
  expect(Array.isArray(value), `${what} must be an array`).toBe(true);
  return value as JsonValue[];
}

export function asString(value: JsonValue | undefined, what: string): string {
  expect(typeof value, `${what} must be a string`).toBe("string");
  return value as string;
}

export function asNumber(value: JsonValue | undefined, what: string): number {
  expect(typeof value, `${what} must be a number`).toBe("number");
  return value as number;
}

/** Every element of an artifact array read as an object (entities, derived, layouts, counters …). */
export function records(graph: Record<string, JsonValue>, key: string): Record<string, JsonValue>[] {
  return asArray(graph[key], key).map((entry, i) => asObject(entry, `${key}[${i}]`));
}

/** Originals and synthesised paint together — the two halves of the drawing's geometry. */
export function allDrawnEntities(graph: Record<string, JsonValue>): Record<string, JsonValue>[] {
  return [...records(graph, "entities"), ...records(graph, "derived")];
}

/** A `points` list read as [x, y] pairs, or null when the entity carries none. */
export function pointsOf(entity: Record<string, JsonValue>, what: string): [number, number][] | null {
  const raw = entity["points"];
  if (raw === undefined || raw === null) return null;
  return asArray(raw, `${what}.points`).map((p, i) => {
    const pair = asArray(p, `${what}.points[${i}]`);
    expect(pair.length, `${what}.points[${i}] must be an [x, y] pair`).toBe(2);
    return [asNumber(pair[0], `${what}.points[${i}][0]`), asNumber(pair[1], `${what}.points[${i}][1]`)] as [number, number];
  });
}

/** The signed shoelace area of a closed ring, so "carries its shoelace area" is checked, not trusted. */
export function shoelaceArea(points: readonly (readonly [number, number])[]): number {
  let twice = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(twice) / 2;
}

/** Every number anywhere inside a value — used to grade a bbox without dictating its shape. */
export function deepNumbers(value: JsonValue | undefined): number[] {
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) return value.flatMap((v) => deepNumbers(v));
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap((v) => deepNumbers(v));
  return [];
}

// ---- the committed DXF inputs, read as inputs ----

/** A DXF file as its (group code, value) pair stream. */
export function dxfPairs(text: string): { code: number; value: string }[] {
  const lines = text.split(/\r?\n/);
  const pairs: { code: number; value: string }[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]!.trim());
    if (!Number.isInteger(code)) continue;
    pairs.push({ code, value: lines[i + 1]!.trim() });
  }
  return pairs;
}

export interface DxfLayer {
  readonly aci: number | null;
  readonly trueColour: number | null;
}

/**
 * The LAYER table of a committed DXF, by layer name: group 62 is the colour index (negative when
 * the layer is off — the colour is its magnitude) and group 420 a packed true colour.
 */
export function dxfLayerTable(text: string): Map<string, DxfLayer> {
  const pairs = dxfPairs(text);
  const table = new Map<string, DxfLayer>();
  for (let i = 0; i < pairs.length; i += 1) {
    const head = pairs[i]!;
    if (head.code !== 0 || head.value !== "LAYER") continue;
    let name: string | null = null;
    let aci: number | null = null;
    let trueColour: number | null = null;
    for (let j = i + 1; j < pairs.length && pairs[j]!.code !== 0; j += 1) {
      const { code, value } = pairs[j]!;
      if (code === 2 && name === null) name = value;
      else if (code === 62 && aci === null) aci = Math.abs(Number(value));
      else if (code === 420 && trueColour === null) trueColour = Number(value);
    }
    if (name !== null) table.set(name, { aci, trueColour });
  }
  return table;
}
