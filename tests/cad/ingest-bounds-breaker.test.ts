// Breaker acceptance — the two bounds the pinned parameter set names, driven past the corpus.
//
// L-CAD-05 pins a flatten point cap and L-CAD-03 pins a depth cap *and* a derived-entity budget.
// Both are bounds on what one shot of the extractor may cost; neither is a licence to hand back a
// different drawing than the one that was read. The committed corpus reaches neither bound (its
// longest flattening is 66 points and its deepest block tree mints nine derived entities), so the
// behaviour at each bound is graded here, on drawings written for the purpose.
//
// A third case grades the one outcome the CLI contract leaves unstated: a destination it cannot
// write. `ingest` documents two endings — exit 0 having written the artifact, or a loud refusal
// naming the drawing with `--out` untouched (L-CAD-04). A Python traceback is neither: it exits
// non-zero without naming the sheet, so nothing downstream can say which drawing was refused.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { entityGraphSchema } from "../../src/core/entitygraph/schema";
import {
  asArray,
  asNumber,
  asObject,
  asString,
  FLATTEN_POINT_CAP,
  type JsonValue,
  pointsOf,
  records,
  REPO_ROOT,
  requireCadPackage,
  runIngest,
} from "./support/artifact";

/** The pinned derived-entity budget (L-CAD-03), spelled here as the parameter set spells it. */
const DERIVED_ENTITY_BUDGET = 200_000;

/**
 * How long one shot over a four-kilobyte drawing may take before the run counts as unbounded rather
 * than merely generous (L-CAD-04). An expansion held to the pinned budget settles in a few seconds;
 * the margin here is more than tenfold.
 */
const EXPANSION_BOUND_MS = 60_000;

/** A hundred-metre radius circle in a millimetre drawing — an ordinary site plan's setting-out arc. */
const CIRCLE_RADIUS = 100_000;

const scratchDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "cubit-cad-bounds-"));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

/** A minimal R12 drawing: an optional header body, an optional BLOCKS body, and its ENTITIES. */
function r12(header: readonly string[], blocks: readonly string[], entities: readonly string[]): string {
  return [
    "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", ...header, "0", "ENDSEC",
    ...(blocks.length > 0 ? ["0", "SECTION", "2", "BLOCKS", ...blocks, "0", "ENDSEC"] : []),
    "0", "SECTION", "2", "ENTITIES", ...entities, "0", "ENDSEC",
    "0", "EOF", "",
  ].join("\n");
}

const BIG_CIRCLE_DXF = r12(
  ["9", "$INSUNITS", "70", "4"],
  [],
  ["0", "CIRCLE", "5", "A1", "8", "0", "10", "0.0", "20", "0.0", "30", "0.0", "40", `${CIRCLE_RADIUS}.0`],
);

const ONE_LINE_DXF = r12(
  [],
  [],
  ["0", "LINE", "5", "B2", "8", "0", "10", "0.0", "20", "0.0", "30", "0.0", "11", "1.0", "21", "1.0", "31", "0.0"],
);

/**
 * A block tree that branches `branch` ways at each of `depth` levels. Every instance is lawful and
 * the whole file is a few kilobytes; what makes it hostile is that the expansion below the depth cap
 * is branch^8 instances, and nothing in the extractor is obliged to stop walking it.
 */
function nestedBlockTreeDxf(branch: number, depth: number): string {
  let handle = 0x1000;
  const nextHandle = (): string => (handle++).toString(16).toUpperCase();

  function blockDefinition(name: string, body: readonly string[]): string[] {
    return [
      "0", "BLOCK", "5", nextHandle(), "8", "0", "2", name, "70", "0",
      "10", "0.0", "20", "0.0", "30", "0.0", "3", name, "1", "",
      ...body,
      "0", "ENDBLK", "5", nextHandle(), "8", "0",
    ];
  }

  const blocks: string[] = blockDefinition("L0", [
    "0", "LINE", "5", nextHandle(), "8", "0",
    "10", "0.0", "20", "0.0", "30", "0.0", "11", "1.0", "21", "0.0", "31", "0.0",
  ]);

  for (let level = 1; level <= depth; level += 1) {
    const body: string[] = [];
    for (let i = 0; i < branch; i += 1) {
      body.push(
        "0", "INSERT", "5", nextHandle(), "8", "0", "2", `L${level - 1}`,
        "10", String(i * 2), "20", "0.0", "30", "0.0",
      );
    }
    blocks.push(...blockDefinition(`L${level}`, body));
  }

  return r12([], blocks, [
    "0", "INSERT", "5", "FFF1", "8", "0", "2", `L${depth}`, "10", "0.0", "20", "0.0", "30", "0.0",
  ]);
}

