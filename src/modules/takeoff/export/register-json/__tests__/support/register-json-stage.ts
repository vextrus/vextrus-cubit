/**
 * The stage the register-JSON acceptance stands on: the door under test, the committed reading it
 * is a function of, and the committed artefacts drift is judged against.
 *
 * The door is loaded by repo-relative path rather than imported statically, so a module the Builder
 * has not written yet fails as an assertion naming the file — the red this increment is owed —
 * rather than as a collection death that reads as the suite's own defect.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { expect } from "vitest";
import type { RegisterView } from "@/modules/takeoff/register-ui/view";

/** The checkout this lane runs at the root of. */
export const REPO_ROOT: string = process.cwd();

/** The module's one public surface (test contract: the interfaces). */
export const REGISTER_JSON_MODULE = "src/modules/takeoff/export/register-json/index.ts";

/** The hand-authored reading every assertion here is made over (declared fixture). */
export const SAMPLE_VIEW_FIXTURE = "src/modules/takeoff/export/register-json/__tests__/fixtures/register-view.sample.json";

/** The committed serialization of that reading (declared fixture). */
export const EXAMPLE_FIXTURE = "src/modules/takeoff/export/register-json/__tests__/fixtures/register-json.v1.example.json";

/** The committed JSON Schema the live Zod schema is held against (declared fixture). */
export const SCHEMA_FIXTURE = "src/modules/takeoff/export/register-json/__tests__/fixtures/register-json.v1.schema.json";

/** What a deliberate schema change owes, quoted in every drift failure. */
export const BASELINE_DUTY = "a deliberate change re-baselines it in its own `baseline:`-subject commit naming AC-2";

/* ------------------------------------------------------------------ the door */

/**
 * The surface the criteria name, typed structurally: the acceptance judges what the module ANSWERS,
 * so nothing here binds the Builder to an inner file, only to the exports the interfaces declare.
 */
export type RegisterJsonDoor = {
  readonly REGISTER_JSON_SCHEMA_VERSION: unknown;
  readonly RegisterJsonDocument: z.ZodType<unknown>;
  readonly registerJsonOf: (view: RegisterView) => unknown;
  readonly serializeRegisterJson: (document: unknown) => string;
};

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** The export door, with every export the interfaces declare present and of the shape they declare. */
export async function registerJsonDoor(): Promise<RegisterJsonDoor> {
  const loaded = await productModule<Record<string, unknown>>(REGISTER_JSON_MODULE);
  expect(typeof loaded["registerJsonOf"], `${REGISTER_JSON_MODULE} exports \`registerJsonOf\` as a function (AC-1)`).toBe("function");
  expect(typeof loaded["serializeRegisterJson"], `${REGISTER_JSON_MODULE} exports \`serializeRegisterJson\` as a function (interfaces)`).toBe("function");
  const schema = loaded["RegisterJsonDocument"] as { safeParse?: unknown } | undefined;
  expect(typeof schema?.safeParse, `${REGISTER_JSON_MODULE} exports \`RegisterJsonDocument\` as a Zod schema (AC-1)`).toBe("function");
  return loaded as unknown as RegisterJsonDoor;
}

/* ------------------------------------------------------------------ committed files */

/**
 * A committed file this increment owes, read as text; absent says so by name. The only files read
 * through here are the three declared FIXTURES under `__tests__/fixtures/` — the reading the export
 * is a function of, and the two committed artefacts drift is judged against. No product source is
 * read anywhere in this suite: the module is loaded and called, never inspected.
 */
export function readCommitted(relative: string, owed: string): string {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — ${owed}`).toBe(true);
  // white-box: AC-2 — the criterion IS a property of a committed file's content: the JSON Schema
  // fixture must deep-equal what `z.toJSONSchema(RegisterJsonDocument)` answers, so the committed
  // text is the thing under test and cannot be observed any other way. (AC-1 reads the sample
  // reading through this same door: it is the test's own input, not the product's source.)
  return readFileSync(absolute, "utf8");
}

/** A committed JSON file this increment owes, parsed. */
export function readCommittedJson(relative: string, owed: string): unknown {
  return JSON.parse(readCommitted(relative, owed)) as unknown;
}

/* ------------------------------------------------------------------ the reading */

/**
 * The committed reading, with the case it must arm proved before anything is judged over it: a
 * fixture that stopped carrying a PARTIAL_DECLARED line or a repudiated one would let a wrong export
 * pass quietly, so the arming is asserted here rather than assumed (AC-1 states the minimums).
 */
export function sampleView(): RegisterView {
  const parsed = readCommittedJson(SAMPLE_VIEW_FIXTURE, "this increment commits the reading its export is a function of (AC-1)") as RegisterView;
  expect(parsed.campaign, `${SAMPLE_VIEW_FIXTURE} is read under a campaign (AC-1)`).not.toBeNull();
  expect(parsed.objects.length, `${SAMPLE_VIEW_FIXTURE} carries at least three objects (AC-1)`).toBeGreaterThanOrEqual(3);
  expect(parsed.lines.length, `${SAMPLE_VIEW_FIXTURE} carries at least four lines (AC-1)`).toBeGreaterThanOrEqual(4);
  expect(
    parsed.lines.filter((line) => line.coverage === "PARTIAL_DECLARED" && line.value === null).length,
    `${SAMPLE_VIEW_FIXTURE} carries a line kept with no quantity — coverage PARTIAL_DECLARED, value null (AC-1)`,
  ).toBeGreaterThanOrEqual(1);
  expect(parsed.lines.filter((line) => line.repudiated).length, `${SAMPLE_VIEW_FIXTURE} carries a repudiated line (AC-1)`).toBeGreaterThanOrEqual(1);
  expect(parsed.refusals.length, `${SAMPLE_VIEW_FIXTURE} carries at least one refusal (AC-1)`).toBeGreaterThanOrEqual(1);
  expect(parsed.levelStacks.length, `${SAMPLE_VIEW_FIXTURE} carries a level stack — the affordance the document must NOT export (AC-1)`).toBeGreaterThanOrEqual(1);
  // The reading must reach BELOW a line and an object, or a schema that declares the nested shapes
  // as unknown would never be asked about them: an attribute with competing readings, and a line
  // with a variable binding, are what make the deep walks of AC-2 mean anything.
  expect(
    parsed.objects.some((object) => object.attributes.some((attribute) => attribute.competing.length > 0)),
    `${SAMPLE_VIEW_FIXTURE} carries an attribute with competing readings — the depth the schema must declare (AC-2)`,
  ).toBe(true);
  expect(
    parsed.objects.some((object) => object.attributes.some((attribute) => attribute.overruled.length > 0)),
    `${SAMPLE_VIEW_FIXTURE} carries an overruled reading (AC-2)`,
  ).toBe(true);
  expect(
    parsed.lines.some((line) => Object.keys(line.variables).length > 0),
    `${SAMPLE_VIEW_FIXTURE} carries a line whose formula has named variables — the record level the schema must declare (AC-2)`,
  ).toBe(true);
  return parsed;
}

/* ------------------------------------------------------------------ reading a document */

/** One JSON object of the document, as a bag of unknowns — the document is judged, never trusted. */
export type Bag = Record<string, unknown>;

/** The document as a bag, with a message when the export answered something that is not an object. */
export function asBag(value: unknown, what: string): Bag {
  expect(value !== null && typeof value === "object" && !Array.isArray(value), `${what} is a JSON object`).toBe(true);
  return value as Bag;
}

/** A list of bags, with a message when the export answered something that is not an array. */
export function asBags(value: unknown, what: string): Bag[] {
  expect(Array.isArray(value), `${what} is a JSON array`).toBe(true);
  return (value as unknown[]).map((entry, at) => asBag(entry, `${what}[${at}]`));
}

/** Keys in code-unit order — the order canonical text is written in, and a stable way to compare sets. */
export function sortedKeys(value: object): string[] {
  return Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/* ------------------------------------------------------------------ reading the committed schema */

/** A JSON-Schema node, as far as this suite reads one. */
export type SchemaNode = Record<string, unknown>;

/**
 * What a node stands for, flattened: a union's alternatives, a `$ref` followed into the document it
 * points at, and the node itself. A shape written inline and the same shape factored into `$defs`
 * declare the same thing, and a nullable field is a union — so both are read here, not at the call
 * sites that ask "does the schema declare this?".
 */
export function schemaBranches(node: unknown, root: unknown, seen: Set<unknown> = new Set()): SchemaNode[] {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return [];
  const here = node as SchemaNode;
  if (seen.has(here)) return [];
  seen.add(here);
  const branches: SchemaNode[] = [here];
  const reference = here["$ref"];
  if (typeof reference === "string" && reference.startsWith("#/")) {
    let target: unknown = root;
    for (const step of reference.slice(2).split("/")) {
      target = target !== null && typeof target === "object" ? (target as SchemaNode)[step.replace(/~1/g, "/").replace(/~0/g, "~")] : undefined;
    }
    branches.push(...schemaBranches(target, root, seen));
  }
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    const list = here[key];
    if (Array.isArray(list)) for (const one of list) branches.push(...schemaBranches(one, root, seen));
  }
  return branches;
}

/** The JSON types a node admits, as the schema writes them (`type`, or a list of types). */
export function typesOf(branches: readonly SchemaNode[]): string[] {
  return branches.flatMap((branch) => {
    const type = branch["type"];
    if (typeof type === "string") return [type];
    if (Array.isArray(type)) return type.filter((one): one is string => typeof one === "string");
    return [];
  });
}