function readArtifact(path: string): Record<string, JsonValue> {
  return asObject(JSON.parse(readFileSync(path, "utf8")) as JsonValue, `the artifact at ${path}`);
}

/** One named record out of an array-valued top-level key, by its own `space` or `name`. */
function namedRecord(
  graph: Record<string, JsonValue>,
  key: "counters" | "layouts",
  field: "space" | "name",
  wanted: string,
): Record<string, JsonValue> {
  const found = records(graph, key).find((record) => asString(record[field], `${key}[].${field}`) === wanted);
  expect(found, `no ${key} record for "${wanted}"`).toBeDefined();
  return found as Record<string, JsonValue>;
}

/** An [x, y] corner of a bbox record. */
function corner(bbox: Record<string, JsonValue>, which: "min" | "max"): [number, number] {
  const pair = asArray(bbox[which], `bbox.${which}`);
  return [asNumber(pair[0], `bbox.${which}[0]`), asNumber(pair[1], `bbox.${which}[1]`)];
}

describe("breaker: the bounds one shot of the extractor runs under", () => {
  it("a curve the flatten cap truncates still describes the whole curve", () => {
    // L-CAD-05 flattens curves "at fixed tolerance with a point cap whose trip is counted". The cap
    // bounds how finely a curve may be described, not how much of it is described: a circle handed
    // back as the first slice of its own outline is a different drawing, and every stage downstream
    // (the space's extents, the shoelace area, anything that paints it) reads the fragment as the
    // whole. The artifact is frozen per revision and never re-opened (L-CAD-01), so it is permanent.
    requireCadPackage();
    const dir = scratch();
    const input = join(dir, "site-circle.dxf");
    const out = join(dir, "site-circle.entitygraph.json");
    writeFileSync(input, BIG_CIRCLE_DXF, "utf8");

    const run = runIngest(input, out);
    expect(run.status, `ingest exited ${String(run.status)}\n${run.stdout}\n${run.stderr}`).toBe(0);

    const graph = readArtifact(out);
    expect(() => entityGraphSchema.parse(graph)).not.toThrow();

    const entities = records(graph, "entities");
    expect(entities.length, "the drawing carries exactly one circle").toBe(1);
    const circle = entities[0] as Record<string, JsonValue>;
    expect(asString(circle["type"], "entities[0].type")).toBe("CIRCLE");
    expect(circle["closed"], "a circle closes").toBe(true);

    const points = pointsOf(circle, "entities[0]");
    expect(points, "the circle must reach the artifact as flattened geometry").not.toBeNull();
    const flattened = points as [number, number][];

    // The cap itself is honoured and its trip is counted — neither is asked to change here.
    expect(flattened.length, `flattening produced ${flattened.length} points`).toBeLessThanOrEqual(FLATTEN_POINT_CAP);
    const capped = asObject(
      namedRecord(graph, "counters", "space", "model")["flatten_capped"],
      "counters[model].flatten_capped",
    );
    expect(
      asNumber(capped["CIRCLE"], "counters[model].flatten_capped.CIRCLE"),
      "the cap trip is counted for CIRCLE in model space",
    ).toBeGreaterThanOrEqual(1);

    // Coverage. A circle of radius r reaches r in each of the four directions; a 5000-vertex
    // inscribed polygon reaches 0.9999999 of that, so a whole-curve flattening clears 99% with room
    // to spare, and a flattening that stops partway round cannot.
    const reach = CIRCLE_RADIUS * 0.99;
    const xs = flattened.map(([x]) => x);
    const ys = flattened.map(([, y]) => y);
    const extremes: readonly (readonly [string, number])[] = [
      ["east", Math.max(...xs)],
      ["north", Math.max(...ys)],
      ["west", -Math.min(...xs)],
      ["south", -Math.min(...ys)],
    ];
    for (const [direction, reached] of extremes) {
      expect(
        reached,
        `the flattened circle reaches only ${reached} ${direction} of centre, short of its radius ${CIRCLE_RADIUS} — the cap truncated the curve instead of coarsening it`,
      ).toBeGreaterThanOrEqual(reach);
    }

    // The space's extents are taken over those same points, so a truncated curve mis-states them.
    const bbox = asObject(namedRecord(graph, "layouts", "name", "model")["bbox"], "layouts[model].bbox");
    const [minX, minY] = corner(bbox, "min");
    const [maxX, maxY] = corner(bbox, "max");
    expect(minX, `model extents start at x=${minX}, inside the circle`).toBeLessThanOrEqual(-reach);
    expect(minY, `model extents start at y=${minY}, inside the circle`).toBeLessThanOrEqual(-reach);
    expect(maxX, `model extents end at x=${maxX}, inside the circle`).toBeGreaterThanOrEqual(reach);
    expect(maxY, `model extents end at y=${maxY}, inside the circle`).toBeGreaterThanOrEqual(reach);

    // And the shoelace area over the points the artifact carries then lands on the circle's own.
    const wholeCircle = Math.PI * CIRCLE_RADIUS * CIRCLE_RADIUS;
    const area = asNumber(circle["area"], "entities[0].area");
    expect(
      Math.abs(area - wholeCircle) / wholeCircle,
      `the recorded area ${area} is not the area of a circle of radius ${CIRCLE_RADIUS} (${wholeCircle})`,
    ).toBeLessThan(0.02);
  }, 600_000);

  it("the expansion of a nested block tree is bounded, not merely capped in depth", () => {
    // L-CAD-03 puts nested recursion "under a depth cap and a derived-entity budget". The depth cap
    // stops the extractor descending; the budget is what is meant to stop it *working*. Here the
    // budget never engages — every instance below the cap is counted as a loss rather than minted —
    // so a four-kilobyte drawing costs 7^8 expansions, and each further branch multiplies that by
    // seven again. One shot of a stateless CLI over an uploaded file has no other bound.
    requireCadPackage();
    const dir = scratch();
    const input = join(dir, "nested.dxf");
    const out = join(dir, "nested.entitygraph.json");
    const drawing = nestedBlockTreeDxf(7, 10);
    writeFileSync(input, drawing, "utf8");
    expect(drawing.length, "the hostile drawing is small").toBeLessThan(32_768);

    const started = Date.now();
    const run = spawnSync("uv", ["run", "--project", "cad", "vextrus-cad", "ingest", input, "--out", out], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: EXPANSION_BOUND_MS,
    });
    const elapsed = Date.now() - started;

    expect(
      elapsed,
      `one shot over a ${drawing.length}-byte drawing was still expanding after ${elapsed} ms and had to be killed at ${EXPANSION_BOUND_MS} ms — the pinned derived-entity budget of ${DERIVED_ENTITY_BUDGET} bounds what is recorded, not what is walked`,
    ).toBeLessThan(EXPANSION_BOUND_MS);
    expect(run.signal, `the run was killed with ${String(run.signal)}`).toBeNull();
    expect(run.status, `ingest exited ${String(run.status)}\n${run.stderr ?? ""}`).toBe(0);

    // Whatever bound stops the walk, the artifact still has to be one the mirror admits, and the
    // truncation still has to say so (R-TO-001).
    const graph = readArtifact(out);
    expect(() => entityGraphSchema.parse(graph)).not.toThrow();
    expect(
      namedRecord(graph, "counters", "space", "model")["explode_truncated"],
      "an expansion this deep is truncated, and says so",
    ).toBe(true);
  }, 600_000);

  it("a destination it cannot write is refused by name, not by stack trace", () => {
    // The CLI contract fixes two endings for `ingest`: exit 0 having written the artifact, or a loud
    // refusal that names the drawing on stderr and leaves `--out` untouched (L-CAD-04). Handing an
    // operator an unhandled Python traceback is a third: it exits non-zero without naming the sheet,
    // and points at the extractor's own source instead of at what the operator got wrong.
    requireCadPackage();
    const dir = scratch();
    const input = join(dir, "one-line.dxf");
    writeFileSync(input, ONE_LINE_DXF, "utf8");

    // `--out` naming a directory that already exists: an ordinary slip, and one no drawing can cure.
    const destination = join(dir, "artifacts");
    mkdirSync(destination);

    const run = runIngest(input, destination);

    expect(run.status, "a destination it cannot write is a refusal, so the exit is non-zero").not.toBe(0);
    expect(
      run.stderr.includes("Traceback (most recent call last)"),
      `the refusal arrived as a Python traceback:\n${run.stderr}`,
    ).toBe(false);
    expect(
      run.stderr.includes(input) || run.stderr.includes(destination),
      `the refusal names neither the drawing nor the destination:\n${run.stderr}`,
    ).toBe(true);

    // `--out` is untouched, and the invocation left no scratch behind it (L-CAD-04: stateless).
    expect(existsSync(destination) && statSync(destination).isDirectory(), "--out was left as it stood").toBe(true);
    expect(readdirSync(destination), "the destination directory gained nothing").toEqual([]);
    expect(
      readdirSync(dir).filter((entry) => entry.startsWith(".vextrus-cad-")),
      "a refused invocation left a staging directory behind",
    ).toEqual([]);
  }, 600_000);
});
